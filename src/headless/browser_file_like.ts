import { FileLike } from '../util/file_like';

function normalisePath(pathLike: string): string {
    return pathLike.replace(/\\/g, '/').replace(/^\.\//, '').trim();
}

function getBaseName(pathLike: string): string {
    const split = normalisePath(pathLike).split('/');
    return split[split.length - 1];
}

export class BrowserFileLike implements FileLike {
    public readonly name: string;
    public readonly type?: string;

    private readonly _file: File;
    private readonly _siblings: Map<string, File>;

    public constructor(file: File, siblings: File[] = []) {
        this._file = file;
        this.name = file.name;
        this.type = file.type;
        this._siblings = new Map<string, File>();

        for (let i = 0; i < siblings.length; ++i) {
            const sibling = siblings[i];
            const normalisedName = normalisePath(sibling.name);
            this._siblings.set(normalisedName, sibling);
            this._siblings.set(getBaseName(normalisedName), sibling);
        }
    }

    public async text(): Promise<string> {
        return this._file.text();
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        return this._file.arrayBuffer();
    }

    public async getSibling(relativePath: string): Promise<FileLike | undefined> {
        const normalisedPath = normalisePath(relativePath);
        const sibling = this._siblings.get(normalisedPath) ?? this._siblings.get(getBaseName(normalisedPath));
        if (sibling === undefined) {
            return undefined;
        }
        return new BrowserFileLike(sibling, []);
    }
}
