import { RGBA, RGBAColours, RGBAUtil } from '../colour';
import { MaterialMap, MaterialType } from '../mesh';
import { TImageRawWrap } from '../texture';

type TMtlMaterial = {
    name: string;
    diffuseColour?: RGBA;
    diffuseMap?: string;
    alpha?: number;
};

export type LoadTextureDelegate = (relativePath: string) => Promise<TImageRawWrap | undefined>;

const DEFAULT_ALPHA = 1.0;

function parseColour(components: string[]): RGBA | undefined {
    if (components.length < 3) {
        return undefined;
    }

    const [r, g, b] = components.slice(0, 3).map((value) => parseFloat(value));
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
        return undefined;
    }

    return {
        r,
        g,
        b,
        a: DEFAULT_ALPHA,
    };
}

function normaliseMaterial(material: TMtlMaterial): TMtlMaterial {
    if (material.diffuseColour === undefined) {
        material.diffuseColour = RGBAUtil.copy(RGBAColours.WHITE);
    }
    if (material.alpha === undefined) {
        material.alpha = DEFAULT_ALPHA;
    }

    material.diffuseColour.a = material.alpha;

    return material;
}

export async function parseMtl(
    mtlSource: string,
    loadTexture: LoadTextureDelegate,
): Promise<MaterialMap> {
    const materials = new Map<string, TMtlMaterial>();

    let currentMaterial: TMtlMaterial | undefined;
    const lines = mtlSource.replace(/\r/g, '').split('\n');

    const commitIfNeeded = () => {
        if (currentMaterial !== undefined) {
            materials.set(currentMaterial.name, normaliseMaterial(currentMaterial));
        }
    };

    for (const rawLine of lines) {
        const trimmedLine = rawLine.trim();
        if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
            continue;
        }

        const commentIndex = trimmedLine.indexOf('#');
        const line = (commentIndex >= 0 ? trimmedLine.slice(0, commentIndex) : trimmedLine).trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        }

        const tokens = line.split(/\s+/);
        const keyword = tokens[0].toLowerCase();

        switch (keyword) {
            case 'newmtl': {
                commitIfNeeded();
                const name = tokens.slice(1).join(' ');
                if (name.length === 0) {
                    break;
                }
                currentMaterial = {
                    name,
                };
                break;
            }
            case 'kd': {
                if (currentMaterial !== undefined) {
                    const colour = parseColour(tokens.slice(1));
                    if (colour !== undefined) {
                        currentMaterial.diffuseColour = colour;
                    }
                }
                break;
            }
            case 'd': {
                if (currentMaterial !== undefined && tokens.length >= 2) {
                    const alpha = parseFloat(tokens[1]);
                    if (!Number.isNaN(alpha)) {
                        currentMaterial.alpha = alpha;
                    }
                }
                break;
            }
            case 'tr': {
                if (currentMaterial !== undefined && tokens.length >= 2) {
                    const transparency = parseFloat(tokens[1]);
                    if (!Number.isNaN(transparency)) {
                        currentMaterial.alpha = 1.0 - transparency;
                    }
                }
                break;
            }
            case 'map_kd': {
                if (currentMaterial !== undefined && tokens.length >= 2) {
                    const pathTokens = tokens.slice(1).filter((token) => !token.startsWith('-'));
                    if (pathTokens.length > 0) {
                        const texturePath = pathTokens.join(' ');
                        currentMaterial.diffuseMap = texturePath;
                    }
                }
                break;
            }
            default:
                break;
        }
    }

    commitIfNeeded();

    const materialMap: MaterialMap = new Map();
    const materialEntries = Array.from(materials.entries());
    for (let index = 0; index < materialEntries.length; ++index) {
        const entry = materialEntries[index];
        const name = entry[0];
        const descriptor = entry[1];
        const material = normaliseMaterial({ ...descriptor });

        if (material.diffuseMap !== undefined) {
            const texture = await loadTexture(material.diffuseMap);
            if (texture !== undefined) {
                materialMap.set(name, {
                    type: MaterialType.textured,
                    diffuse: texture,
                    extension: 'repeat',
                    interpolation: 'linear',
                    needsAttention: false,
                    transparency: material.alpha !== undefined && material.alpha < 1.0 ?
                        { type: 'UseAlphaValue', alpha: material.alpha } :
                        { type: 'None' },
                });
                continue;
            }
        }

        const baseColour = material.diffuseColour ?? RGBAUtil.copy(RGBAColours.WHITE);
        materialMap.set(name, {
            type: MaterialType.solid,
            colour: baseColour,
            canBeTextured: true,
            needsAttention: false,
        });
    }

    return materialMap;
}
