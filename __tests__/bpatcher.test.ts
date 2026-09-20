/**
 * Tests for the EPROM Patcher functionality
 */

import { readLegacyRomName, patchRom, convertDate, PATCH_DATA_CHECKSUM_PATTERN, PATCH_DATA_CHECKSUM_VALUE, PATCH_DATA_DATE_PATTERN, PATCH_DATA_ZULASSUNG_PATTERN, PATCH_DATA_INITRAM1_PATTERN, PATCH_DATA_DATUM_UHR_PATTERN, PATCH_DATA_FIXED } from '../src/bpatcher';

describe('EPROM Patcher', () => {
    describe('convertDate', () => {
        it('should convert valid date to BCD format', () => {
            const result = convertDate('20251227');
            expect(result).toEqual(new Uint8Array([0x27, 0x12, 0x25, 0x00]));
        });

        it('should handle edge cases', () => {
            expect(() => convertDate('invalid')).toThrow();
        });

        it('should convert current date', () => {
            const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const result = convertDate(today);
            expect(result).toBeInstanceOf(Uint8Array);
            expect(result.length).toBe(4);
        });

        it('should handle single digit day and month correctly', () => {
            const result = convertDate('20250105');
            expect(result).toEqual(new Uint8Array([0x05, 0x01, 0x25, 0x00]));
        });

        it('should handle leap year date', () => {
            const result = convertDate('20240229');
            expect(result).toEqual(new Uint8Array([0x29, 0x02, 0x24, 0x00]));
        });
    });

    describe('pattern constants', () => {
        it('should have valid pattern constants', () => {
            // Test that patterns are defined and have expected lengths
            expect(PATCH_DATA_CHECKSUM_PATTERN).toBeInstanceOf(Uint8Array);
            expect(PATCH_DATA_CHECKSUM_PATTERN.length).toBe(4);
            
            expect(PATCH_DATA_DATE_PATTERN).toBeInstanceOf(Uint8Array);
            expect(PATCH_DATA_DATE_PATTERN.length).toBe(12);
            
            expect(PATCH_DATA_FIXED).toBeInstanceOf(Uint8Array);
            expect(PATCH_DATA_FIXED.length).toBe(40);
        });
    });
});

jest.setTimeout(10000);

jest.mock('../src/utils/ui', () => ({ downloadBlob: jest.fn(), setProgressState: jest.fn() }));

function fixture(init2 = false): Uint8Array {
    const rom = new Uint8Array(0x100000).fill(0xff);
    rom[6] = 0;
    rom[7] = 0xfc;
    rom.set(PATCH_DATA_CHECKSUM_PATTERN, 0x100);
    rom.set(PATCH_DATA_DATE_PATTERN, 0x120);
    rom.set(PATCH_DATA_ZULASSUNG_PATTERN, 0x140);
    // Independently encoded 68000 instructions, including the fallback branch.
    rom.set(init2 ? [0x0c, 0x80, 0, 0, 0x78, 0x0b, 0x67, 8,
        0x0c, 0x80, 0, 0, 0x78, 0x6a, 0x66, 0x16] : PATCH_DATA_INITRAM1_PATTERN, 0x160);
    rom.set(PATCH_DATA_DATUM_UHR_PATTERN, 0x180);
    rom.set([0, 0, 1, 0x80], 0x1a0);
    return rom;
}

function swap(bytes: Uint8Array): Uint8Array {
    const result = new Uint8Array(bytes);
    for (let i = 0; i < result.length; i += 2) {
        result[i] = bytes[i + 1];
        result[i + 1] = bytes[i];
    }
    return result;
}

describe('safe ROM patching', () => {
    beforeEach(() => {
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });
    afterEach(() => jest.restoreAllMocks());

    it.each(['20250229', '20241301', '20250431', '20250010', '20250100', 'abcdefgh', '00000101'])(
        'rejects invalid date %s', date => expect(() => convertDate(date)).toThrow());

    it.each(['123abc456', '12345678', '1234567890', '-12345678'])(
        'reports invalid registration %s for the fixed block', async zl => {
            const patched = await patchRom(fixture(), '20240229', zl);
            expect(patched.results.fixed).toBe(false);
            expect(patched.results.checksum).toBe(true);
        });

    it('runs only selected patches', async () => {
        const selection = { checksum: true, dateId: false, zulassung: false, initRam: false, datumUhr: false, fixed: false };
        const patched = await patchRom(fixture(), '', '', selection);
        expect(patched.results).toEqual({ checksum: true, dateId: null, zulassung: null, initRam: null, datumUhr: null, fixed: null });
    });

    it.each(['small ROM', 'invalid date', 'invalid registration', 'unchecked fixed block'])(
        'leaves date instructions intact when the fixed block cannot apply: %s', async reason => {
            const source = reason === 'small ROM' ? fixture().slice(0, 0x10000) : fixture();
            const selection = { checksum: true, dateId: true, zulassung: false, initRam: false,
                datumUhr: false, fixed: reason !== 'unchecked fixed block' };
            const patched = await patchRom(source, reason === 'invalid date' ? '20250229' : '20240229',
                reason === 'invalid registration' ? 'invalid' : '123456789', selection);
            expect(patched.results.fixed).toBe(selection.fixed ? false : null);
            expect(patched.results.dateId).toBe(false);
            expect(patched.rom.slice(0x120, 0x12e)).toEqual(source.slice(0x120, 0x12e));
            expect(patched.results.checksum).toBe(true);
        });

    it.each([false, true])('patches all locations using Init-RAM fallback=%s without changing input', async init2 => {
        const source = fixture(init2);
        const original = source.slice();
        const patched = await patchRom(source, '20240229', '123456789');
        const result = patched.rom;
        expect(Buffer.from(source).equals(Buffer.from(original))).toBe(true);
        expect(Object.values(patched.results)).toEqual([true, true, true, true, true, true]);
        expect(result.slice(0x100, 0x104)).toEqual(PATCH_DATA_CHECKSUM_VALUE);
        expect(result.slice(0x12a, 0x12e)).toEqual(new Uint8Array([0, 15, 255, 4]));
        expect(result.slice(0x14c, 0x150)).toEqual(new Uint8Array([0, 15, 255, 12]));
        expect(result.slice(init2 ? 0x16e : 0x166, init2 ? 0x170 : 0x168))
            .toEqual(new Uint8Array(init2 ? [0x4e, 0x71] : [0, 2]));
        expect(result[0x18e]).toBe(0x20);
        expect(result.slice(0x1ae, 0x1b0)).toEqual(new Uint8Array([0, 0]));
        expect(result.slice(0xfff00, 0xfff04)).toEqual(new Uint8Array([0x29, 2, 0x24, 0]));
        expect(new DataView(result.buffer).getUint32(0xfff1a)).toBe(123456789);
    });

    it.each([
        [0x100, 'checksum'], [0x120, 'dateId'], [0x140, 'zulassung'],
        [0x160, 'initRam'], [0x180, 'datumUhr'], [0x1a0, 'datumUhr']
    ] as const)('reports a missing pattern at %s and applies the remaining patches', async (offset, key) => {
        const source = fixture();
        source.fill(0xff, offset, offset + 16);
        const patched = await patchRom(source, '20240229', '123456789');
        expect(patched.results[key]).toBe(false);
        expect(patched.results.fixed).toBe(true);
    });

    it('allows an older ROM without the fixed block', async () => {
        const patched = await patchRom(fixture().slice(0, 0x10000), '20240229', '123456789');
        expect(patched.results.fixed).toBe(false);
        expect(patched.results.checksum).toBe(true);
    });

    it('relocates the fixed block and all pointers for a 512 KiB ROM', async () => {
        const patched = await patchRom(fixture().slice(0, 0x80000), '20240229', '123456789');
        const view = new DataView(patched.rom.buffer);
        expect(patched.results.fixed).toBe(true);
        expect(patched.results.dateId).toBe(true);
        expect(view.getUint32(0x12a)).toBe(0x7ff04);
        expect(view.getUint32(0x14c)).toBe(0x7ff0c);
        expect(view.getUint32(0x7ff06)).toBe(0x7ff00);
        expect(patched.rom.slice(0x7ff00, 0x7ff04)).toEqual(new Uint8Array([0x29, 2, 0x24, 0]));
        expect(view.getUint32(0x7ff1a)).toBe(123456789);
    });

    it.each([0x80000, 0x100000])('does not overwrite occupied fixed-block space in a ROM of size %s', async size => {
        const source = fixture().slice(0, size);
        const address = size === 0x80000 ? 0x7ff00 : 0xfff00;
        source[address + PATCH_DATA_FIXED.length - 1] = 0;
        const patched = await patchRom(source, '20240229', '123456789');
        expect(patched.results.fixed).toBe(false);
        expect(patched.results.dateId).toBe(false);
        expect(patched.rom.slice(address, address + 40)).toEqual(source.slice(address, address + 40));
        expect(patched.rom.slice(0x120, 0x12e)).toEqual(source.slice(0x120, 0x12e));
    });

    it('reports a reference whose patch would exceed the ROM', async () => {
        const source = fixture();
        source.fill(0xff, 0x1a0, 0x1a4);
        source.set([0, 0, 1, 0x80], source.length - 4);
        expect((await patchRom(source, '20240229', '123456789')).results.datumUhr).toBe(false);
    });

    it.each([false, true])('preserves single-file byte order and supports retries (swapped=%s)', async swapped => {
        const globals = globalThis as any;
        const oldWindow = globals.window;
        const oldDocument = globals.document;
        const ui = require('../src/utils/ui');
        ui.downloadBlob.mockClear();
        globals.window = { location: { hostname: 'localhost' } };
        try {
            jest.isolateModules(() => require('../src/bpatcher'));
            const source = fixture();
            const input = swapped ? swap(source) : source;
            const fields: Record<string, unknown> = {
                singleRom: { files: [{ name: 'test.bin', arrayBuffer: async () => input.slice().buffer }] },
                dateInput: { value: '20240229' },
                zlInput: { value: '123456789' },
                ...Object.fromEntries(['patchChecksum', 'patchDateId', 'patchZulassung', 'patchInitRam', 'patchDatumUhr', 'patchFixed']
                    .map(id => [id, { checked: true, classList: { add: jest.fn(), remove: jest.fn() } }]))
            };
            globals.document = { getElementById: (id: string) => fields[id] || null };
            expect(await globals.window.loadSingleFile()).toBe(true);
            expect(await globals.window.patchEPROM()).toBe(true);
            expect(await globals.window.patchEPROM()).toBe(true);
            expect(ui.downloadBlob).toHaveBeenCalledTimes(2);
            const first = new Uint8Array(await ui.downloadBlob.mock.calls[0][0].arrayBuffer());
            const second = new Uint8Array(await ui.downloadBlob.mock.calls[1][0].arrayBuffer());
            expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);
            const expected = (await patchRom(source, '20240229', '123456789')).rom;
            expect(Buffer.from(first).equals(Buffer.from(swapped ? swap(expected) : expected))).toBe(true);
            (fields.zlInput as any).value = 'invalid';
            expect(await globals.window.patchEPROM()).toBe(true);
            expect(ui.downloadBlob).toHaveBeenCalledTimes(3);
            (fields.zlInput as any).value = '123456789';
            input.fill(0xff, 0x180, 0x190);
            expect(await globals.window.loadSingleFile()).toBe(true);
            expect(await globals.window.patchEPROM()).toBe(true);
            expect(ui.downloadBlob).toHaveBeenCalledTimes(4);
            expect((fields.patchDatumUhr as any).classList.add).toHaveBeenLastCalledWith('is-invalid');
            expect((fields.patchChecksum as any).classList.add).toHaveBeenLastCalledWith('is-valid');
            (fields.patchFixed as any).checked = false;
            (fields.patchFixed as any).classList.add.mockClear();
            expect(await globals.window.patchEPROM()).toBe(true);
            expect((fields.patchFixed as any).classList.add).not.toHaveBeenCalled();
            expect((fields.patchFixed as any).classList.remove).toHaveBeenCalledWith('is-valid', 'is-invalid');
        } finally {
            if (oldWindow === undefined) delete globals.window;
            else globals.window = oldWindow;
            if (oldDocument === undefined) delete globals.document;
            else globals.document = oldDocument;
        }
    });
});


describe('legacy 16-bit ROM names', () => {
    it.each([
        [1, '  DIAMANT KRONE ', 'DIAMANT KRONE'],
        [3, ' G I G A    C C ', 'G I G A    C C'],
        [2, '  DIAMANT KRONE ', 'DIAMANT KRONE']
    ] as const)('reads the display name at marker offset %s', (offset, name, expected) => {
        const text = new TextEncoder().encode(`MAX. 100 SPIELE \0${name}\0\xff NEXT STRING`);
        const rom = new Uint8Array(offset + text.length);
        rom.set(text, offset);
        expect(readLegacyRomName(rom)).toBe(expected);
    });

    it.each(['MAX. 100 SPIELE \0SHORT', 'MAX. 100 SPIELE \0                \0', 'unrelated text'])(
        'ignores missing, truncated or empty names', text => {
            expect(readLegacyRomName(new TextEncoder().encode(text))).toBeNull();
        });
});
