import './register-node-loaders';

import { LOG_MAJOR, LOG_ERROR } from '../src/util/log_util';
import { AppPaths } from '../src/util/path_util';
import { runHeadless } from './headless';
import { createHeadlessConfig } from './headless-config';

void async function main() {
    AppPaths.Get.setBaseDir(process.cwd());

    try {
        const [, , ...args] = process.argv;
        const objPath = args[0];
        const headlessConfig = await createHeadlessConfig(objPath);
        const outputPath = await runHeadless(headlessConfig);
        LOG_MAJOR(`\nFinished! Export written to ${outputPath}`);
    } catch (error) {
        LOG_MAJOR('\nHeadless run failed.');
        LOG_ERROR(error);
        throw error;
    }
}();
