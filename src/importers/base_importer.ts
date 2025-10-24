import { Mesh } from '../mesh';
import { FileLike } from '../util/file_like';

export abstract class IImporter {
    public abstract import(file: FileLike): Promise<Mesh>;
}
