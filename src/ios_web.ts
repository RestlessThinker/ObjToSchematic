import { installIOSConsoleBridge, runSampleConversion } from './headless/ios_bridge';

type TBridgeResult = {
    filename: string,
    size: number,
};

declare global {
    interface Window {
        ObjToSchematicIOSBridge: {
            runSampleConversionForTesting: () => Promise<TBridgeResult>,
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

function setupUI(): void {
    installIOSConsoleBridge();

    const button = document.getElementById('convert-btn') as HTMLButtonElement | null;
    if (button !== null) {
        button.addEventListener('click', () => {
            void runFromButton();
        });
    }

    window.ObjToSchematicIOSBridge = {
        runSampleConversionForTesting: async () => {
            const result = await runSampleConversion();
            return {
                filename: result.filename,
                size: result.content.length,
            };
        },
    };

    setStatus('Ready. Tap Convert Truck OBJ.');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupUI);
} else {
    setupUI();
}
