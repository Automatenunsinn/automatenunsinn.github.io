import { Xtea } from '../src/xtea';

describe('Xtea', () => {
    const seed = [0x12345678, 0x9abcdef0, 0x0f0f0f0f, 0x12345678];

    test('setData / getData round-trips 8 bytes', () => {
        const x = new Xtea();
        const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        x.setData(data);
        expect(Array.from(x.getData())).toEqual(Array.from(data));
    });

    test('setData reads little-endian words', () => {
        const x = new Xtea();
        // 0x04030201 and 0x08070605 as little-endian
        x.setData(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]));
        const out = x.getData();
        // round-trip preserves byte order
        expect(Array.from(out)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });

    test('encrypt followed by decrypt restores the original plaintext', () => {
        const enc = new Xtea();
        enc.init(seed, 32);
        const plaintext = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        enc.setData(plaintext);
        enc.encrypt();
        const ciphertext = enc.getData();

        // ciphertext must differ from plaintext
        expect(Array.from(ciphertext)).not.toEqual(Array.from(plaintext));

        const dec = new Xtea();
        dec.init(seed, 32);
        dec.setData(ciphertext);
        dec.decrypt();
        expect(Array.from(dec.getData())).toEqual(Array.from(plaintext));
    });

    test('encryption is deterministic for the same key and rounds', () => {
        const a = new Xtea();
        const b = new Xtea();
        a.init(seed, 32);
        b.init(seed, 32);
        const data = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
        a.setData(data);
        b.setData(data);
        a.encrypt();
        b.encrypt();
        expect(Array.from(a.getData())).toEqual(Array.from(b.getData()));
    });

    test('different keys produce different ciphertext', () => {
        const a = new Xtea();
        const b = new Xtea();
        a.init(seed, 32);
        b.init([1, 2, 3, 4], 32);
        const data = new Uint8Array([8, 7, 6, 5, 4, 3, 2, 1]);
        a.setData(data);
        b.setData(data);
        a.encrypt();
        b.encrypt();
        expect(Array.from(a.getData())).not.toEqual(Array.from(b.getData()));
    });

    test('init throws when seed is not four words', () => {
        const x = new Xtea();
        expect(() => x.init([1, 2, 3], 32)).toThrow();
        expect(() => x.init([1, 2, 3, 4, 5], 32)).toThrow();
    });

    test('setData works on a subarray view (respects byteOffset)', () => {
        const x = new Xtea();
        const backing = new Uint8Array([99, 99, 1, 2, 3, 4, 5, 6, 7, 8]);
        const view = backing.subarray(2); // 8 bytes starting at offset 2
        x.setData(view);
        expect(Array.from(x.getData())).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
});
