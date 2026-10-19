import { downloadUint8Array, getInputValue, setElementText } from './utils/ui';

const IMAGE_SIZE = 0x2000;

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
        const file = input.files?.[0];
        if (!file || file.size !== IMAGE_SIZE) {
            setElementText('statusText', 'Bitte eine NVRAM-Datei mit genau 8192 Bytes (0x2000) auswählen.');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (version !== loadVersion) return;
            loadedImage = new Uint8Array(reader.result as ArrayBuffer);
            loadedName = file.name;
            button.disabled = false;
            const storedDate = readTimekeeper(loadedImage);
            (document.getElementById('timeInput') as HTMLInputElement).value = storedDate ?? '';
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

function bcd(value: number): number {
    return Math.floor(value / 10) * 16 + value % 10;
}

export function readTimekeeper(image: Uint8Array): string | null {
    if (image.length !== IMAGE_SIZE) return null;
    // Mask the oscillator STOP bit and reserved bits before decoding BCD.
    const registers = [
        image[0x1FFF], image[0x1FFE] & 0x1F, image[0x1FFD] & 0x3F,
        image[0x1FFB] & 0x3F, image[0x1FFA] & 0x7F, image[0x1FF9] & 0x7F
    ];
    if (registers.some(value => (value & 15) > 9 || (value >> 4) > 9)) return null;
    const parts = registers.map(value => ((value >> 4) * 10 + (value & 15)).toString().padStart(2, '0'));
    const [year, month, day, hour, minute, second] = parts;
    try {
        parseDate('20' + year + month + day);
        if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null;
        return `20${year}-${month}-${day}T${hour}:${minute}:${second}`;
    } catch (_) {
        return null;
    }
}

export function patchTimekeeper(image: Uint8Array, clock: string): Uint8Array {
    if (image.length !== IMAGE_SIZE) {
        throw new Error('Die NVRAM-Datei muss genau 8192 Bytes (0x2000) groß sein.');
    }
    const result = new Uint8Array(image);
    const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.000)?)?$/.exec(clock);
    if (!match) throw new Error('Bitte ein gültiges Timekeeper-Datum mit Uhrzeit eingeben.');
    const date = parseDate(match[1] + match[2] + match[3]);
    const hour = Number(match[4]);
    const minute = Number(match[5]);
    const second = Number(match[6] || '0');
    if (date.getUTCFullYear() < 2000 || date.getUTCFullYear() > 2099 ||
        hour > 23 || minute > 59 || second > 59) {
        throw new Error('Die Timekeeper-Uhrzeit muss zwischen 2000 und 2099 liegen und gültig sein.');
    }
    // M48T18 register map (datasheet p. 15): preserve calibration,
    // release R/W latches, clear STOP and frequency-test flags.
    result[0x1FF8] &= 0x3F;
    result.set([
        bcd(second), bcd(minute), bcd(hour), date.getUTCDay() + 1,
        bcd(date.getUTCDate()), bcd(date.getUTCMonth() + 1), bcd(date.getUTCFullYear() % 100)
    ], 0x1FF9);
    return result;
}

setupNvramEditor(image => patchTimekeeper(image, getInputValue('timeInput')), '_tk');
