import abCheck from './abCheck';
import { SerialPort } from './types/webserial';

let port: SerialPort | null = null;
let logBuffer: string[] = [];

const logArea = document.getElementById('logArea') as HTMLTextAreaElement;
const sendCommandField = document.getElementById('sendCommandField') as HTMLInputElement;

function lockDeviceSelection(): void {
    const radios = document.getElementsByName('size') as NodeListOf<HTMLInputElement>;
    radios.forEach(radio => {
        radio.disabled = true;
    });
}

function log(text: string): void {
    const timestamp = new Date().toISOString().substring(11, 19);
    const line = `[${timestamp}] ${text}`;
    logBuffer.push(line);
    logArea.value = logBuffer.join('\n');
    logArea.scrollTop = logArea.scrollHeight;
}

function buildVdaiCode(): string {
    let code = '';

    // Zeichen 1: l (nicht löschen) or L (löschen)
    const deleteCheck = (document.getElementById('vdaiDelete') as HTMLInputElement).checked;
    code += deleteCheck ? 'L' : 'l';

    // Zeichen 2: Einsatz/Gewinn
    const egEl = document.querySelector('input[name="eg"]:checked') as HTMLInputElement;

    const eg = egEl?.value;
    if (eg) {
        code += eg;
    } else {
        code += ' ';
    }

    // Zeichen 3: S (Statistik) or leer
    const statCheck = (document.getElementById('vdaiStat') as HTMLInputElement).checked;
    code += statCheck ? 'S' : ' ';

    // Zeichen 4: L (letzte 20 Kassierungen) or leer
    const last20Check = (document.getElementById('vdaiLast20') as HTMLInputElement).checked;
    code += last20Check ? 'L' : ' ';

    // Zeichen 5: K (Kopie) or leer
    const copyCheck = (document.getElementById('vdaiCopy') as HTMLInputElement).checked;
    code += copyCheck ? 'K' : ' ';

    // Zeichen 6: C (Checksumme) or leer
    const checkCheck = (document.getElementById('vdaiCheck') as HTMLInputElement).checked;
    code += checkCheck ? 'C' : ' ';

    // Zeichen 7-17: mit Blanks auffüllen
    code = code.padEnd(17, ' ');

    return code;
}

function buildVdaiCommand(code: string): Uint8Array {
    // VDAI protocol uses specific ASCII control characters:
    // ASCII 5 (ENQ), 27 (ESC), 10 (LF), 22 (SYN)
    // The command is built by sending ASCII-5 and ASCII-27 to initialize.
    // The VDAI-Code itself is padded to 17 characters, followed by ASCII-10.
    const encoder = new TextEncoder();
    
    // Initial sequence: ASCII-5 (0x05) and ASCII-27 (0x1B)
    const header = new Uint8Array([0x05, 0x1B]);
    
    // The VDAI-Code itself (padded to 17) + ASCII-10 (0x0A)
    const body = encoder.encode(code.padEnd(17, ' ') + String.fromCharCode(0x0A));
    
    const combined = new Uint8Array(header.length + body.length);
    combined.set(header, 0);
    combined.set(body, header.length);
    
    return combined;
}

function updateVdaiCode(): void {
    const code = buildVdaiCode();
    sendCommandField.value = code;
}

function updateVisibility(): void {
    const selected = (document.querySelector('input[name="size"]:checked') as HTMLInputElement)?.value;
    const vdaiOptions = document.getElementById('vdaiOptions') as HTMLFieldSetElement;
    const adpaltOptions = document.getElementById('adpaltOptions') as HTMLFieldSetElement;

    vdaiOptions.style.display = selected === 'vdai' ? 'block' : 'none';
    adpaltOptions.style.display = selected === 'adpalt' ? 'block' : 'none';
}

const inputIds = [
    'vdaiDelete', 'vdaiStat', 'vdaiLast20', 'vdaiCopy', 'vdaiCheck'
];

inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('change', updateVdaiCode);
    } else {
        console.warn(`Element ${id} not found.`);
    }
});

const radioGroups = ['eg'];
radioGroups.forEach(name => {
    document.querySelectorAll(`input[name="${name}"]`).forEach(el => {
        el.addEventListener('change', () => {
            console.log(`Radio ${name} changed`);
            updateVdaiCode();
        });
    });
});

document.getElementsByName('size').forEach(el => {
    el.addEventListener('change', updateVisibility);
});

updateVdaiCode();
updateVisibility();

const baudRateMap: Record<string, number> = {
    'adpalt': 4800,
    'adp': 4800,
    'bally': 110,
    'berg': 110,
    'vdai': 9600
};

function getSelectedBaudRate(): number {
    const selected = (document.querySelector('input[name="size"]:checked') as HTMLInputElement)?.value;
    return baudRateMap[selected] || 9600;
}

async function runEinsatProtocol(): Promise<void> {
    if (!port || !port.writable || !port.readable) return;
    const writer = port.writable.getWriter();
    const reader = port.readable.getReader();
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

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
            for (let i = 0; i < chunk.length; i++) {
                await writer.write(encoder.encode('@'));
            }
        }
    } catch (e) {
        log(`Fehler: ${e}`);
    } finally {
        writer.releaseLock();
        reader.releaseLock();
        // Post-processing
        let totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
        const fullData = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) { fullData.set(c, offset); offset += c.length; }
        downloadResult(fullData);
    }
}

async function syncTime(): Promise<void> {
    if (!port || !port.writable) return;
    const timeInput = document.getElementById('adpaltTime') as HTMLInputElement;
    if (!timeInput.value) return;

    const date = new Date(timeInput.value);
    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();

    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = (date.getFullYear() % 100).toString().padStart(2, '0');

    const timeString = `**ZEIT*:${hour}${minute}${day}${month}${year}0000\r`;
    log(`Sende Zeit: ${timeString}`);
    
    try {
        await writer.write(encoder.encode(timeString));
        log('Zeit gesendet.');
    } catch (e) {
        log(`Fehler beim Senden der Zeit: ${e}`);
    } finally {
        writer.releaseLock();
    }
}

async function sendCommand(cmd: string): Promise<void> {
    if (!port || !port.writable) return;
    const writer = port.writable.getWriter();
    const encoder = new TextEncoder();
    log(`Sende Befehl: ${cmd}`);
    try {
        await writer.write(encoder.encode(cmd + '\r'));
        log('Befehl gesendet.');
    } catch (e) {
        log(`Fehler beim Senden: ${e}`);
    } finally {
        writer.releaseLock();
    }
}

if (typeof window !== 'undefined') {
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
            await port.open({ baudRate: baudRate });

            connectBtn.disabled = true;
            connectBtn.className = 'success';
            log('Verbindung hergestellt.');

            sendBtn.disabled = !abCheck();
        } catch (error: unknown) {
            log(`Fehler: ${error}`);
            connectBtn.className = 'failure';
            const radios = document.getElementsByName('size') as NodeListOf<HTMLInputElement>;
            radios.forEach(radio => { radio.disabled = false; });
        }
    });

    document.getElementById('sendBtn')!.addEventListener('click', async () => {
        if (!port || !port.writable) return;

        const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
        sendBtn.disabled = true;
        sendBtn.className = '';

        const selected = (document.querySelector('input[name="size"]:checked') as HTMLInputElement)?.value;

        if (selected === 'adp') {
            await runEinsatProtocol();
            sendBtn.disabled = false;
            return;
        }

        const writer = port.writable.getWriter();

        try {
            const code = buildVdaiCode();
            log(`VDAI-Code: "${code}"`);

            const command = buildVdaiCommand(code);
            log(`Sende ${command.length} Bytes über serielle Schnittstelle.`);

            for (let i = 0; i < command.length; i++) {
                const byte = command[i];
                const hex = byte.toString(16).toUpperCase().padStart(2, '0');
                const char = byte >= 0x20 && byte <= 0x7E ? String.fromCharCode(byte) : '.';
                if (byte === 0x1B) {
                    log(`  Byte ${i.toString().padStart(3, ' ')}: 0x${hex} (ESC)`);
                } else {
                    log(`  Byte ${i.toString().padStart(3, ' ')}: 0x${hex} ('${char}')`);
                }
            }

            await writer.write(command);
            log('Befehl gesendet.');

            await new Promise(resolve => setTimeout(resolve, 100));

            sendBtn.className = 'success';
            log('Auslesen gestartet. Druckerausgabe folgt.');

            await readPrintOutput();
        } catch (error: unknown) {
            log(`Fehler beim Senden: ${error}`);
            sendBtn.className = 'failure';
        } finally {
            writer.releaseLock();
            sendBtn.disabled = false;
        }
    });
}

async function readPrintOutput(): Promise<void> {
    if (!port || !port.readable) return;

    const reader = port.readable.getReader();
    const chunks: Uint8Array[] = [];
    let totalLength = 0;

    const readWithTimeout = async () => {
        return Promise.race([
            reader.read(),
            new Promise<{ done: true }>((_, reject) => {
                setTimeout(() => reject(new Error('Timeout')), 5000);
            })
        ]);
    };

    try {
        while (true) {
            const result = await readWithTimeout();
            if (result.done) break;

            const chunk = result.value!;
            chunks.push(chunk);
            totalLength += chunk.length;

            const hexStr = Array.from(chunk).slice(0, 64).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
            log(`Empfangen: ${chunk.length} Bytes | ${hexStr}${chunk.length > 64 ? '...' : ''}`);
        }

        const fullData = new Uint8Array(totalLength);
        let offset = 0;
        for (const c of chunks) {
            fullData.set(c, offset);
            offset += c.length;
        }

        const decoder = new TextDecoder('iso-8859-1', { fatal: false });
        const text = decoder.decode(fullData);
        const lines = text.split(/[\r\n]+/);
        log(`--- Ausgabe (${lines.length} Zeilen) ---`);

        for (const line of lines) {
            if (line.trim().length > 0) {
                log(line);
            }
        }

        log('--- Ende ---');
        log(`Insgesamt ${totalLength} Bytes empfangen.`);

        downloadResult(fullData);
        log('Port schließen...');
        await port.close();
        log('Fertig.');
    } catch (error: unknown) {
        if (error instanceof Error && error.message === 'Timeout') {
            log('Zeitüberschreitung beim Lesen – Übertragung vermutlich abgeschlossen.');

            const fullData = new Uint8Array(totalLength);
            let offset = 0;
            for (const c of chunks) {
                fullData.set(c, offset);
                offset += c.length;
            }

            const decoder = new TextDecoder('iso-8859-1', { fatal: false });
            const text = decoder.decode(fullData);
            const lines = text.split(/[\r\n]+/);
            log(`--- Ausgabe (${lines.length} Zeilen) ---`);
            for (const line of lines) {
                if (line.trim().length > 0) log(line);
            }
            log('--- Ende ---');
            log(`Insgesamt ${totalLength} Bytes empfangen.`);

            downloadResult(fullData);
        } else {
            log(`Fehler beim Empfang: ${error}`);
        }
    } finally {
        reader.releaseLock();
    }
}

function downloadResult(data: Uint8Array): void {
    const blob = new Blob([data], { type: 'text/plain; charset=iso-8859-1' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().substring(0, 10);
    a.download = `vdai_${timestamp}.txt`;
    a.click();
    URL.revokeObjectURL(url);
}