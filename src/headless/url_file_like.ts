import { FileLike } from '../util/file_like';

type TSiblingUrlMap = {
    [relativePath: string]: string,
};

function normalise(pathLike: string): string {
    return pathLike.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function baseName(pathLike: string): string {
    const split = normalise(pathLike).split('/');
    return split[split.length - 1];
}

export class URLFileLike implements FileLike {
    public readonly name: string;
    public readonly type?: string;

    private readonly _url: string;
    private readonly _siblings: Map<string, string>;

    public constructor(params: {
        name: string,
        url: string,
        type?: string,
        siblings?: TSiblingUrlMap,
    }) {
        this.name = params.name;
        this._url = params.url;
        this.type = params.type;
        this._siblings = new Map<string, string>();

        if (params.siblings !== undefined) {
            const entries = Object.entries(params.siblings);
            for (let i = 0; i < entries.length; ++i) {
                const [relativePath, siblingUrl] = entries[i];
                const key = normalise(relativePath);
                this._siblings.set(key, siblingUrl);
                this._siblings.set(baseName(key), siblingUrl);
            }
        }
    }

    public async text(): Promise<string> {
        const response = await fetch(this._url);
        if (!response.ok) {
            throw new Error(`Failed to load '${this.name}' from '${this._url}'`);
        }
        return response.text();
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        const response = await fetch(this._url);
        if (!response.ok) {
            throw new Error(`Failed to load '${this.name}' from '${this._url}'`);
        }
        return response.arrayBuffer();
    }

    public async getSibling(relativePath: string): Promise<FileLike | undefined> {
        const key = normalise(relativePath);
        const siblingUrl = this._siblings.get(key) ?? this._siblings.get(baseName(key));
        if (siblingUrl === undefined) {
            return undefined;
        }

        return new URLFileLike({
            name: key,
            url: siblingUrl,
            type: inferMime(key),
        });
    }
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
