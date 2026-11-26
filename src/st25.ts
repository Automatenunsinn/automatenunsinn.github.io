import { getInputValue, setInputValue, setupNvramEditor } from './utils/ui.js';
import { parseCompactDate } from './utils/date.js';

const IMAGE_SIZE = 0x2000;
const MIN_IMAGE_SIZE = 0x1FF8; // Clock registers may be omitted from the dump.

const EXPIRY_OFFSET = 0x1FDE;

export function encodeExpiryDate(value: string): Uint8Array {
    const date = parseCompactDate(value);
    // The ST25 formula uses DDMMYYYY, while the page accepts YYYYMMDD.
    const dateInt = date.getUTCDate() * 1000000 + (date.getUTCMonth() + 1) * 10000 + date.getUTCFullYear();
    const bytes = new Uint8Array(8);
    new DataView(bytes.buffer).setUint32(0, dateInt * 9 - 65, true);
    for (let i = 0; i < 4; i++) bytes[i + 4] = bytes[i] ^ 0xFF;
    return bytes;
}

export function readExpiryDate(image: Uint8Array): string | null {
    if (image.length < MIN_IMAGE_SIZE || image.length > IMAGE_SIZE) return null;
    for (let i = 0; i < 4; i++) {
        if ((image[EXPIRY_OFFSET + i] ^ image[EXPIRY_OFFSET + i + 4]) !== 0xFF) return null;
    }
    const encoded = new DataView(image.buffer, image.byteOffset, image.byteLength).getUint32(EXPIRY_OFFSET, true);
    const dateInt = (encoded + 65) / 9;
    if (!Number.isInteger(dateInt)) return null;
    const ddmmyyyy = dateInt.toString().padStart(8, '0');
    const value = ddmmyyyy.slice(4) + ddmmyyyy.slice(2, 4) + ddmmyyyy.slice(0, 2);
    try {
        parseCompactDate(value);
        return value;
    } catch (_) {
        return null;
    }
}

export function patchExpiryDate(image: Uint8Array, expiry: string): Uint8Array {
    if (image.length < MIN_IMAGE_SIZE || image.length > IMAGE_SIZE) {
        throw new Error('Die NVRAM-Datei muss 8184 bis 8192 Bytes (0x1FF8–0x2000) groß sein.');
    }
    const result = new Uint8Array(image);
    result.set(encodeExpiryDate(expiry), EXPIRY_OFFSET);
    return result;
}

setupNvramEditor({
    patch: image => patchExpiryDate(image, getInputValue('dateInput').replace(/-/g, '')),
    suffix: '_st25',
    validateSize: size => size >= MIN_IMAGE_SIZE && size <= IMAGE_SIZE,
    sizeError: 'Bitte eine NVRAM-Datei mit 8184 bis 8192 Bytes (0x1FF8–0x2000) auswählen.',
    onLoadStart: () => setInputValue('gameName', ''),
    populateFields: image => {
        const nameBytes = image.subarray(0x1F20, 0x1F30);
        const nameEnd = nameBytes.findIndex(byte => byte === 0 || byte === 0xFF);
        const gameName = String.fromCharCode(...nameBytes.subarray(0, nameEnd < 0 ? nameBytes.length : nameEnd)).trim();
        setInputValue('gameName', gameName);
        const storedDate = readExpiryDate(image);
        setInputValue('dateInput', storedDate
            ? `${storedDate.slice(0, 4)}-${storedDate.slice(4, 6)}-${storedDate.slice(6, 8)}`
            : '');
        return storedDate;
    }
});
