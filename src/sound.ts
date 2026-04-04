// WebSerial type definitions based on WebIDL specification
interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
}

interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
}

interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
}

interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
}

interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: "none" | "even" | "odd";
    bufferSize?: number;
    flowControl?: "none" | "hardware";
}

interface Serial extends EventTarget {
    onconnect: EventHandler;
    ondisconnect: EventHandler;
    getPorts(): Promise<SerialPort[]>;
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

type EventHandler = ((this: Serial, ev: Event) => any) | null;

declare global {
    interface Navigator {
        serial: Serial;
    }
}


// Constants
const KILL_COMMAND = 0x05;
// TODO: Add sound file URL when available
const BASE_URL = "";

// State variables
let commandBuffer: Uint8Array = new Uint8Array([KILL_COMMAND]);
let fileData: Uint8Array = new Uint8Array();
let stopUpload = false;

// Serial port
let port: SerialPort | null = null;

function log(msg: string): void {
    const logArea = document.getElementById('logArea') as HTMLTextAreaElement | null;
    if (logArea) {
        logArea.value += msg + '\n';
        logArea.scrollTop = logArea.scrollHeight;
    }
    console.log(msg);
}

function setStatus(msg: string): void {
    console.log('Status:', msg);
}

function updateProgress(value: number, max?: number): void {
    const progress = document.getElementById('progressBar') as HTMLProgressElement | null;
    if (progress) {
        if (max !== undefined) {
            progress.max = max;
        }
        if (value === 0 && max === 100) {
            progress.value = 0;
            progress.max = 100;
        } else {
            progress.value = value;
        }
    }
}

function updateFileInfo(info: string): void {
    const fileInfoEl = document.getElementById('fileInfo') as HTMLElement | null;
    if (fileInfoEl) {
        fileInfoEl.textContent = info;
    }
}

async function writeData(data: Uint8Array, delayMs: number = 2): Promise<void> {
    if (!port || !port.writable) return;

    const writer = port.writable.getWriter();
    try {
        if (delayMs === 0) {
            await writer.write(data);
        } else {
            for (const byte of data) {
                await writer.write(new Uint8Array([byte]));
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    } finally {
        writer.releaseLock();
    }
}

// Load file from URL
async function loadFileFromUrl(url: string): Promise<Uint8Array | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        log('❌ Fehler beim Laden: ' + error);
        return null;
    }
}

// Load file from dropdown selection
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

// Load custom bin file from user's computer
async function loadCustomFile(): Promise<void> {
    updateProgress(0, 100);

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

// Upload file to device
async function uploadFile(): Promise<boolean> {
    if (!port || !port.writable) {
        log('Nicht verbunden!');
        return false;
    }

    if (fileData.length === 0) {
        log('Keine Datei geladen!');
        return false;
    }

    const EXPECTED_SIZE = 0x200000; // 2MB
    if (fileData.length !== EXPECTED_SIZE) {
        log(`⚠️ Dateigröße ist ${fileData.length} Bytes, erwartet ${EXPECTED_SIZE} Bytes (2MB)`);
    }

    log('Flashed Datei...');
    setStatus('Flashe...');

    try {
        const total = 0x80000; // 512KB per chunk
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
            await writeData(chunk, 0);
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

// Connect to serial port
async function connect(): Promise<void> {
    const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;

    try {
        if (port) {
            await port.close();
            port = null;

            if (connectBtn) {
                connectBtn.textContent = 'Verbinden';
                connectBtn.className = '';
            }

            const killBtn = document.getElementById('killBtn') as HTMLButtonElement | null;
            if (killBtn) killBtn.disabled = true;

            const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
            if (flashBtn) flashBtn.disabled = true;

            setStatus('Getrennt');
            return;
        }

        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 57600 });

        if (connectBtn) {
            connectBtn.textContent = 'Trennen';
            connectBtn.className = 'success';
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
        if (connectBtn) connectBtn.className = 'failure';
    }
}

// Send kill command (clear)
async function sendKillCommand(): Promise<void> {
    if (!port || !port.writable) {
        log('Nicht verbunden!');
        return;
    }

    log('Sende Clear...');
    setStatus('Sende Clear...');

    try {
        await writeData(commandBuffer, 2);
        log('Clear gesendet.');
        setStatus('Clear gesendet');
    } catch (e) {
        log('Fehler: ' + e);
    }
}

// Initialize event listeners
if (typeof window !== 'undefined') {
    // Add event listener for DOM content loaded
    document.addEventListener('DOMContentLoaded', () => {

        document.getElementById('connectBtn')?.addEventListener('click', connect);
        document.getElementById('loadFileBtn')?.addEventListener('click', loadFromDropdown);
        document.getElementById('loadCustomFileBtn')?.addEventListener('click', loadCustomFile);
        document.getElementById('killBtn')?.addEventListener('click', sendKillCommand);
        document.getElementById('flashBtn')?.addEventListener('click', uploadFile);
    });
}

export { };
