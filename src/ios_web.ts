import { installIOSConsoleBridge, runConversionFromObjPath, runSampleConversion } from './headless/ios_bridge';

type TBridgeResult = {
    filename: string,
    size: number,
    error?: string,
};

declare global {
    interface Window {
        ObjToSchematicIOSBridge: {
            runSampleConversionForTesting: () => Promise<TBridgeResult>,
            runConversionFromObjPathForTesting: (objPath: string) => Promise<TBridgeResult>,
        }
    }
}

function setStatus(message: string): void {
    const status = document.getElementById('status');
    if (status !== null) {
        status.textContent = message;
    }
}

async function runFromButton(): Promise<void> {
    const button = document.getElementById('convert-btn') as HTMLButtonElement | null;
    if (button !== null) {
        button.disabled = true;
    }

    setStatus('Running conversion...');

    try {
        const result = await runSampleConversion();
        setStatus(`Done: ${result.filename} (${result.content.length} bytes)`);
    } catch (error: any) {
        setStatus(`Failed: ${String(error)}`);
    } finally {
        if (button !== null) {
            button.disabled = false;
        }
    }
}

function installBridge(): void {
    installIOSConsoleBridge();

    window.ObjToSchematicIOSBridge = {
        runSampleConversionForTesting: async () => {
            try {
                const result = await runSampleConversion();
                return {
                    filename: result.filename,
                    size: result.content.length,
                };
            } catch (error: any) {
                return {
                    filename: '',
                    size: 0,
                    error: String(error),
                };
            }
        },
        runConversionFromObjPathForTesting: async (objPath: string) => {
            try {
                const result = await runConversionFromObjPath(objPath);
                return {
                    filename: result.filename,
                    size: result.content.length,
                };
            } catch (error: any) {
                return {
                    filename: '',
                    size: 0,
                    error: String(error),
                };
            }
        },
    };
}

function setupUI(): void {
    const button = document.getElementById('convert-btn') as HTMLButtonElement | null;
    if (button !== null) {
        button.addEventListener('click', () => {
            void runFromButton();
        });
    }

    setStatus('Ready. Tap Convert Demo OBJ.');
}

installBridge();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUI);
} else {
    setupUI();
}
