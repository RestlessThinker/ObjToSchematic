import { InMemoryFileLike } from './in_memory_file_like';
import { IOSPathFileLike } from './ios_path_file_like';
import { NativeFileBridge } from './native_file_bridge';
import { TWebHeadlessResult, createDefaultWebHeadlessConfig, runWebHeadless } from './web_headless';

type TIOSMessagePayload = {
    level?: 'log' | 'warn' | 'error',
    message?: string,
    filename?: string,
    size?: number,
    base64?: string,
    error?: string,
};

type TIOSMessagePoster = (channel: string, payload: TIOSMessagePayload) => void;

type TConsoleMethod = (...data: any[]) => void;

type TConsoleMethodName = 'log' | 'warn' | 'error' | 'time' | 'timeEnd';

function stringifyLogArg(value: unknown): string {
    if (typeof value === 'string') {
        return value;
    }
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function defaultPoster(channel: string, payload: TIOSMessagePayload): void {
    const webkitRuntime = (window as any).webkit;
    const handler = webkitRuntime?.messageHandlers?.[channel];
    if (handler !== undefined && typeof handler.postMessage === 'function') {
        handler.postMessage(payload);
    }
}

export function installIOSConsoleBridge(poster: TIOSMessagePoster = defaultPoster): void {
    const globalObj = window as any;
    if (globalObj.__objToSchematicConsoleBridgeInstalled === true) {
        return;
    }

    const methods: TConsoleMethodName[] = ['log', 'warn', 'error', 'time', 'timeEnd'];
    methods.forEach((methodName) => {
        const originalMethod = console[methodName] as TConsoleMethod;
        console[methodName] = (...data: any[]) => {
            originalMethod(...data);
            const message = data.map((entry) => stringifyLogArg(entry)).join(' ');
            poster('logger', {
                level: methodName === 'warn' || methodName === 'error' ? methodName : 'log',
                message,
            });
        };
    });

    globalObj.__objToSchematicConsoleBridgeInstalled = true;
}

export function bytesToBase64(bytes: Uint8Array): string {
    const bufferCtor = (globalThis as { Buffer?: { from: (input: Uint8Array) => { toString: (encoding: string) => string } } }).Buffer;
    if (bufferCtor !== undefined) {
        return bufferCtor.from(bytes).toString('base64');
    }

    let binary = '';
    for (let i = 0; i < bytes.length; ++i) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

export function createSampleObjFile(): InMemoryFileLike {
    return new InMemoryFileLike({
        name: 'cube.obj',
        content: [
            'mtllib cube.mtl',
            'o Cube',
            'v 0.000000 0.000000 0.000000',
            'v 1.000000 0.000000 0.000000',
            'v 1.000000 1.000000 0.000000',
            'v 0.000000 1.000000 0.000000',
            'v 0.000000 0.000000 1.000000',
            'v 1.000000 0.000000 1.000000',
            'v 1.000000 1.000000 1.000000',
            'v 0.000000 1.000000 1.000000',
            'usemtl Material',
            'f 1 2 3 4',
            'f 5 6 7 8',
            'f 1 5 8 4',
            'f 2 6 7 3',
            'f 1 2 6 5',
            'f 4 3 7 8',
        ].join('\n'),
        type: 'model/obj',
        siblings: {
            'cube.mtl': [
                'newmtl Material',
                'Kd 0.7 0.7 0.7',
            ].join('\n'),
        },
    });
}

export async function runSampleConversion(
    poster: TIOSMessagePoster = defaultPoster,
): Promise<TWebHeadlessResult> {
    const { createBundledTruckObjFile } = await import('./truck_sample');
    const sample = createBundledTruckObjFile();
    const config = createDefaultWebHeadlessConfig(sample);

    poster('conversionState', { message: 'started' });

    try {
        const result = await runWebHeadless(config);
        poster('conversionComplete', {
            filename: result.filename,
            size: result.content.length,
            base64: bytesToBase64(result.content),
        });
        poster('conversionState', { message: 'finished' });
        return result;
    } catch (error: any) {
        const describeError = (value: unknown): string => {
            if (value instanceof Error) {
                const pieces = [
                    `${value.name}: ${value.message}`,
                ];

                const anyError = value as any;
                if (typeof anyError.cause === 'string') {
                    pieces.push(`cause=${anyError.cause}`);
                } else if (anyError.cause instanceof Error) {
                    pieces.push(`cause=${anyError.cause.name}: ${anyError.cause.message}`);
                }

                if (typeof value.stack === 'string' && value.stack.length > 0) {
                    pieces.push(`stack=${value.stack}`);
                }

                return pieces.join(' | ');
            }

            try {
                return JSON.stringify(value);
            } catch {
                return String(value);
            }
        };

        const errorDescription = describeError(error);
        // eslint-disable-next-line no-console
        console.error('runSampleConversion failed', errorDescription);
        poster('conversionState', { message: 'failed', error: errorDescription });
        throw error;
    }
}

export async function runConversionFromObjPath(
    objAbsolutePath: string,
    poster: TIOSMessagePoster = defaultPoster,
): Promise<TWebHeadlessResult> {
    const bridge = new NativeFileBridge();
    const objFile = new IOSPathFileLike(objAbsolutePath, bridge, 'model/obj');
    const config = createDefaultWebHeadlessConfig(objFile);

    poster('conversionState', { message: 'started' });

    try {
        const result = await runWebHeadless(config);
        poster('conversionComplete', {
            filename: result.filename,
            size: result.content.length,
            base64: bytesToBase64(result.content),
        });
        poster('conversionState', { message: 'finished' });
        return result;
    } catch (error: any) {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        // eslint-disable-next-line no-console
        console.error('runConversionFromObjPath failed', message);
        poster('conversionState', { message: 'failed', error: message });
        throw error;
    }
}
