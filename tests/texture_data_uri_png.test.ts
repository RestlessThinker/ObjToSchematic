import { PNG } from 'pngjs';

import { Texture } from '../src/texture';

function createOnePixelPngBytes(): Buffer {
    const png = new PNG({ width: 1, height: 1 });
    png.data[0] = 255;
    png.data[1] = 128;
    png.data[2] = 64;
    png.data[3] = 255;
    return PNG.sync.write(png);
}

test('Texture accepts valid PNG data URIs', () => {
    const pngBytes = createOnePixelPngBytes();
    const raw = `data:image/png;base64,${pngBytes.toString('base64')}`;

    const texture = new Texture({
        diffuse: {
            filetype: 'png',
            raw,
        },
        transparency: {
            type: 'None',
        },
    });

    const rgba = texture.getRGBA({ u: 0.5, v: 0.5 } as any, 'nearest', 'clamp');
    expect(rgba.a).toBeGreaterThan(0);
});

test('Texture accepts URL-encoded PNG data URIs (non-base64 form)', () => {
    const pngBytes = createOnePixelPngBytes();
    const binary = pngBytes.toString('latin1');
    const raw = `data:image/png,${encodeURIComponent(binary)}`;

    const texture = new Texture({
        diffuse: {
            filetype: 'png',
            raw,
        },
        transparency: {
            type: 'None',
        },
    });

    const rgba = texture.getRGBA({ u: 0.5, v: 0.5 } as any, 'nearest', 'clamp');
    expect(rgba.a).toBeGreaterThan(0);
});

test('Texture base64 decode works without Buffer (browser/atob path)', () => {
    if (typeof atob !== 'function') {
        return;
    }

    const pngBytes = createOnePixelPngBytes();
    const raw = `data:image/png;base64,${pngBytes.toString('base64')}`;

    const originalAtob = globalThis.atob;
    let atobWasCalled = false;
    globalThis.atob = (encoded: string): string => {
        atobWasCalled = true;
        return originalAtob(encoded);
    };

    try {
        const texture = new Texture({
            diffuse: {
                filetype: 'png',
                raw,
            },
            transparency: {
                type: 'None',
            },
        });

        const rgba = texture.getRGBA({ u: 0.5, v: 0.5 } as any, 'nearest', 'clamp');
        expect(rgba.a).toBeGreaterThan(0);
        expect(atobWasCalled).toBe(true);
    } finally {
        globalThis.atob = originalAtob;
    }
});
