import { assembleChunks } from '../src/utils/serial';

describe('assembleChunks', () => {
    test('concatenates chunks in order', () => {
        const result = assembleChunks(
            [new Uint8Array([1, 2]), new Uint8Array([3]), new Uint8Array([4, 5])],
            5
        );
        expect(Array.from(result)).toEqual([1, 2, 3, 4, 5]);
    });

    test('returns a buffer of the requested total length', () => {
        const result = assembleChunks([new Uint8Array([1, 2])], 5);
        expect(result.length).toBe(5);
        // trailing bytes are zero-filled
        expect(Array.from(result)).toEqual([1, 2, 0, 0, 0]);
    });

    test('handles an empty chunk list', () => {
        const result = assembleChunks([], 0);
        expect(result.length).toBe(0);
    });

    test('ignores empty chunks', () => {
        const result = assembleChunks(
            [new Uint8Array([1]), new Uint8Array([]), new Uint8Array([2])],
            2
        );
        expect(Array.from(result)).toEqual([1, 2]);
    });
});
