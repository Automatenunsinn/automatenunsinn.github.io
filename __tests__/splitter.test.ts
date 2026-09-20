import { swapBytes } from '../src/splitter';

describe('swapBytes', () => {
  test('exchanges bytes in each 16-bit word', () => {
    expect(Array.from(swapBytes(new Uint8Array([0x12, 0x34, 0xab, 0xcd]))))
      .toEqual([0x34, 0x12, 0xcd, 0xab]);
  });

  test('rejects odd-sized input', () => {
    expect(() => swapBytes(new Uint8Array([0x12]))).toThrow('gerade');
  });
});
