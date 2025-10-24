import './register-node-loaders';

import { LOG_MAJOR } from '../src/util/log_util';
import { AppPaths } from '../src/util/path_util';
import { runHeadless } from './headless';
import { headlessConfig } from './headless-config';

void async function main() {
    AppPaths.Get.setBaseDir(process.cwd());

    try {
        const outputPath = await runHeadless(headlessConfig);
        LOG_MAJOR(`\nFinished! Export written to ${outputPath}`);
    } catch (error) {
        LOG_MAJOR('\nHeadless run failed.');
        throw error;
    }
}();
