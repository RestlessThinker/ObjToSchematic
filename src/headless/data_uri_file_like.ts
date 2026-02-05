import { FileLike } from '../util/file_like';

export class DataUriFileLike implements FileLike {
    public readonly name: string;
    public readonly type?: string;

    private readonly _dataUri: string;

    public constructor(params: {
        name: string,
        dataUri: string,
        type?: string,
    }) {
        this.name = params.name;
        this.type = params.type;
        this._dataUri = params.dataUri;
    }

    public async text(): Promise<string> {
        const response = await fetch(this._dataUri);
        if (!response.ok) {
            throw new Error(`Failed to decode data URI for '${this.name}'`);
        }
        return response.text();
    }

    public async arrayBuffer(): Promise<ArrayBuffer> {
        const response = await fetch(this._dataUri);
        if (!response.ok) {
            throw new Error(`Failed to decode data URI for '${this.name}'`);
        }
        return response.arrayBuffer();
    }

    public async toDataUri(): Promise<string> {
        return this._dataUri;
    }
}
