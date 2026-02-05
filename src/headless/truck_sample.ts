import TRUCK_MTL_SOURCE from '../../3dmodels/truck/model-mobile.mtl';
import TRUCK_OBJ_SOURCE from '../../3dmodels/truck/model-mobile.obj';
import TRUCK_AO_DATA_URI from '../../3dmodels/truck/model-mobile/baked_mesh_8bb8eb53_ao0.png?inline';
import TRUCK_NORMAL_DATA_URI from '../../3dmodels/truck/model-mobile/baked_mesh_8bb8eb53_norm0.png?inline';
import TRUCK_DIFFUSE_DATA_URI from '../../3dmodels/truck/model-mobile/baked_mesh_8bb8eb53_tex0.png?inline';

import { DataUriFileLike } from './data_uri_file_like';
import { InMemoryFileLike } from './in_memory_file_like';

function assertPngDataUri(name: string, value: string): string {
    if (!value.startsWith('data:image/png')) {
        const preview = value.slice(0, 40);
        throw new Error(`Expected inline PNG data URI for '${name}', got '${preview}'`);
    }
    return value;
}

export function createBundledTruckObjFile(): InMemoryFileLike {
    return new InMemoryFileLike({
        name: 'model-mobile.obj',
        content: TRUCK_OBJ_SOURCE,
        type: 'model/obj',
        siblings: {
            'model-mobile.mtl': TRUCK_MTL_SOURCE,
            'model-mobile/baked_mesh_8bb8eb53_ao0.png': new DataUriFileLike({
                name: 'baked_mesh_8bb8eb53_ao0.png',
                dataUri: assertPngDataUri('baked_mesh_8bb8eb53_ao0.png', TRUCK_AO_DATA_URI),
                type: 'image/png',
            }),
            'model-mobile/baked_mesh_8bb8eb53_norm0.png': new DataUriFileLike({
                name: 'baked_mesh_8bb8eb53_norm0.png',
                dataUri: assertPngDataUri('baked_mesh_8bb8eb53_norm0.png', TRUCK_NORMAL_DATA_URI),
                type: 'image/png',
            }),
            'model-mobile/baked_mesh_8bb8eb53_tex0.png': new DataUriFileLike({
                name: 'baked_mesh_8bb8eb53_tex0.png',
                dataUri: assertPngDataUri('baked_mesh_8bb8eb53_tex0.png', TRUCK_DIFFUSE_DATA_URI),
                type: 'image/png',
            }),
        },
    });
}
