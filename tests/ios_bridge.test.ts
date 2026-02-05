import { bytesToBase64 } from '../src/headless/ios_bridge';

test('bytesToBase64 encodes expected payload', () => {
    const encoded = bytesToBase64(new Uint8Array([79, 84, 83]));
    expect(encoded).toBe('T1RT');
});
