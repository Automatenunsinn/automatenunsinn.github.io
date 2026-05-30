import { SerialPort } from './types/webserial';
import { writePort, loadFileFromUrl } from './utils/serial';
import { log, clearLog, setStatus, updateProgress, updateFileInfo, setButtonState } from './utils/ui';

const KILL_COMMAND = 0x05;
const BASE_URL = "";

let commandBuffer: Uint8Array = new Uint8Array([KILL_COMMAND]);
let fileData: Uint8Array = new Uint8Array();
let stopUpload = false;

let port: SerialPort | null = null;

async function loadFromDropdown(): Promise<void> {
    const select = document.getElementById('fileSelect') as HTMLSelectElement | null;
    if (!select || !select.value) {
        log('Keine Datei ausgewählt!');
        return;
    }

    const filename = select.value;
    log(`Lade ${filename}...`);

    const data = await loadFileFromUrl(`${BASE_URL}/${filename}`);
    if (!data) {
        log('❌ Fehler beim Laden der Datei!');
        return;
    }

    fileData = data;
    log(`Geladen: ${filename} (${fileData.length} Bytes)`);
    updateFileInfo(filename);

    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn) flashBtn.disabled = false;
}

async function loadCustomFile(): Promise<void> {
    updateProgress(0);

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin';

    input.onchange = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            fileData = new Uint8Array(arrayBuffer);

            log(`Geladen: ${file.name} (${fileData.length} Bytes)`);
            updateFileInfo(file.name);

            const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
            if (flashBtn) flashBtn.disabled = false;
        } catch (e) {
            log('Fehler beim Laden der Datei: ' + e);
        }
    };

    input.click();
}

async function uploadFile(): Promise<boolean> {
    if (!port || !port.writable) {
        log('Nicht verbunden!');
        return false;
    }

    if (fileData.length === 0) {
        log('Keine Datei geladen!');
        return false;
    }

    const EXPECTED_SIZE = 0x200000;
    if (fileData.length !== EXPECTED_SIZE) {
        log(`⚠️ Dateigröße ist ${fileData.length} Bytes, erwartet ${EXPECTED_SIZE} Bytes (2MB)`);
    }

    log('Flashed Datei...');
    setStatus('Flashe...');

    try {
        const total = 0x80000;
        updateProgress(0, total);
        stopUpload = false;

        let num = 0;
        while (num < total) {
            if (stopUpload) {
                log('Abgebrochen!');
                return false;
            }

            if (num + 0x180000 >= fileData.length) {
                log('❌ Die Datei ist zu klein für den Upload!');
                return false;
            }
            const chunk = new Uint8Array([
                fileData[num],
                fileData[num + 0x80000],
                fileData[num + 0x100000],
                fileData[num + 0x180000]
            ]);
            await writePort(port, chunk, 0);
            updateProgress(num + 1);
            num++;
        }

        log('Flash fertig!');
        setStatus('Fertig!');
        return true;
    } catch (e) {
        log('Flash Fehler: ' + e);
        return false;
    }
}

async function connect(): Promise<void> {
    const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;

    try {
        if (port) {
            await port.close();
            port = null;

            if (connectBtn) {
                connectBtn.textContent = 'Verbinden';
                setButtonState(connectBtn, 'default');
            }

            const killBtn = document.getElementById('killBtn') as HTMLButtonElement | null;
            if (killBtn) killBtn.disabled = true;

            const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
            if (flashBtn) flashBtn.disabled = true;

            setStatus('Getrennt');
            return;
        }

        port = await (navigator as any).serial.requestPort();
        await port!.open({ baudRate: 57600 });

        if (connectBtn) {
            connectBtn.textContent = 'Trennen';
            setButtonState(connectBtn, 'success');
        }
        setStatus('Verbunden');

        const killBtn = document.getElementById('killBtn') as HTMLButtonElement | null;
        if (killBtn) killBtn.disabled = false;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
            log('Kein Gerät ausgewählt.');
        } else {
            log(String(error));
        }
        if (connectBtn) setButtonState(connectBtn, 'failure');
    }
}

async function sendKillCommand(): Promise<void> {
    if (!port || !port.writable) {
        log('Nicht verbunden!');
        return;
    }

    log('Sende Clear...');
    setStatus('Sende Clear...');

    try {
        await writePort(port, commandBuffer, 2);
        log('Clear gesendet.');
        setStatus('Clear gesendet');
    } catch (e) {
        log('Fehler: ' + e);
    }
}

if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        clearLog();

        document.getElementById('connectBtn')?.addEventListener('click', connect);
        document.getElementById('loadFileBtn')?.addEventListener('click', loadFromDropdown);
        document.getElementById('loadCustomFileBtn')?.addEventListener('click', loadCustomFile);
        document.getElementById('killBtn')?.addEventListener('click', sendKillCommand);
        document.getElementById('flashBtn')?.addEventListener('click', uploadFile);
    });
}

export { };
