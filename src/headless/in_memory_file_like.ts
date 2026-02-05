import { FileLike } from '../util/file_like';

type TSiblingMapInput = {
    [relativePath: string]: FileLike | string | Uint8Array;
};

function normaliseRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function getBaseName(relativePath: string): string {
    const normalised = normaliseRelativePath(relativePath);
    const split = normalised.split('/');
    return split[split.length - 1];
}

function toBytes(content: string | Uint8Array): Uint8Array {
    if (typeof content === 'string') {
        return new TextEncoder().encode(content);
    }
    return content;
}

function inferMimeType(fileName: string): string {
    const lowerName = fileName.toLowerCase();
    if (lowerName.endsWith('.obj')) {
        return 'model/obj';
    }
    if (lowerName.endsWith('.mtl')) {
        return 'text/plain';
    }
    if (lowerName.endsWith('.png')) {
        return 'image/png';
    }
    if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
        return 'image/jpeg';
    }
    return 'application/octet-stream';
}

export class InMemoryFileLike implements FileLike {
    public readonly name: string;
    public readonly type?: string;

    private readonly _bytes: Uint8Array;
    private readonly _siblings: Map<string, FileLike>;

    public constructor(params: {
        name: string,
        content: string | Uint8Array,
        type?: string,
        siblings?: TSiblingMapInput,
    }) {
        this.name = params.name;
        this.type = params.type;
        this._bytes = toBytes(params.content);
        this._siblings = new Map<string, FileLike>();

        if (params.siblings !== undefined) {
            const entries = Object.entries(params.siblings);
            for (let i = 0; i < entries.length; ++i) {
                const [relativePath, sibling] = entries[i];
                const siblingFile = isFileLike(sibling) ?
                    sibling :
                    new InMemoryFileLike({
                        name: getBaseName(relativePath),
                        content: sibling,
                        type: inferMimeType(relativePath),
                    });
                this.registerSibling(relativePath, siblingFile);
            }
        }
    }

    public registerSibling(relativePath: string, sibling: FileLike) {
        const normalisedPath = normaliseRelativePath(relativePath);
        this._siblings.set(normalisedPath, sibling);
        this._siblings.set(getBaseName(normalisedPath), sibling);
    }

    public async text(): Promise<string> {
        return new TextDecoder().decode(this._bytes);
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        return this._bytes.buffer.slice(this._bytes.byteOffset, this._bytes.byteOffset + this._bytes.byteLength);
    }

    public async getSibling(relativePath: string): Promise<FileLike | undefined> {
        const normalisedPath = normaliseRelativePath(relativePath);
        const directHit = this._siblings.get(normalisedPath);
        if (directHit !== undefined) {
            return directHit;
        }
        return this._siblings.get(getBaseName(normalisedPath));
    }
}

function isFileLike(value: unknown): value is FileLike {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as FileLike;
    return typeof candidate.text === 'function' && typeof candidate.arrayBuffer === 'function';
}
