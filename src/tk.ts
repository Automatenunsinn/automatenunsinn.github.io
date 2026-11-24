import { getInputValue, setInputValue, setupNvramEditor } from './utils/ui';
import { parseCompactDate } from './utils/date';

const IMAGE_SIZE = 0x2000;

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
        parseCompactDate('20' + year + month + day);
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
    const date = parseCompactDate(match[1] + match[2] + match[3]);
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

setupNvramEditor({
    patch: image => patchTimekeeper(image, getInputValue('timeInput')),
    suffix: '_tk',
    validateSize: size => size === IMAGE_SIZE,
    sizeError: 'Bitte eine NVRAM-Datei mit genau 8192 Bytes (0x2000) auswählen.',
    populateFields: image => {
        const storedDate = readTimekeeper(image);
        setInputValue('timeInput', storedDate ?? '');
        return storedDate;
    }
});
