import { InMemoryFileLike } from '../src/headless/in_memory_file_like';

test('InMemoryFileLike resolves siblings by relative path and basename', async () => {
    const source = new InMemoryFileLike({
        name: 'house.obj',
        content: 'mtllib materials/base.mtl',
        siblings: {
            'materials/base.mtl': 'newmtl base',
        },
    });

    const relativeHit = await source.getSibling?.('materials/base.mtl');
    expect(relativeHit).toBeDefined();
    expect(await relativeHit?.text()).toContain('newmtl');

    const basenameHit = await source.getSibling?.('base.mtl');
    expect(basenameHit).toBeDefined();
    expect(await basenameHit?.text()).toContain('newmtl');
});
