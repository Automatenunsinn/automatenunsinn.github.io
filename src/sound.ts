import { SerialPort } from './types/webserial';
import { writePort, loadFileFromUrl } from './utils/serial';
import { disableControls, log, clearLog, setStatus, updateProgress, updateFileInfo, setButtonState } from './utils/ui';
import { SOUND_BASE_URL, soundFileMappings } from './fileMappings';

const KILL_COMMAND = 0x05;
const EXPECTED_SIZE = 0x200000;

let commandBuffer: Uint8Array = new Uint8Array([KILL_COMMAND]);
let fileData: Uint8Array = new Uint8Array();
let stopUpload = false;
let flashing = false;
let fileLoadId = 0;

let port: SerialPort | null = null;

function populateFileSelect(): void {
    const select = document.getElementById('fileSelect') as HTMLSelectElement | null;
    if (!select) return;

    select.innerHTML = '<option value="">-- Datei auswählen --</option>';
    for (const filename of soundFileMappings) {
        const option = document.createElement('option');
        option.value = filename;
        option.textContent = filename.replace(/\.bin$/i, '');
        select.appendChild(option);
    }
}

function beginFileLoad(): number {
    fileData = new Uint8Array();
    updateFileInfo('_');
    updateProgress(0);
    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn) flashBtn.disabled = true;
    return ++fileLoadId;
}

function validateFileSize(filename: string, size: number): boolean {
    if (size === EXPECTED_SIZE) return true;

    log(`Ungültige Dateigröße für ${filename}: ${size} Bytes. Erwartet werden ${EXPECTED_SIZE} Bytes (2 MiB).`);
    setStatus('Ungültige Dateigröße');
    return false;
}

function setLoadedFile(filename: string, data: Uint8Array): void {
    fileData = data;
    log(`Geladen: ${filename} (${data.length} Bytes)`);
    updateFileInfo(filename);
    setStatus('Datei geladen');

    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn) flashBtn.disabled = false;
}

async function loadFromDropdown(): Promise<void> {
    const select = document.getElementById('fileSelect') as HTMLSelectElement | null;
    if (!select || !select.value) {
        log('Keine Datei ausgewählt!');
        return;
    }

    const filename = select.value;
    const loadId = beginFileLoad();
    log(`Lade ${filename}...`);

    const data = await loadFileFromUrl(`${SOUND_BASE_URL}/${encodeURIComponent(filename)}`);
    if (loadId !== fileLoadId) return;
    if (!data) {
        log('❌ Fehler beim Laden der Datei!');
        return;
    }

    if (validateFileSize(filename, data.length)) setLoadedFile(filename, data);
}

async function loadCustomFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.bin';

    input.onchange = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file || flashing) return;

        const loadId = beginFileLoad();
        if (!validateFileSize(file.name, file.size)) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            if (loadId !== fileLoadId) return;
            setLoadedFile(file.name, new Uint8Array(arrayBuffer));
        } catch (e) {
            if (loadId === fileLoadId) log('Fehler beim Laden der Datei: ' + e);
        }
    };

    input.click();
}

async function uploadFile(): Promise<boolean> {
    if (flashing) return false;
    if (!port || !port.writable) {
        log('Nicht verbunden!');
        return false;
    }

    if (fileData.length !== EXPECTED_SIZE) {
        log('Keine Datei geladen!');
        return false;
    }

    log('Sende Datei...');
    setStatus('Flashe...');
    flashing = true;
    const restoreControls = disableControls(
        '#fileSelect, #loadFileBtn, #loadCustomFileBtn, #flashBtn, #connectBtn'
    );

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
    } finally {
        flashing = false;
        restoreControls();
    }
}

async function connect(): Promise<void> {
    const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;
    const fileSelect = document.getElementById('fileSelect') as HTMLSelectElement | null;
    const loadFileBtn = document.getElementById('loadFileBtn') as HTMLButtonElement | null;

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

            if (fileSelect) fileSelect.disabled = true;
            if (loadFileBtn) loadFileBtn.disabled = true;

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
        if (fileSelect) fileSelect.disabled = false;
        if (loadFileBtn) loadFileBtn.disabled = false;
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
        populateFileSelect();

        document.getElementById('connectBtn')?.addEventListener('click', connect);
        document.getElementById('loadFileBtn')?.addEventListener('click', loadFromDropdown);
        document.getElementById('loadCustomFileBtn')?.addEventListener('click', loadCustomFile);
        document.getElementById('killBtn')?.addEventListener('click', sendKillCommand);
        document.getElementById('flashBtn')?.addEventListener('click', uploadFile);
    });
}

export { };
