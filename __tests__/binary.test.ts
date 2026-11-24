import { interleaveBytes, deinterleaveBytes } from '../src/utils/binary';

describe('ROM byte lanes', () => {
    test('interleaves lanes in order and splits them back without mutating inputs', () => {
        const first = new Uint8Array([0x12, 0xab]);
        const second = new Uint8Array([0x34, 0xcd]);
        const merged = interleaveBytes(first, second);
        expect(Array.from(merged)).toEqual([0x12, 0x34, 0xab, 0xcd]);
        expect(deinterleaveBytes(merged)).toEqual([first, second]);
        merged.fill(0);
        expect(Array.from(first)).toEqual([0x12, 0xab]);
        expect(Array.from(second)).toEqual([0x34, 0xcd]);
    });

    test('truncates mismatched lanes in either order', () => {
        const short = new Uint8Array([1]);
        const long = new Uint8Array([2, 3]);
        expect(Array.from(interleaveBytes(short, long))).toEqual([1, 2]);
        expect(Array.from(interleaveBytes(long, short))).toEqual([2, 1]);
    });

    test('handles empty lanes and ignores an incomplete final word', () => {
        expect(interleaveBytes(new Uint8Array(), new Uint8Array([1]))).toHaveLength(0);
        expect(deinterleaveBytes(new Uint8Array())).toEqual([new Uint8Array(), new Uint8Array()]);
        expect(deinterleaveBytes(new Uint8Array([1, 2, 3])))
            .toEqual([new Uint8Array([1]), new Uint8Array([2])]);
    });
});
