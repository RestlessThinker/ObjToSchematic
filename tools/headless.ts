import fs from 'fs/promises';
import path from 'path';

import JSZip from 'jszip';

import { TStructureExport } from '../src/exporters/base_exporter';
import { StatusHandler } from '../src/status';
import { LOG_MAJOR, Logger, TIME_END, TIME_START } from '../src/util/log_util';
import { AppPaths, PathUtil } from '../src/util/path_util';
import { WorkerClient } from '../src/worker_client';
import { AssignParams, ExportParams, ImportParams, VoxeliseParams } from '../src/worker_types';
import { ProgressManager } from '../src/progress';

export type THeadlessConfig = {
    import: ImportParams.Input,
    voxelise: VoxeliseParams.Input,
    assign: AssignParams.Input,
    export: ExportParams.Input,
    debug: {
        showLogs: boolean,
        showWarnings: boolean,
        showTimings: boolean,
    }
}

async function writeStructureToDisk(structure: TStructureExport, sourceFileName: string) {
    const outputDirectory = PathUtil.join(AppPaths.Get.gen, 'headless');
    await fs.mkdir(outputDirectory, { recursive: true });

    const parsedName = path.parse(sourceFileName);
    const baseName = parsedName.name.length > 0 ? parsedName.name : 'export';

    if (structure.type === 'single') {
        const outputPath = PathUtil.join(outputDirectory, `${baseName}_OTS${structure.extension}`);
        await fs.writeFile(outputPath, structure.content);
        return outputPath;
    }

    const zip = new JSZip();
    structure.regions.forEach((region) => {
        zip.file(`ots_${region.name}${structure.extension}`, region.content);
    });

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    const outputPath = PathUtil.join(outputDirectory, `${baseName}_OTS.zip`);
    await fs.writeFile(outputPath, zipBuffer);
    return outputPath;
}

export async function runHeadless(headlessConfig: THeadlessConfig) {
    ProgressManager.Get.clear();

    if (headlessConfig.debug.showLogs) {
        Logger.Get.enableLOG();
        Logger.Get.enableLOGMAJOR();
    }
    if (headlessConfig.debug.showWarnings) {
        Logger.Get.enableLOGWARN();
    }
    if (headlessConfig.debug.showTimings) {
        Logger.Get.enableLOGTIME();
    }

    const worker = WorkerClient.Get;
    let exportPath = '';
    {
        TIME_START('[TIMER] Importer');
        LOG_MAJOR('\nImporting...');
        await worker.import(headlessConfig.import);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Importer');
    }
    {
        TIME_START('[TIMER] Voxeliser');
        LOG_MAJOR('\nVoxelising...');
        worker.voxelise(headlessConfig.voxelise);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Voxeliser');
    }
    {
        TIME_START('[TIMER] Assigner');
        LOG_MAJOR('\nAssigning...');
        worker.assign(headlessConfig.assign);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Assigner');
    }
    {
        TIME_START('[TIMER] Exporter');
        LOG_MAJOR('\nExporting...');

        /**
         * The OBJExporter is unique in that it uses the actual render buffer used by WebGL
         * to create its data, in headless mode this render buffer is not created so we must
         * generate it manually
         */
        {
            let result;
            do {
                result = worker.renderChunkedVoxelMesh({
                    enableAmbientOcclusion: headlessConfig.voxelise.enableAmbientOcclusion,
                    desiredHeight: headlessConfig.voxelise.size,
                });
            } while (result.moreVoxelsToBuffer);
        }

        const exportResult = worker.export(headlessConfig.export);
        exportPath = await writeStructureToDisk(exportResult.files, headlessConfig.import.file.name);
        StatusHandler.Get.dump().clear();
        TIME_END('[TIMER] Exporter');
    }

    ProgressManager.Get.clear();

    return exportPath;
}
