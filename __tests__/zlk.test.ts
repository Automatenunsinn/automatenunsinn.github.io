import { buildV2Eeprom, patchV1Firmware } from '../src/zlk';

/** Minimal V1 firmware: magic bytes at both ends of a 1 KB image. */
function createV1Firmware(): Uint8Array {
    const firmware = new Uint8Array(1024).fill(0xFF);
    firmware[0] = 0x8C;
    firmware[1] = 0xC0;
    firmware[1022] = 0xA5;
    firmware[1023] = 0xCE;
    return firmware;
}

describe('patchV1Firmware', () => {
    const serial = '123456789';
    const machineBytes = new Uint8Array([0x02, 0x87]); // ADP 1002, PTB "0287"

    test('writes machine code, registration number and date', () => {
        const patched = patchV1Firmware(createV1Firmware(), serial, machineBytes);

        // Machine code (case ID "0287") at offset 534.
        expect(Array.from(patched.slice(534, 538))).toEqual([0x92, 0xE0, 0xA7, 0xE8]);
        // Registration number at offset 556.
        expect(Array.from(patched.slice(556, 566))).toEqual([
            0x91, 0xE0, 0xA3, 0xE2, 0xB5, 0xE4, 0xC7, 0xE6, 0xD9, 0xE8
        ]);
        // Date "00" at offset 566.
        expect(Array.from(patched.slice(566, 570))).toEqual([0xE0, 0xE3, 0xF0, 0xE3]);
    });

    test('keeps size and magic bytes of the base firmware', () => {
        const firmware = createV1Firmware();
        const patched = patchV1Firmware(firmware, serial, machineBytes);

        expect(patched.length).toBe(1024);
        expect([patched[0], patched[1], patched[1022], patched[1023]]).toEqual([0x8C, 0xC0, 0xA5, 0xCE]);
        expect(firmware[534]).toBe(0xFF); // the base firmware is not modified
    });
});

describe('buildV2Eeprom', () => {
    const serial = '123456789';
    const key = 'ADP 1002 (NEW STAR)';

    test('writes serial, date and machine bytes at the expected offsets', () => {
        const eeprom = buildV2Eeprom(serial, key);

        expect(eeprom.length).toBe(256);
        // 5 bytes serial, date 06/32 and the machine bytes of the ADP 1002.
        expect(Array.from(eeprom.slice(0x40, 0x49))).toEqual([
            0x01, 0x23, 0x45, 0x67, 0x89, 0x06, 0x32, 0x02, 0x87
        ]);
        // Serial as ASCII at offset 0x28.
        expect(Array.from(eeprom.slice(0x28, 0x31))).toEqual([
            0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39
        ]);
    });

    test('leaves the rest of the EEPROM untouched', () => {
        const eeprom = buildV2Eeprom(serial, key);
        expect(eeprom[0x4A]).toBe(0x00); // cleared prefix
        expect(eeprom[0xFF]).toBe(0xFF);
    });

    test('throws for an unknown machine', () => {
        expect(() => buildV2Eeprom(serial, 'GIBTS NICHT')).toThrow('Unbekannter Automat.');
    });
});