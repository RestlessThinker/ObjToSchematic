import JSZip from 'jszip';

import { PALETTE_ALL_RELEASE } from '../../res/palettes/all';
import { FallableBehaviour } from '../block_mesh';
import { TStructureExport } from '../exporters/base_exporter';
import { ProgressManager } from '../progress';
import { StatusHandler } from '../status';
import { ColourSpace } from '../util';
import { FileLike } from '../util/file_like';
import { LOG_MAJOR, Logger, TIME_END, TIME_START } from '../util/log_util';
import { WorkerClient } from '../worker_client';
import { AssignParams, ExportParams, ImportParams, VoxeliseParams } from '../worker_types';
import { Vector3 } from '../vector';

const DEFAULT_FALLABLE: FallableBehaviour = 'replace-falling';

export type TWebHeadlessConfig = {
    import: ImportParams.Input,
    voxelise: VoxeliseParams.Input,
    assign: AssignParams.Input,
    export: ExportParams.Input,
    debug?: {
        showLogs: boolean,
        showWarnings: boolean,
        showTimings: boolean,
    }
};

export type TWebHeadlessResult = {
    filename: string,
    extension: string,
    mimeType: string,
    content: Uint8Array,
};

function getFileBaseName(fileName: string): string {
    const parts = fileName.split('/').pop()?.split('\\').pop()?.split('.') ?? ['export'];
    if (parts.length <= 1) {
        return parts[0] || 'export';
    }
    return parts.slice(0, parts.length - 1).join('.') || 'export';
}

function toUint8Array(content: unknown): Uint8Array {
    if (content instanceof Uint8Array) {
        return content;
    }
    if (content instanceof ArrayBuffer) {
        return new Uint8Array(content);
    }
    if (typeof content === 'string') {
        return new TextEncoder().encode(content);
    }

    throw new Error('Unsupported exported content format');
}

async function toWebHeadlessResult(files: TStructureExport, sourceFileName: string): Promise<TWebHeadlessResult> {
    const baseName = getFileBaseName(sourceFileName);

    if (files.type === 'single') {
        return {
            filename: `${baseName}_OTS${files.extension}`,
            extension: files.extension,
            mimeType: 'application/octet-stream',
            content: toUint8Array(files.content),
        };
    }

    const zip = new JSZip();
    files.regions.forEach((region) => {
        zip.file(`ots_${region.name}${files.extension}`, region.content);
    });

    return {
        filename: `${baseName}_OTS.zip`,
        extension: '.zip',
        mimeType: 'application/zip',
        content: await zip.generateAsync({ type: 'uint8array' }),
    };
}

export function createDefaultWebHeadlessConfig(file: FileLike): TWebHeadlessConfig {
    return {
        import: {
            file,
            rotation: new Vector3(0, 0, 0),
        },
        voxelise: {
            constraintAxis: 'y',
            voxeliser: 'ncrb',
            size: 80,
            useMultisampleColouring: true,
            voxelOverlapRule: 'average',
            enableAmbientOcclusion: true,
        },
        assign: {
            textureAtlas: 'vanilla',
            blockPalette: PALETTE_ALL_RELEASE,
            dithering: 'ordered',
            ditheringMagnitude: 32,
            colourSpace: ColourSpace.RGB,
            fallable: DEFAULT_FALLABLE,
            resolution: 32,
            calculateLighting: false,
            lightThreshold: 1,
            contextualAveraging: true,
            errorWeight: 0.02,
        },
        export: {
            exporter: 'schem',
        },
        debug: {
            showLogs: true,
            showWarnings: true,
            showTimings: true,
        },
    };
}

export async function runWebHeadless(config: TWebHeadlessConfig): Promise<TWebHeadlessResult> {
    ProgressManager.Get.clear();

    const debugConfig = config.debug;
    if (debugConfig?.showLogs) {
        Logger.Get.enableLOG();
        Logger.Get.enableLOGMAJOR();
    }
    if (debugConfig?.showWarnings) {
        Logger.Get.enableLOGWARN();
    }
    if (debugConfig?.showTimings) {
        Logger.Get.enableLOGTIME();
    }

    const worker = WorkerClient.Get;
    let stage = 'initialise';
    try {
        stage = 'import';
        TIME_START('[TIMER] Importer');
        LOG_MAJOR('\nImporting...');
        await worker.import(config.import);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Importer');

        stage = 'voxelise';
        TIME_START('[TIMER] Voxeliser');
        LOG_MAJOR('\nVoxelising...');
        worker.voxelise(config.voxelise);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Voxeliser');

        stage = 'assign';
        TIME_START('[TIMER] Assigner');
        LOG_MAJOR('\nAssigning...');
        worker.assign(config.assign);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Assigner');

        stage = 'export';
        TIME_START('[TIMER] Exporter');
        LOG_MAJOR('\nExporting...');

        let renderResult;
        do {
            renderResult = worker.renderChunkedVoxelMesh({
                enableAmbientOcclusion: config.voxelise.enableAmbientOcclusion,
                desiredHeight: config.voxelise.size,
            });
        } while (renderResult.moreVoxelsToBuffer);

        const exportResult = worker.export(config.export);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Exporter');

        ProgressManager.Get.clear();
        return toWebHeadlessResult(exportResult.files, config.import.file.name);
    } catch (error: unknown) {
        const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
        throw new Error(`runWebHeadless failed during '${stage}': ${message}`);
    }
}
