import path from 'path';

import { FileLike } from '../util/file_like';

import { NativeFileBridge } from './native_file_bridge';

function decodeBase64(base64: string): Uint8Array {
    if (typeof atob === 'function') {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; ++i) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes;
    }

    const bufferCtor = (globalThis as { Buffer?: { from: (input: string, encoding: string) => Uint8Array } }).Buffer;
    if (bufferCtor !== undefined) {
        return Uint8Array.from(bufferCtor.from(base64, 'base64'));
    }

    throw new Error('Base64 decoding unavailable in current runtime');
}

function inferMime(fileName: string): string {
    const lower = fileName.toLowerCase();
    if (lower.endsWith('.obj')) {
        return 'model/obj';
    }
    if (lower.endsWith('.mtl')) {
        return 'text/plain';
    }
    if (lower.endsWith('.png')) {
        return 'image/png';
    }
    if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    return 'application/octet-stream';
}

export class IOSPathFileLike implements FileLike {
    public readonly name: string;
    public readonly type?: string;

    private readonly _absolutePath: string;
    private readonly _bridge: NativeFileBridge;

    public constructor(absolutePath: string, bridge: NativeFileBridge, type?: string) {
        this._absolutePath = path.posix.normalize(absolutePath);
        this._bridge = bridge;
        this.name = path.posix.basename(this._absolutePath);
        this.type = type ?? inferMime(this.name);
    }

    public async text(): Promise<string> {
        return this._bridge.readText(this._absolutePath);
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        const base64 = await this._bridge.readBase64(this._absolutePath);
        const bytes = decodeBase64(base64);
        return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    }

    public async getSibling(relativePath: string): Promise<FileLike | undefined> {
        const siblingPath = path.posix.normalize(path.posix.resolve(path.posix.dirname(this._absolutePath), relativePath));
        const exists = await this._bridge.fileExists(siblingPath);
        if (!exists) {
            return undefined;
        }

        return new IOSPathFileLike(siblingPath, this._bridge, inferMime(siblingPath));
    }
}
