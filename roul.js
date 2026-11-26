import { downloadBlob, setValidationState } from './utils/ui.js';
/** Convert the C: volume serial (shown by `vol C:`) to the request code. */
export function calculateRequestCode(volumeSerial) {
    const serial = parseInt(volumeSerial.replace(/-/g, ''), 16);
    if (Number.isNaN(serial)) {
        throw new Error('Ungültige Volumeseriennummer');
    }
    return (serial + 0x02A3F0B9) & 0x7FFFFFFF;
}
/** Apply the Roulette_akt validation transformation. */
export function calculateResponseCode(requestCode) {
    let code = requestCode & 0x7FFFFFFF;
    code ^= (0xE2A641DB << (code & 15));
    return code & 0x7FFFFFFF;
}
export function calcRouletteRequestCode() {
    const volumeField = document.getElementById('volumeSerial');
    const requestField = document.getElementById('requestCode');
    try {
        requestField.value = calculateRequestCode(volumeField.value).toString();
        setValidationState(volumeField, true);
    }
    catch {
        setValidationState(volumeField, false);
    }
}
export function calculateRouletteCode() {
    const requestField = document.getElementById('requestCode');
    const outputField = document.getElementById('out');
    const downloadButton = document.getElementById('downloadButton');
    try {
        const requestCode = parseInt(requestField.value, 10);
        if (Number.isNaN(requestCode)) {
            throw new Error('Ungültiger Abrufcode');
        }
        setValidationState(requestField, true);
        outputField.value = calculateResponseCode(requestCode).toString();
        outputField.style.animation = 'shine 1s ease-in infinite';
        downloadButton.disabled = false;
    }
    catch {
        setValidationState(requestField, false);
        downloadButton.disabled = true;
    }
}
export function downloadRouletteCode() {
    const outputField = document.getElementById('out');
    const registryContent = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\adp GmbH\\Roulette_akt]
"Reg"="${outputField.value}"`;
    downloadBlob(new Blob([registryContent], { type: 'text/plain;charset=utf-8' }), 'Roulette_akt.reg');
}
function handleUrlParams() {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
        const requestField = document.getElementById('requestCode');
        if (requestField) {
            requestField.value = q;
            calculateRouletteCode();
        }
    }
}
if (typeof window !== 'undefined') {
    window.calcRouletteRequestCode = calcRouletteRequestCode;
    window.calculateRouletteCode = calculateRouletteCode;
    window.downloadRouletteCode = downloadRouletteCode;
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', handleUrlParams);
    }
}
