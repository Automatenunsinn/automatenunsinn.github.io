import { swappedCopy, interleaveBytes, deinterleaveBytes } from './utils/binary.js';
import { downloadBlob } from './utils/ui.js';
function outputFilename(filename, change) {
    const extensionIndex = filename.lastIndexOf('.');
    const hasExtension = extensionIndex > 0;
    const name = hasExtension ? filename.slice(0, extensionIndex) : filename;
    const extension = hasExtension ? filename.slice(extensionIndex) : '.bin';
    return `${name}_${change}${extension}`;
}
function searchString(uint8Array, searchString) {
    const searchStringBytes = new TextEncoder().encode(searchString);
    if (searchStringBytes.length === 0)
        return -1;
    for (let i = 0; i <= uint8Array.length - searchStringBytes.length; i++) {
        let match = true;
        for (let j = 0; j < searchStringBytes.length; j++) {
            if (uint8Array[i + j] !== searchStringBytes[j]) {
                match = false;
                break;
            }
        }
        if (match)
            return i;
    }
    return -1;
}
/** Return a copy with the bytes in each 16-bit word exchanged. */
export function swapBytes(data) {
    if (data.length % 2 !== 0) {
        throw new Error("Die Dateigröße muss gerade sein.");
    }
    return swappedCopy(data);
}
function setFileError(id, message) {
    const field = document.getElementById(id);
    const feedbackId = id + 'Feedback';
    const feedback = document.getElementById(feedbackId);
    field.classList.toggle('is-invalid', Boolean(message));
    field.setAttribute('aria-describedby', feedbackId);
    if (message)
        field.setAttribute('aria-invalid', 'true');
    else
        field.removeAttribute('aria-invalid');
    feedback.textContent = message;
}
async function mergeROMs() {
    setFileError('highRom', '');
    setFileError('lowRom', '');
    const highFile = document.getElementById("highRom").files?.[0];
    const lowFile = document.getElementById("lowRom").files?.[0];
    if (!highFile || !lowFile) {
        if (!highFile)
            setFileError('highRom', 'Bitte eine Odd ROM-Datei auswählen.');
        if (!lowFile)
            setFileError('lowRom', 'Bitte eine Even ROM-Datei auswählen.');
        return;
    }
    const [highBuf, lowBuf] = await Promise.all([highFile.arrayBuffer(), lowFile.arrayBuffer()]);
    const high = new Uint8Array(highBuf);
    const low = new Uint8Array(lowBuf);
    if (high.length !== low.length) {
        setFileError('highRom', 'Die Dateien müssen die gleiche Größe haben.');
        setFileError('lowRom', 'Die Dateien müssen die gleiche Größe haben.');
        return;
    }
    const merged = interleaveBytes(high, low);
    downloadBlob(new Blob([merged.slice().buffer], { type: "application/octet-stream" }), outputFilename(highFile.name, "merged_16bit"));
}
async function splitROM() {
    setFileError('fullRom', '');
    const fullFile = document.getElementById("fullRom").files?.[0];
    if (!fullFile) {
        setFileError('fullRom', 'Bitte eine 16-bit ROM Datei auswählen.');
        return;
    }
    const buf = await fullFile.arrayBuffer();
    const full = new Uint8Array(buf);
    if (full.length % 2 !== 0) {
        setFileError('fullRom', 'Die Dateigröße muss gerade sein.');
        return;
    }
    const [high, low] = deinterleaveBytes(full);
    downloadBlob(new Blob([high.slice().buffer], { type: "application/octet-stream" }), outputFilename(fullFile.name, "odd"));
    downloadBlob(new Blob([low.slice().buffer], { type: "application/octet-stream" }), outputFilename(fullFile.name, "even"));
}
async function byteSwapROM() {
    setFileError('byteswapRom', '');
    const input = document.getElementById("byteswapRom").files?.[0];
    if (!input) {
        setFileError('byteswapRom', 'Bitte eine ROM-Datei auswählen.');
        return;
    }
    const data = new Uint8Array(await input.arrayBuffer());
    if (data.length % 2 !== 0) {
        setFileError('byteswapRom', 'Die Dateigröße muss gerade sein.');
        return;
    }
    const swapped = swapBytes(data);
    downloadBlob(new Blob([swapped.slice().buffer], { type: "application/octet-stream" }), outputFilename(input.name, "byteswapped"));
}
if (typeof document !== 'undefined') {
    document.addEventListener('change', event => {
        const field = event.target;
        if (['highRom', 'lowRom'].includes(field.id)) {
            setFileError('highRom', '');
            setFileError('lowRom', '');
        }
        else if (['fullRom', 'byteswapRom'].includes(field.id)) {
            setFileError(field.id, '');
        }
    });
}
if (typeof window !== 'undefined') {
    window.mergeROMs = mergeROMs;
    window.splitROM = splitROM;
    window.byteSwapROM = byteSwapROM;
}
