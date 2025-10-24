import fs from 'fs';

/**
 * Webpack handles these imports in the browser build, but when we execute the
 * tooling directly under Node (ts-node) we need to register trivial handlers so
 * `require` can resolve the raw asset files. Without this hook Node throws
 * “Unknown file extension” for `.atlas` files and the headless pipeline aborts
 * immediately.
 */
const extensions = require.extensions as NodeJS.RequireExtensions;

if (!extensions['.atlas']) {
    extensions['.atlas'] = (module, filename) => {
        module.exports = fs.readFileSync(filename, 'utf8');
    };
}

if (!extensions['.png']) {
    extensions['.png'] = (module, filename) => {
        module.exports = filename;
    };
}

if (!extensions['.vs']) {
    extensions['.vs'] = (module, filename) => {
        module.exports = fs.readFileSync(filename, 'utf8');
    };
}

if (!extensions['.fs']) {
    extensions['.fs'] = (module, filename) => {
        module.exports = fs.readFileSync(filename, 'utf8');
    };
}
