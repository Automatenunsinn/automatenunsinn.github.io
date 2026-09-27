import { downloadBlob, setValidationState } from './utils/ui';

declare global {
    interface Window {
        calcRouletteRequestCode: () => void;
        calculateRouletteCode: () => void;
        downloadRouletteCode: () => void;
    }
}

/** Convert the C: volume serial (shown by `vol C:`) to the request code. */
export function calculateRequestCode(volumeSerial: string): number {
    const serial = parseInt(volumeSerial.replace(/-/g, ''), 16);
    if (Number.isNaN(serial)) {
        throw new Error('Ungültige Volumeseriennummer');
    }

    return (serial + 0x02A3F0B9) & 0x7FFFFFFF;
}

/** Apply the Roulette_akt validation transformation. */
export function calculateResponseCode(requestCode: number): number {
    let code = requestCode & 0x7FFFFFFF;
    code ^= (0xE2A641DB << (code & 15));
    return code & 0x7FFFFFFF;
}

export function calcRouletteRequestCode() {
    const volumeField = document.getElementById('volumeSerial') as HTMLInputElement;
    const requestField = document.getElementById('requestCode') as HTMLInputElement;

    try {
        requestField.value = calculateRequestCode(volumeField.value).toString();
        setValidationState(volumeField, true);
    } catch {
        setValidationState(volumeField, false);
    }
}

export function calculateRouletteCode() {
    const requestField = document.getElementById('requestCode') as HTMLInputElement;
    const outputField = document.getElementById('out') as HTMLInputElement;
    const downloadButton = document.getElementById('downloadButton') as HTMLInputElement;

    try {
        const requestCode = parseInt(requestField.value, 10);
        if (Number.isNaN(requestCode)) {
            throw new Error('Ungültiger Abrufcode');
        }

        setValidationState(requestField, true);
        outputField.value = calculateResponseCode(requestCode).toString();
        outputField.style.animation = 'shine 1s ease-in infinite';
        downloadButton.disabled = false;
    } catch {
        setValidationState(requestField, false);
        downloadButton.disabled = true;
    }
}

export function downloadRouletteCode() {
    const outputField = document.getElementById('out') as HTMLInputElement;
    const registryContent = `Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\\Software\\adp GmbH\\Roulette_akt]
"Reg"="${outputField.value}"`;

    downloadBlob(
        new Blob([registryContent], { type: 'text/plain;charset=utf-8' }),
        'Roulette_akt.reg'
    );
}

function handleUrlParams(): void {
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) {
        const requestField = document.getElementById('requestCode') as HTMLInputElement;
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
