import abCheck from './abCheck';
import { SerialPort } from './types/webserial';
import { assembleChunks } from './utils/serial';
import { downloadBlob, setButtonState } from './utils/ui';

let port: SerialPort | null = null;
let logBuffer: string[] = [];

const encoder = new TextEncoder();
const logArea = document.getElementById('logArea') as HTMLTextAreaElement;
const sendCommandField = document.getElementById('sendCommandField') as HTMLInputElement;

function lockDeviceSelection(): void {
    (document.getElementsByName('size') as NodeListOf<HTMLInputElement>).forEach(r => r.disabled = true);
}

function log(text: string): void {
    const line = `[${new Date().toISOString().substring(11, 19)}] ${text}`;
    logBuffer.push(line);
    logArea.value = logBuffer.join('\n');
    logArea.scrollTop = logArea.scrollHeight;
}

function buildVdaiCode(): string {
    let code = '';

    code += (document.getElementById('vdaiDelete') as HTMLInputElement).checked ? 'L' : 'l';

    const eg = (document.querySelector('input[name="eg"]:checked') as HTMLInputElement)?.value;
    code += eg ?? ' ';

    code += (document.getElementById('vdaiStat') as HTMLInputElement).checked ? 'S' : ' ';
    code += (document.getElementById('vdaiLast20') as HTMLInputElement).checked ? 'L' : ' ';
    code += (document.getElementById('vdaiCopy') as HTMLInputElement).checked ? 'K' : ' ';
    code += (document.getElementById('vdaiCheck') as HTMLInputElement).checked ? 'C' : ' ';

    return code.padEnd(17, ' ');
}

function buildVdaiCommand(code: string): Uint8Array {
    const paddedCode = code.padEnd(17, ' ');
    const body = encoder.encode(paddedCode + '\n');
    const combined = new Uint8Array(2 + body.length);
    combined[0] = 0x05;
    combined[1] = 0x1B;
    combined.set(body, 2);
    return combined;
}

function updateVdaiCode(): void {
    sendCommandField.value = buildVdaiCode();
}

function updateVisibility(): void {
    const selected = (document.querySelector('input[name="size"]:checked') as HTMLInputElement)?.value;
    (document.getElementById('vdaiOptions') as HTMLFieldSetElement).style.display = selected === 'vdai' ? 'block' : 'none';
    (document.getElementById('adpaltOptions') as HTMLFieldSetElement).style.display = selected === 'adpalt' ? 'block' : 'none';
}

const baudRateMap: Record<string, number> = {
    adpalt: 4800, adp: 4800, bally: 110, berg: 110, vdai: 9600
};

function getSelectedBaudRate(): number {
    const selected = (document.querySelector('input[name="size"]:checked') as HTMLInputElement)?.value;
    return baudRateMap[selected] || 9600;
}

function writeSerial(data: Uint8Array | string): Promise<void> {
    if (!port?.writable) return Promise.resolve();
    const writer = port.writable.getWriter();
    return writer.write(typeof data === 'string' ? encoder.encode(data) : data)
        .finally(() => writer.releaseLock());
}

function logReceivedData(data: Uint8Array, label: string = 'Ausgabe'): void {
    const decoder = new TextDecoder('iso-8859-1', { fatal: false });
    const lines = decoder.decode(data).split(/[\r\n]+/).filter(l => l.trim().length > 0);
    log(`--- ${label} (${lines.length} Zeilen) ---`);
    lines.forEach(log);
    log(`--- Ende ---`);
    log(`Insgesamt ${data.length} Bytes empfangen.`);
}

async function runEinsatProtocol(): Promise<void> {
    if (!port?.writable || !port?.readable) return;
    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    try {
        log('Sende Initialisierung...');
        await writer.write(encoder.encode('OKOKEINSAT'));

        log('Warte auf Handshake...');
        const { value: handshake } = await reader.read();
        log(`Handshake erhalten: 0x${handshake![0].toString(16)}`);

        log('Sende Handshake-Bestätigung...');
        await writer.write(encoder.encode('@'));

        log('Lese Daten...');
        while (true) {
            const { value: chunk, done } = await reader.read();
            if (done) break;
            chunks.push(chunk);
            totalLength += chunk.length;
            for (let i = 0; i < chunk.length; i++) await writer.write(encoder.encode('@'));
        }
    } catch (e) {
        log(`Fehler: ${e}`);
    } finally {
        writer.releaseLock();
        reader.releaseLock();
        downloadResult(assembleChunks(chunks, totalLength));
    }
}

async function syncTime(): Promise<void> {
    const timeInput = document.getElementById('adpaltTime') as HTMLInputElement;
    if (!port?.writable || !timeInput.value) return;

    const d = new Date(timeInput.value);
    const timeString = `**ZEIT*:${d.getHours().toString().padStart(2,'0')}${d.getMinutes().toString().padStart(2,'0')}${d.getDate().toString().padStart(2,'0')}${(d.getMonth()+1).toString().padStart(2,'0')}${(d.getFullYear()%100).toString().padStart(2,'0')}0000\r`;
    log(`Sende Zeit: ${timeString}`);
    try {
        await writeSerial(timeString);
        log('Zeit gesendet.');
    } catch (e) {
        log(`Fehler beim Senden der Zeit: ${e}`);
    }
}

async function sendCommand(cmd: string): Promise<void> {
    try {
        log(`Sende Befehl: ${cmd}`);
        await writeSerial(cmd + '\r');
        log('Befehl gesendet.');
    } catch (e) {
        log(`Fehler beim Senden: ${e}`);
    }
}

function setupEventListeners(): void {
    const inputIds = ['vdaiDelete', 'vdaiStat', 'vdaiLast20', 'vdaiCopy', 'vdaiCheck'];
    inputIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateVdaiCode);
        else console.warn(`Element ${id} not found.`);
    });

    document.querySelectorAll('input[name="eg"]').forEach(el => {
        el.addEventListener('change', () => { updateVdaiCode(); });
    });

    document.getElementsByName('size').forEach(el => el.addEventListener('change', updateVisibility));

    document.getElementById('adpaltTimeBtn')!.addEventListener('click', syncTime);
    document.getElementById('ramsetBtn')!.addEventListener('click', () => sendCommand('RAMSET'));
    document.getElementById('seriniBtn')!.addEventListener('click', () => sendCommand('SERINI'));
    document.getElementById('giradaBtn')!.addEventListener('click', () => sendCommand('GIRADA'));
    document.getElementById('rsokBtn')!.addEventListener('click', () => sendCommand('RSOK'));
    document.getElementById('milBtn')!.addEventListener('click', () => sendCommand('MILLIONENSPIEL'));

    document.getElementById('connectBtn')!.addEventListener('click', async () => {
        const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement;
        const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;

        lockDeviceSelection();
        try {
            log('Serieller Port anfordern...');
            port = await navigator.serial.requestPort();
            const baudRate = getSelectedBaudRate();
            log(`Port öffnen (${baudRate} baud)...`);
            await port.open({ baudRate });
            connectBtn.disabled = true;
            setButtonState(connectBtn, 'success');
            log('Verbindung hergestellt.');
            sendBtn.disabled = !abCheck();
        } catch (error) {
            log(`Fehler: ${error}`);
            setButtonState(connectBtn, 'failure');
            (document.getElementsByName('size') as NodeListOf<HTMLInputElement>).forEach(r => r.disabled = false);
        }
    });

    document.getElementById('sendBtn')!.addEventListener('click', async () => {
        if (!port?.writable) return;

        const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
        sendBtn.disabled = true;
        setButtonState(sendBtn, 'default');

        const selected = (document.querySelector('input[name="size"]:checked') as HTMLInputElement)?.value;
        if (selected === 'adp') {
            await runEinsatProtocol();
            sendBtn.disabled = false;
            return;
        }

        try {
            const code = buildVdaiCode();
            log(`VDAI-Code: "${code}"`);
            const command = buildVdaiCommand(code);
            log(`Sende ${command.length} Bytes über serielle Schnittstelle.`);

            for (let i = 0; i < command.length; i++) {
                const byte = command[i];
                const hex = byte.toString(16).toUpperCase().padStart(2, '0');
                const char = byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : '.';
                log(`  Byte ${i.toString().padStart(3, ' ')}: 0x${hex}${byte === 0x1B ? ' (ESC)' : ` ('${char}')`}`);
            }

            const writer = port.writable.getWriter();
            await writer.write(command);
            writer.releaseLock();
            log('Befehl gesendet.');

            await new Promise(resolve => setTimeout(resolve, 100));
            setButtonState(sendBtn, 'success');
            log('Auslesen gestartet. Druckerausgabe folgt.');
            await readPrintOutput();
        } catch (error) {
            log(`Fehler beim Senden: ${error}`);
            setButtonState(sendBtn, 'failure');
        } finally {
            sendBtn.disabled = false;
        }
    });
}

async function readPrintOutput(): Promise<void> {
    if (!port?.readable || !port?.writable) return;

    const reader = port.readable.getReader();
    const writer = port.writable.getWriter();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;
    let synReceived = false;

    try {
        while (true) {
            const result = await Promise.race([
                reader.read(),
                new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
            ]);
            if (result.done) break;

            const chunk = result.value;
            chunks.push(chunk);
            totalLength += chunk.length;

            const hexStr = Array.from(chunk).slice(0, 64).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            log(`Empfangen: ${chunk.length} Bytes | ${hexStr}${chunk.length > 64 ? '...' : ''}`);

            if (!synReceived && chunk.includes(0x16)) {
                synReceived = true;
                log('ASCII-22 (SYN) empfangen, sende Bestätigung...');
                await writer.write(new Uint8Array([0x16]));
                log('Bestätigung gesendet.');
            }
        }
        log('Übertragung abgeschlossen.');
    } catch (error) {
        if (error instanceof Error && error.message === 'Timeout') {
            log('Zeitüberschreitung beim Lesen – Übertragung vermutlich abgeschlossen.');
        } else {
            log(`Fehler beim Empfang: ${error}`);
            reader.releaseLock();
            writer.releaseLock();
            return;
        }
    }

    if (!synReceived) {
        log('Kein ASCII-22 (SYN) empfangen – sende trotzdem Bestätigung...');
        await writer.write(new Uint8Array([0x16]));
    }

    const fullData = assembleChunks(chunks, totalLength);
    logReceivedData(fullData);
    downloadResult(fullData);

    try {
        log('Port schließen...');
        await port.close();
        log('Fertig.');
    } catch (e) {
        log(`Fehler beim Schließen des Ports: ${e}`);
    } finally {
        reader.releaseLock();
        writer.releaseLock();
    }
}

function downloadResult(data: Uint8Array): void {
    if (data.length < 8) return;
    downloadBlob(new Blob([data.buffer as ArrayBuffer], { type: 'text/plain; charset=iso-8859-1' }), `vdai_${new Date().toISOString().substring(0, 10)}.txt`);
}

if (typeof window !== 'undefined') {
    updateVdaiCode();
    updateVisibility();
    setupEventListeners();
}
