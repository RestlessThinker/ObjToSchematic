import { promises as fs } from 'fs';
import path from 'path';

import { FallableBehaviour } from '../src/block_mesh';
import { PALETTE_ALL_RELEASE } from '../res/palettes/all';
import { ColourSpace } from '../src/util';
import { FileLike } from '../src/util/file_like';
import { Vector3 } from '../src/vector';
import { THeadlessConfig } from './headless';

class LocalFile implements FileLike {
    public readonly name: string;
    public readonly type?: string;

    private readonly absolutePath: string;

    public constructor(absolutePath: string, mimeType: string) {
        this.name = path.basename(absolutePath);
        this.type = mimeType;
        this.absolutePath = absolutePath;
    }

    public async text(): Promise<string> {
        return fs.readFile(this.absolutePath, 'utf8');
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        const buffer = await fs.readFile(this.absolutePath);
        const { buffer: rawBuffer, byteLength, byteOffset } = buffer;
        return rawBuffer.slice(byteOffset, byteOffset + byteLength);
    }

    public async getSibling(relativePath: string): Promise<FileLike | undefined> {
        const resolved = path.resolve(path.dirname(this.absolutePath), relativePath);
        try {
            await fs.access(resolved);
        } catch {
            return undefined;
        }

        return new LocalFile(resolved, LocalFile.inferMime(resolved));
    }

    private static inferMime(filePath: string): string {
        const ext = path.extname(filePath).toLowerCase();
        switch (ext) {
            case '.obj':
                return 'model/obj';
            case '.mtl':
                return 'text/plain';
            case '.png':
                return 'image/png';
            case '.jpg':
            case '.jpeg':
                return 'image/jpeg';
            default:
                return 'application/octet-stream';
        }
    }
}

const OBJ_FILE_PATH = path.resolve(__dirname, '../3dmodels/truck/model-mobile.obj');

const defaultObjFile = new LocalFile(OBJ_FILE_PATH, 'model/obj');
const defaultFallable: FallableBehaviour = 'replace-falling';

export const headlessConfig: THeadlessConfig = {
    import: {
        file: defaultObjFile,
        rotation: new Vector3(0, 0, 0),
    },
    voxelise: {
        constraintAxis: 'y',
        voxeliser: 'ncrb',
        size: 80,
        useMultisampleColouring: true,
        voxelOverlapRule: 'average',
        enableAmbientOcclusion: true,
    },
    assign: {
        textureAtlas: 'vanilla',
        blockPalette: PALETTE_ALL_RELEASE,
        dithering: 'ordered',
        ditheringMagnitude: 32,
        colourSpace: ColourSpace.RGB,
        fallable: defaultFallable,
        resolution: 32,
        calculateLighting: false,
        lightThreshold: 1,
        contextualAveraging: true,
        errorWeight: 0.02,
    },
    export: {
        exporter: 'schem',
    },
    debug: {
        showLogs: true,
        showWarnings: true,
        showTimings: true,
    },
};
