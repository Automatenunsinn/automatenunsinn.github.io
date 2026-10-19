import { downloadUint8Array, getInputValue, setElementText, setInputValue } from './utils/ui';

const IMAGE_SIZE = 0x2000;
const MIN_IMAGE_SIZE = 0x1FF8; // Clock registers may be omitted from the dump.

declare global {
    interface Window {
        loadTkFile: () => void;
        downloadTk: () => void;
    }
}

function parseDate(value: string): Date {
    if (!/^\d{8}$/.test(value)) {
        throw new Error('Bitte das Datum als JJJJMMTT eingeben.');
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 1000 || date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error('Bitte ein gültiges Datum eingeben.');
    }
    return date;
}

function setupNvramEditor(patch: (image: Uint8Array) => Uint8Array, suffix: string): void {
    let loadedImage: Uint8Array | null = null;
    let loadedName = '';
    let loadVersion = 0;

    function loadTkFile(): void {
        const version = ++loadVersion;
        const input = document.getElementById('singleRom') as HTMLInputElement;
        const button = document.getElementById('downloadButton') as HTMLInputElement;
        loadedImage = null;
        button.disabled = true;
        setInputValue('gameName', '');
        const file = input.files?.[0];
        if (!file || (file.size < MIN_IMAGE_SIZE || file.size > IMAGE_SIZE)) {
            setElementText('statusText', 'Bitte eine NVRAM-Datei mit 8184 bis 8192 Bytes (0x1FF8–0x2000) auswählen.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (version !== loadVersion) return;
            loadedImage = new Uint8Array(reader.result as ArrayBuffer);
            const nameBytes = loadedImage.subarray(0x1F20, 0x1F30);
            const nameEnd = nameBytes.findIndex(byte => byte === 0 || byte === 0xFF);
            const gameName = String.fromCharCode(...nameBytes.subarray(0, nameEnd < 0 ? nameBytes.length : nameEnd)).trim();
            setInputValue('gameName', gameName);
            loadedName = file.name;
            button.disabled = false;
            const storedDate = readExpiryDate(loadedImage);
            setInputValue('dateInput', storedDate
                ? `${storedDate.slice(0, 4)}-${storedDate.slice(4, 6)}-${storedDate.slice(6, 8)}`
                : '');
            setElementText('statusText', `${file.name} geladen (${file.size} Bytes).${storedDate === null ? ' Das gespeicherte Datum ist ungültig. Bitte ein neues Datum eingeben.' : ''}`);
        };
        reader.onerror = () => {
            if (version === loadVersion) setElementText('statusText', 'Die Datei konnte nicht gelesen werden.');
        };
        reader.readAsArrayBuffer(file);
    }

    function downloadTk(): void {
        try {
            if (!loadedImage) throw new Error('Bitte zuerst eine NVRAM-Datei laden.');
            const patched = patch(loadedImage);
            downloadUint8Array(patched, loadedName.replace(/\.[^.]+$/, '') + suffix + '.bin');
            setElementText('statusText', 'Die geänderte NVRAM-Datei wurde erstellt.');
        } catch (error) {
            setElementText('statusText', error instanceof Error ? error.message : String(error));
        }
    }

    if (typeof window !== 'undefined') {
        window.loadTkFile = loadTkFile;
        window.downloadTk = downloadTk;
    }
}

const EXPIRY_OFFSET = 0x1FDE;

export function encodeExpiryDate(value: string): Uint8Array {
    const date = parseDate(value);
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
        parseDate(value);
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

setupNvramEditor(image => patchExpiryDate(image, getInputValue('dateInput').replace(/-/g, '')), '_st25');
