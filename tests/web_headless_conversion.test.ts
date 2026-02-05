import fs from 'fs/promises';
import path from 'path';
import { TagType, parseUncompressed } from 'prismarine-nbt';
import zlib from 'zlib';

import { InMemoryFileLike } from '../src/headless/in_memory_file_like';
import { createDefaultWebHeadlessConfig, runWebHeadless } from '../src/headless/web_headless';
import { TEST_PREAMBLE } from './preamble';

async function loadFixture(fileName: string): Promise<string> {
    const fixturePath = path.resolve(__dirname, './data', fileName);
    return fs.readFile(fixturePath, 'utf8');
}

test('runWebHeadless converts OBJ fixture to schem output', async () => {
    TEST_PREAMBLE();

    const objSource = await loadFixture('cube.obj');
    const mtlSource = await loadFixture('cube.mtl');

    const objFile = new InMemoryFileLike({
        name: 'cube.obj',
        content: objSource,
        siblings: {
            'cube.mtl': mtlSource,
        },
    });

    const config = createDefaultWebHeadlessConfig(objFile);
    config.voxelise.size = 32;

    const result = await runWebHeadless(config);

    expect(result.filename.endsWith('.schem')).toBe(true);
    expect(result.content.length).toBeGreaterThan(0);

    const nbt = parseUncompressed(zlib.gunzipSync(Buffer.from(result.content)), 'big');
    expect(nbt.name).toBe('Schematic');
    expect(nbt.type).toBe(TagType.Compound);

    const root = nbt.value as any;
    expect(root.Width.value).toBeGreaterThan(0);
    expect(root.Height.value).toBeGreaterThan(0);
    expect(root.Length.value).toBeGreaterThan(0);
    expect(root.BlockData.value.length).toBeGreaterThan(0);
});
