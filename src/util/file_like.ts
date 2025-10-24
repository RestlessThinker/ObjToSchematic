import { ASSERT } from './error_util';

/**
 * Minimal subset of the browser `File` interface that the import pipeline
 * depends on. This allows the headless tooling to provide filesystem-backed
 * implementations without pulling DOM globals into the worker client.
 */
export interface FileLike {
    name: string;
    type?: string;
    /**
     * Returns the file contents as UTF-8 text.
     */
    text(): Promise<string>;
    /**
     * Returns the raw file contents so loaders that expect ArrayBuffers can function.
     */
    arrayBuffer(): Promise<ArrayBuffer>;
}

export function assertFileLike(file: FileLike | undefined | null): asserts file is FileLike {
    ASSERT(file !== undefined && file !== null, 'Missing file reference');
}
