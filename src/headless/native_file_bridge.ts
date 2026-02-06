export type TFileIORequest = {
    id: string,
    operation: 'readText' | 'readBase64' | 'fileExists',
    path: string,
};

export type TFileIOResponse = {
    id: string,
    ok: boolean,
    text?: string,
    base64?: string,
    exists?: boolean,
    error?: string,
};

type TPendingRequest = {
    resolve: (response: TFileIOResponse) => void,
    reject: (error: Error) => void,
};

const pendingRequests = new Map<string, TPendingRequest>();
let requestCounter = 0;
let resolverInstalled = false;

function ensureResolverInstalled() {
    if (resolverInstalled) {
        return;
    }

    (window as any).__objToSchematicResolveFileIO = (response: TFileIOResponse) => {
        const pending = pendingRequests.get(response.id);
        if (pending === undefined) {
            return;
        }

        pendingRequests.delete(response.id);

        if (!response.ok) {
            pending.reject(new Error(response.error ?? 'Native file I/O failed'));
            return;
        }

        pending.resolve(response);
    };

    resolverInstalled = true;
}

function nextRequestId() {
    requestCounter += 1;
    return `fileio_${requestCounter}`;
}

function postRequest(operation: TFileIORequest['operation'], path: string): Promise<TFileIOResponse> {
    ensureResolverInstalled();

    return new Promise((resolve, reject) => {
        const request: TFileIORequest = {
            id: nextRequestId(),
            operation,
            path,
        };

        pendingRequests.set(request.id, { resolve, reject });

        try {
            const handler = (window as any).webkit?.messageHandlers?.fileIORequest;
            if (handler === undefined || typeof handler.postMessage !== 'function') {
                pendingRequests.delete(request.id);
                reject(new Error('Native fileIORequest handler is unavailable'));
                return;
            }

            handler.postMessage(request);
        } catch (error: any) {
            pendingRequests.delete(request.id);
            reject(error instanceof Error ? error : new Error(String(error)));
        }
    });
}

export class NativeFileBridge {
    public async readText(path: string): Promise<string> {
        const response = await postRequest('readText', path);
        return response.text ?? '';
    }

    public async readBase64(path: string): Promise<string> {
        const response = await postRequest('readBase64', path);
        return response.base64 ?? '';
    }

    public async fileExists(path: string): Promise<boolean> {
        const response = await postRequest('fileExists', path);
        return response.exists === true;
    }
}
