import * as jpeg from 'jpeg-js';
import { PNG } from 'pngjs';

import { RGBA, RGBAColours, RGBAUtil } from './colour';
import { AppConfig } from './config';
import { clamp } from './math';
import { TOptional, UV } from './util';
import { ASSERT } from './util/error_util';
import { LOG } from './util/log_util';
import { TTexelExtension, TTexelInterpolation } from './util/type_util';

/* eslint-disable */
export enum TextureFormat {
    PNG,
    JPEG
}
/* eslint-enable */

/* eslint-disable */
export enum TextureFiltering {
    Linear,
    Nearest
}
/* eslint-enable */

type ImageData = {
    data: Buffer,
    width: number,
    height: number
}

/* eslint-disable */
export enum EImageChannel {
    R = 0,
    G = 1,
    B = 2,
    A = 3,
    MAX = 4,
}
/* eslint-enable */

export type TImageFiletype = 'png' | 'jpg';

export type TImageRawWrap = {
    raw: string,
    filetype: TImageFiletype,
}

export type TTransparencyTypes = 'None' | 'UseDiffuseMapAlphaChannel' | 'UseAlphaValue' | 'UseAlphaMap';

export type TTransparencyOptions =
    | { type: 'None' }
    | { type: 'UseDiffuseMapAlphaChannel' }
    | { type: 'UseAlphaValue', alpha: number }
    | { type: 'UseAlphaMap', alpha?: TImageRawWrap, channel: EImageChannel };

export class Texture {
    private _image?: ImageData;
    private _alphaImage?: ImageData;

    constructor(params: { diffuse?: TImageRawWrap, transparency: TTransparencyOptions }) {
        this._image = this._readRawData(params.diffuse);

        this._alphaImage = params.transparency.type === 'UseAlphaMap' ?
            this._readRawData(params.transparency.alpha) :
            this._image;
    }

    private _readRawData(params?: TImageRawWrap): TOptional<ImageData> {
        const toHexPrefix = (bytes: Uint8Array, length: number) => {
            const prefix = bytes.slice(0, Math.min(length, bytes.length));
            return Array.from(prefix).map((value) => {
                return value.toString(16).padStart(2, '0');
            }).join('');
        };

        const toHexSuffix = (bytes: Uint8Array, length: number) => {
            const begin = Math.max(0, bytes.length - length);
            const suffix = bytes.slice(begin, bytes.length);
            return Array.from(suffix).map((value) => {
                return value.toString(16).padStart(2, '0');
            }).join('');
        };

        const parseDataUriBytes = (dataUri: string): Uint8Array | undefined => {
            const commaIndex = dataUri.indexOf(',');
            if (commaIndex < 0) {
                return undefined;
            }

            const metadata = dataUri.slice(0, commaIndex).toLowerCase();
            const payload = dataUri.slice(commaIndex + 1).trim();

            if (metadata.includes(';base64')) {
                if (typeof atob === 'function') {
                    const binary = atob(payload);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; ++i) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    return bytes;
                }

                return Uint8Array.from(Buffer.from(payload, 'base64'));
            }

            const decoded = decodeURIComponent(payload);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; ++i) {
                bytes[i] = decoded.charCodeAt(i);
            }
            return bytes;
        };

        const trimPngTrailingBytes = (bytes: Uint8Array): Uint8Array => {
            if (bytes.length < 12) {
                return bytes;
            }

            const PNG_SIGNATURE = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
            for (let i = 0; i < PNG_SIGNATURE.length; ++i) {
                if (bytes[i] !== PNG_SIGNATURE[i]) {
                    return bytes;
                }
            }

            const readU32BE = (offset: number) => {
                return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
            };

            let offset = 8;
            while (offset + 12 <= bytes.length) {
                const chunkLength = readU32BE(offset);
                const typeOffset = offset + 4;
                const chunkEnd = typeOffset + 4 + chunkLength + 4;
                if (chunkEnd > bytes.length) {
                    break;
                }

                const chunkType = String.fromCharCode(
                    bytes[typeOffset],
                    bytes[typeOffset + 1],
                    bytes[typeOffset + 2],
                    bytes[typeOffset + 3],
                );
                if (chunkType === 'IEND') {
                    return bytes.slice(0, chunkEnd);
                }

                offset = chunkEnd;
            }

            return bytes;
        };

        if (params?.filetype === 'png') {
            const pngBytes = parseDataUriBytes(params.raw);
            if (pngBytes !== undefined) {
                try {
                    return PNG.sync.read(Buffer.from(pngBytes));
                } catch (error) {
                    const trimmed = trimPngTrailingBytes(pngBytes);
                    try {
                        if (trimmed.length !== pngBytes.length) {
                            return PNG.sync.read(Buffer.from(trimmed));
                        }
                    } catch (trimmedError) {
                        const baseMessage = trimmedError instanceof Error ? trimmedError.message : String(trimmedError);
                        throw new Error(
                            `PNG decode failed after trim; bytes=${pngBytes.length}, trimmed=${trimmed.length}, ` +
                            `head=${toHexPrefix(pngBytes, 16)}, tail=${toHexSuffix(pngBytes, 16)}, reason=${baseMessage}`,
                        );
                    }

                    const baseMessage = error instanceof Error ? error.message : String(error);
                    throw new Error(
                        `PNG decode failed; bytes=${pngBytes.length}, head=${toHexPrefix(pngBytes, 16)}, ` +
                        `tail=${toHexSuffix(pngBytes, 16)}, reason=${baseMessage}`,
                    );
                }
            }
        }
        if (params?.filetype === 'jpg') {
            const jpgBytes = parseDataUriBytes(params.raw);
            if (jpgBytes !== undefined) {
                return jpeg.decode(Buffer.from(jpgBytes), {
                    maxMemoryUsageInMB: AppConfig.Get.MAXIMUM_IMAGE_MEM_ALLOC,
                    formatAsRGBA: true,
                });
            }
        }
    }

    private _correctTexcoord(a: number) {
        if (Number.isInteger(a)) {
            return a > 0.5 ? 1.0 : 0.0;
        }
        const frac = Math.abs(a) - Math.floor(Math.abs(a));
        return a < 0.0 ? 1.0 - frac : frac;
    }

    /**
     * UV can be in any range and is not limited to [0, 1]
     */
    public getRGBA(inUV: UV, interpolation: TTexelInterpolation, extension: TTexelExtension): RGBA {
        const uv = new UV(0.0, 0.0);

        if (extension === 'clamp') {
            uv.u = clamp(inUV.u, 0.0, 1.0);
            uv.v = clamp(inUV.v, 0.0, 1.0);
        } else {
            uv.u = this._correctTexcoord(inUV.u);
            uv.v = this._correctTexcoord(inUV.v);
        }
        ASSERT(uv.u >= 0.0 && uv.u <= 1.0, 'Texcoord UV.u OOB');
        ASSERT(uv.v >= 0.0 && uv.v <= 1.0, 'Texcoord UV.v OOB');
        uv.v = 1.0 - uv.v;

        const diffuse = this._image === undefined ? RGBAColours.MAGENTA : ((interpolation === 'nearest') ?
            this._getNearestRGBA(this._image, uv) :
            this._getLinearRGBA(this._image, uv));

        const alpha = this._alphaImage === undefined ? RGBAColours.MAGENTA : ((interpolation === 'nearest') ?
            this._getNearestRGBA(this._alphaImage, uv) :
            this._getLinearRGBA(this._alphaImage, uv));

        return {
            r: diffuse.r,
            g: diffuse.g,
            b: diffuse.b,
            a: alpha.a,
        };
    }

    /**
     * UV is assumed to be in [0, 1] range.
     */
    private _getLinearRGBA(image: ImageData, uv: UV): RGBA {
        const x = uv.u * image.width;
        const y = uv.v * image.height;

        const xLeft = Math.floor(x);
        const xRight = xLeft + 1;
        const yUp = Math.floor(y);
        const yDown = yUp + 1;

        const u = x - xLeft;
        const v = y - yUp;

        if (!(u >= 0.0 && u <= 1.0 && v >= 0.0 && v <= 1.0)) {
            return RGBAColours.MAGENTA;
        }

        const A = Texture._sampleImage(xLeft, yUp, this._image);
        const B = Texture._sampleImage(xRight, yUp, this._image);
        const AB = RGBAUtil.lerp(A, B, u);

        const C = Texture._sampleImage(xLeft, yDown, this._image);
        const D = Texture._sampleImage(xRight, yDown, this._image);
        const CD = RGBAUtil.lerp(C, D, u);

        return RGBAUtil.lerp(AB, CD, v);
    }

    /**
     * UV is assumed to be in [0, 1] range.
     */
    private _getNearestRGBA(image: ImageData, uv: UV): RGBA {
        const diffuseX = Math.floor(uv.u * image.width);
        const diffuseY = Math.floor(uv.v * image.height);

        return Texture._sampleImage(diffuseX, diffuseY, image);
    }

    private _sampleChannel(colour: RGBA, channel: EImageChannel) {
        switch (channel) {
            case EImageChannel.R: return colour.r;
            case EImageChannel.G: return colour.g;
            case EImageChannel.B: return colour.b;
            case EImageChannel.A: return colour.a;
        }
    }

    public _useAlphaChannelValue?: boolean;
    public _useAlphaChannel() {
        ASSERT(this._alphaImage !== undefined);
        if (this._useAlphaChannelValue !== undefined) {
            return this._useAlphaChannelValue;
        }

        for (let i = 0; i < this._alphaImage.width; ++i) {
            for (let j = 0; j < this._alphaImage.height; ++j) {
                const value = Texture._sampleImage(i, j, this._alphaImage);
                if (value.a != 1.0) {
                    LOG(`Using alpha channel`);
                    this._useAlphaChannelValue = true;
                    return true;
                }
            }
        }

        LOG(`Using red channel`);
        this._useAlphaChannelValue = false;
        return false;
    }

    private static _sampleImage(x: number, y: number, image?: ImageData) {
        if (image === undefined) {
            return RGBAColours.MAGENTA;
        }

        x = clamp(x, 0, image.width - 1);
        y = clamp(y, 0, image.height - 1);

        const index = 4 * (image.width * y + x);
        const rgba = image.data.slice(index, index + 4);

        return {
            r: rgba[0] / 255,
            g: rgba[1] / 255,
            b: rgba[2] / 255,
            a: rgba[3] / 255,
        };
    }
}

export class TextureConverter {
    public static createPNGfromTGA(filepath: string): string {
        // TODO Unimplemented;
        return '';
        /*
        ASSERT(fs.existsSync(filepath), '.tga does not exist');
        const parsed = path.parse(filepath);
        ASSERT(parsed.ext === '.tga');
        const data = fs.readFileSync(filepath);
        const tga = new TGA(data);
        const png = new PNG({
            width: tga.width,
            height: tga.height,
        });
        png.data = tga.pixels;
        FileUtil.mkdirIfNotExist(AppPaths.Get.gen);
        const buffer = PNG.sync.write(png);
        const newTexturePath = path.join(AppPaths.Get.gen, parsed.name + '.gen.png');
        LOGF(`Creating new generated texture of '${filepath}' at '${newTexturePath}'`);
        fs.writeFileSync(newTexturePath, buffer);
        return newTexturePath;
        */
    }
}
