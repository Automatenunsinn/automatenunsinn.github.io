import { patchEEPROM } from '../src/eeprom';

describe('patchEEPROM', () => {
    test('writes newData at the given offset', () => {
        const file = new Uint8Array([0, 0, 0, 0, 0, 0]).buffer;
        const result = patchEEPROM({
            file,
            startOffset: 2,
            newData: new Uint8Array([0xaa, 0xbb]),
        });
        expect(Array.from(result)).toEqual([0, 0, 0xaa, 0xbb, 0, 0]);
    });

    test('leaves the file unchanged when newData is empty', () => {
        const file = new Uint8Array([1, 2, 3]).buffer;
        const result = patchEEPROM({ file, startOffset: 0, newData: new Uint8Array([]) });
        expect(Array.from(result)).toEqual([1, 2, 3]);
    });

    test('can overwrite from offset 0', () => {
        const file = new Uint8Array([1, 2, 3, 4]).buffer;
        const result = patchEEPROM({
            file,
            startOffset: 0,
            newData: new Uint8Array([9, 9]),
        });
        expect(Array.from(result)).toEqual([9, 9, 3, 4]);
    });

    test('returns the same length as the input file', () => {
        const file = new Uint8Array(16).buffer;
        const result = patchEEPROM({
            file,
            startOffset: 4,
            newData: new Uint8Array([1, 2, 3]),
        });
        expect(result.length).toBe(16);
    });

    test('throws when the patch would exceed the file bounds', () => {
        const file = new Uint8Array(4).buffer;
        expect(() =>
            patchEEPROM({ file, startOffset: 3, newData: new Uint8Array([1, 2, 3]) })
        ).toThrow();
    });
});
