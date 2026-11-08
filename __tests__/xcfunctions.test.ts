import { createHash } from 'crypto';
import { crc32 } from 'crc';
import { dumpXcInfo } from '../src/xcfunctions';

function makeImage(length: number): Uint8Array {
    const data = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        data[i] = (i * 7 + 3) & 0xff;
    }
    return data;
}

describe('dumpXcInfo hashes', () => {
    it.each([0x101, 0x105, 0x1000, 1000])(
        'computes the real MD5 of a %i byte image',
        (length) => {
            const data = makeImage(length);
            const info = dumpXcInfo(data);
            expect(info).not.toBeNull();
            expect(info!.md5).toBe(createHash('md5').update(data).digest('hex'));
        }
    );

    it.each([0x101, 0x1000])('computes the CRC32 of a %i byte image', (length) => {
        const data = makeImage(length);
        const info = dumpXcInfo(data);
        expect(info!.crc32).toBe(
            crc32(Buffer.from(data)).toString(16).padStart(8, '0')
        );
    });

    it('skips hashing when calculateHashes is false', () => {
        const info = dumpXcInfo(makeImage(0x101), false);
        expect(info!.md5).toBe('');
        expect(info!.crc32).toBe('');
    });

    it('returns null for images that are too small', () => {
        expect(dumpXcInfo(new Uint8Array(0x100))).toBeNull();
    });
});
