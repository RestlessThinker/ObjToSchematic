import path from 'path';

import { RGBAColours, RGBAUtil } from '../colour';
import { ProgressManager } from '../progress';
import { LOC } from '../localiser';
import { checkNaN } from '../math';
import { MaterialMap, MaterialType, Mesh, Tri } from '../mesh';
import { StatusHandler } from '../status';
import { TImageRawWrap } from '../texture';
import { UV } from '../util';
import { AppError, ASSERT } from '../util/error_util';
import { LOG, LOG_WARN } from '../util/log_util';
import { RegExpBuilder } from '../util/regex_util';
import { REGEX_NZ_ANY } from '../util/regex_util';
import { REGEX_NUMBER } from '../util/regex_util';
import { FileLike } from '../util/file_like';
import { Vector3 } from '../vector';
import { IImporter } from './base_importer';
import { parseMtl } from './mtl_parser';

export class ObjImporter extends IImporter {
    private _vertices: Vector3[] = [];
    private _normals: Vector3[] = [];
    private _uvs: UV[] = [];
    private _tris: Tri[] = [];
    private _currentMaterialName: string = 'DEFAULT_UNASSIGNED';
    private _materialLibs: Set<string> = new Set();

    private _objParsers = [
        {
            // e.g. 'mtllib model.mtl'
            regex: new RegExpBuilder().add(/^mtllib/).add(/ /).add(REGEX_NZ_ANY, 'path').toRegExp(),
            delegate: (match: { [key: string]: string }) => {
                const rawPath = match.path.trim();
                const commentIndex = rawPath.indexOf('#');
                const lib = (commentIndex >= 0 ? rawPath.slice(0, commentIndex) : rawPath).trim();
                if (lib.length > 0) {
                    this._materialLibs.add(lib);
                }
            },
        },
        {
            // e.g. 'usemtl my_material'
            regex: new RegExpBuilder().add(/^usemtl/).add(/ /).add(REGEX_NZ_ANY, 'name').toRegExp(),
            delegate: (match: { [key: string]: string }) => {
                const rawName = match.name.trim();
                const commentIndex = rawName.indexOf('#');
                const materialName = (commentIndex >= 0 ? rawName.slice(0, commentIndex) : rawName).trim();
                ASSERT(materialName, 'invalid material name');
                this._currentMaterialName = materialName;
            },
        },
        {
            // e.g. 'v 0.123 0.456 0.789'
            regex: new RegExpBuilder()
                .add(/^v/)
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'x')
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'y')
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'z')
                .toRegExp(),
            delegate: (match: { [key: string]: string }) => {
                const x = parseFloat(match.x);
                const y = parseFloat(match.y);
                const z = parseFloat(match.z);
                checkNaN(x, y, z);
                this._vertices.push(new Vector3(x, y, z));
            },
        },
        {
            // e.g. 'vn 0.123 0.456 0.789'
            regex: new RegExpBuilder()
                .add(/^vn/)
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'x')
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'y')
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'z')
                .toRegExp(),
            delegate: (match: { [key: string]: string }) => {
                const x = parseFloat(match.x);
                const y = parseFloat(match.y);
                const z = parseFloat(match.z);
                checkNaN(x, y, z);
                this._normals.push(new Vector3(x, y, z));
            },
        },
        {
            // e.g. 'vt 0.123 0.456'
            regex: new RegExpBuilder()
                .add(/^vt/)
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'u')
                .addNonzeroWhitespace()
                .add(REGEX_NUMBER, 'v')
                .toRegExp(),
            delegate: (match: { [key: string]: string }) => {
                const u = parseFloat(match.u);
                const v = parseFloat(match.v);
                checkNaN(u, v);
                this._uvs.push(new UV(u, v));
            },
        },
        {
            // e.g. 'f 1/2/3 ...' or 'f 1/2 ...' or 'f 1 ...'
            regex: new RegExpBuilder()
                .add(/^f/)
                .addNonzeroWhitespace()
                .add(/.*/, 'line')
                .toRegExp(),
            delegate: (match: { [key: string]: string }) => {
                const line = match.line.trim();

                const vertices = line.split(' ').filter((x) => {
                    return x.length !== 0;
                });

                if (vertices.length < 3) {
                    return;
                }

                const points: {
                    positionIndex: number;
                    texcoordIndex?: number;
                    normalIndex?: number;
                }[] = [];

                for (const vertex of vertices) {
                    const vertexData = vertex.split('/');
                    switch (vertexData.length) {
                        case 1: {
                            const index = parseInt(vertexData[0]);
                            points.push({
                                positionIndex: index,
                                texcoordIndex: index,
                                normalIndex: index,
                            });
                            break;
                        }
                        case 2: {
                            const positionIndex = parseInt(vertexData[0]);
                            const texcoordIndex = parseInt(vertexData[1]);
                            points.push({
                                positionIndex: positionIndex,
                                texcoordIndex: texcoordIndex,
                            });
                            break;
                        }
                        case 3: {
                            const positionIndex = parseInt(vertexData[0]);
                            const texcoordIndex = parseInt(vertexData[1]);
                            const normalIndex = parseInt(vertexData[2]);
                            points.push({
                                positionIndex: positionIndex,
                                texcoordIndex: texcoordIndex,
                                normalIndex: normalIndex,
                            });
                            break;
                        }
                        default:
                            throw new AppError(LOC('import.invalid_face_data', { count: vertexData.length }));
                    }
                }

                const pointBase = points[0];
                for (let i = 1; i < points.length - 1; ++i) {
                    const pointA = points[i];
                    const pointB = points[i + 1];
                    const tri: Tri = {
                        positionIndices: {
                            x: pointBase.positionIndex - 1,
                            y: pointA.positionIndex - 1,
                            z: pointB.positionIndex - 1,
                        },
                        material: this._currentMaterialName,
                    };
                    if (pointBase.normalIndex || pointA.normalIndex || pointB.normalIndex) {
                        ASSERT(pointBase.normalIndex && pointA.normalIndex && pointB.normalIndex);
                        tri.normalIndices = {
                            x: pointBase.normalIndex - 1,
                            y: pointA.normalIndex - 1,
                            z: pointB.normalIndex - 1,
                        };
                    }
                    if (pointBase.texcoordIndex || pointA.texcoordIndex || pointB.texcoordIndex) {
                        ASSERT(pointBase.texcoordIndex && pointA.texcoordIndex && pointB.texcoordIndex);
                        tri.texcoordIndices = {
                            x: pointBase.texcoordIndex - 1,
                            y: pointA.texcoordIndex - 1,
                            z: pointB.texcoordIndex - 1,
                        };
                    }
                    this._tris.push(tri);
                }
            },
        },
    ];

    private _resetState() {
        this._vertices = [];
        this._normals = [];
        this._uvs = [];
        this._tris = [];
        this._currentMaterialName = 'DEFAULT_UNASSIGNED';
        this._materialLibs = new Set();
    }

    public override async import(file: FileLike): Promise<Mesh> {
        this._resetState();

        const fileSource = await file.text();
        if (fileSource.includes('�')) {
            throw new AppError(LOC('import.invalid_encoding'));
        }

        fileSource.replace('\r', '');
        const fileLines = fileSource.split('\n');
        const numLines = fileLines.length;

        const progressHandle = ProgressManager.Get.start('Importing');
        try {
            fileLines.forEach((line, index) => {
                this.parseOBJLine(line);
                ProgressManager.Get.progress(progressHandle, index / numLines);
            });
        } finally {
            ProgressManager.Get.end(progressHandle);
        }

        const materials = await this._loadMaterials(file);

        return new Mesh(this._vertices, this._normals, this._uvs, this._tris, materials);
    }

    private async _loadMaterials(sourceFile: FileLike): Promise<MaterialMap> {
        const materialMap: MaterialMap = new Map();

        if (this._materialLibs.size === 0) {
            return materialMap;
        }

        if (sourceFile.getSibling === undefined) {
            LOG_WARN('OBJ importer: material library declared but FileLike.getSibling is unavailable.');
            return materialMap;
        }

        const materialLibraries = Array.from(this._materialLibs.values());
        for (let libIndex = 0; libIndex < materialLibraries.length; ++libIndex) {
            const materialLibrary = materialLibraries[libIndex];
            try {
                let mtlFile = await sourceFile.getSibling(materialLibrary);
                if (mtlFile === undefined) {
                    const objBase = path.parse(sourceFile.name).name;
                    if (objBase.length > 0) {
                        const nestedPath = path.join(objBase, materialLibrary);
                        mtlFile = await sourceFile.getSibling(nestedPath);
                    }
                }
                if (mtlFile === undefined) {
                    StatusHandler.warning(`Could not locate material library '${materialLibrary}'` as any);
                    continue;
                }

                LOG(`[OBJ importer] Loading material library '${mtlFile.name}' referenced by '${sourceFile.name}'.`);

                const mtlSource = await mtlFile.text();
                const mtlAccessor = mtlFile;
                const parsed = await parseMtl(mtlSource, async (texturePath) => {
                    const loaders: Array<(relativePath: string) => Promise<FileLike | undefined>> = [];

                    if (typeof mtlAccessor.getSibling === 'function') {
                        loaders.push(mtlAccessor.getSibling.bind(mtlAccessor));
                    }
                    loaders.push(sourceFile.getSibling!.bind(sourceFile));

                    const textureCandidates: string[] = [texturePath];

                    const sourceBase = path.parse(sourceFile.name).name;
                    if (sourceBase.length > 0) {
                        const candidate = path.join(sourceBase, texturePath);
                        if (textureCandidates.indexOf(candidate) === -1) {
                            textureCandidates.push(candidate);
                        }
                    }

                    const mtlBase = path.parse(mtlAccessor.name).name;
                    if (mtlBase.length > 0) {
                        const candidate = path.join(mtlBase, texturePath);
                        if (textureCandidates.indexOf(candidate) === -1) {
                            textureCandidates.push(candidate);
                        }
                    }
                    const mtlExact = path.join(mtlAccessor.name, texturePath);
                    if (textureCandidates.indexOf(mtlExact) === -1) {
                        textureCandidates.push(mtlExact);
                    }

                    for (let loaderIndex = 0; loaderIndex < loaders.length; ++loaderIndex) {
                        const loader = loaders[loaderIndex];
                        for (let candidateIndex = 0; candidateIndex < textureCandidates.length; ++candidateIndex) {
                            const candidatePath = textureCandidates[candidateIndex];
                            const textureFile = await loader(candidatePath);
                            if (textureFile !== undefined) {
                                const texture = await this._readTexture(textureFile);
                                if (texture !== undefined) {
                                    LOG(`[OBJ importer] Loaded texture '${textureFile.name}' from material library '${materialLibrary}'.`);
                                    return texture;
                                }
                            }
                        }
                    }

                    LOG_WARN(`OBJ importer: texture '${texturePath}' referenced from '${materialLibrary}' could not be resolved.`);
                    return undefined;
                });

                parsed.forEach((material, name) => {
                    materialMap.set(name, material);
                });
            } catch (error) {
                LOG_WARN(`Failed to load material library '${materialLibrary}': ${(error as Error).message}`);
            }
        }

        return materialMap;
    }

    private async _readTexture(file: FileLike): Promise<TImageRawWrap | undefined> {
        const extension = path.extname(file.name).toLowerCase();
        let filetype: TImageRawWrap['filetype'];
        let mime: string;

        switch (extension) {
            case '.png':
                filetype = 'png';
                mime = 'image/png';
                break;
            case '.jpg':
            case '.jpeg':
                filetype = 'jpg';
                mime = 'image/jpeg';
                break;
            default:
                LOG_WARN(`OBJ importer: unsupported texture type '${extension}' referenced by '${file.name}'`);
                return undefined;
        }

        if (typeof file.toDataUri === 'function') {
            const dataUri = await file.toDataUri();
            if (dataUri !== undefined) {
                return {
                    filetype,
                    raw: dataUri,
                };
            }
        }

        const buffer = await file.arrayBuffer();
        const base64 = this._arrayBufferToBase64(buffer);

        return {
            filetype,
            raw: `data:${mime};base64,${base64}`,
        };
    }

    private _arrayBufferToBase64(buffer: ArrayBuffer): string {
        if (typeof Buffer !== 'undefined') {
            return Buffer.from(buffer).toString('base64');
        }

        let binary = '';
        const bytes = new Uint8Array(buffer);
        const chunkSize = 0x8000;
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, Array.from(chunk) as number[]);
        }

        return btoa(binary);
    }

    public parseOBJLine(line: string) {
        const essentialTokens = ['usemtl ', 'v ', 'vt ', 'f ', 'vn '];

        for (let i = 0; i < this._objParsers.length; ++i) {
            const parser = this._objParsers[i];
            const match = parser.regex.exec(line);
            if (match && match.groups) {
                try {
                    parser.delegate(match.groups);
                } catch (error) {
                    if (error instanceof AppError) {
                        throw new AppError(LOC('import.failed_to_parse_line', { line: line, error: error.message }));
                    }
                }
                return;
            }
        }

        const beginsWithEssentialToken = essentialTokens.some((token) => {
            return line.startsWith(token);
        });
        if (beginsWithEssentialToken) {
            ASSERT(false, `Failed to parse essential token for <b>${line}</b>`);
        }
    }
}
