import { DataUriFileLike } from '../src/headless/data_uri_file_like';
import { InMemoryFileLike } from '../src/headless/in_memory_file_like';
import { ObjImporter } from '../src/importers/obj_importer';
import { MaterialType } from '../src/mesh';
import { TEST_PREAMBLE } from './preamble';

const ONE_PIXEL_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Z6YQAAAAASUVORK5CYII=';

test('ObjImporter loads map_Kd texture from data URI backed FileLike', async () => {
    TEST_PREAMBLE();

    const objSource = [
        'mtllib model.mtl',
        'usemtl truck',
        'v 0 0 0',
        'v 1 0 0',
        'v 0 1 0',
        'f 1 2 3',
    ].join('\n');

    const mtlSource = [
        'newmtl truck',
        'map_Kd tex.png',
    ].join('\n');

    const objFile = new InMemoryFileLike({
        name: 'model.obj',
        content: objSource,
        siblings: {
            'model.mtl': mtlSource,
            'tex.png': new DataUriFileLike({
                name: 'tex.png',
                type: 'image/png',
                dataUri: `data:image/png;base64,${ONE_PIXEL_PNG}`,
            }),
        },
    });

    const mesh = await new ObjImporter().import(objFile);
    const material = mesh.getMaterials().get('truck');

    expect(material).toBeDefined();
    expect(material?.type).toBe(MaterialType.textured);
});
