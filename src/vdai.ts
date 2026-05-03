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
    const einsatz = (document.querySelector('input[name="einsatz"]:checked') as HTMLInputElement).value;
    const gewinn = (document.querySelector('input[name="gewinn"]:checked') as HTMLInputElement).value;
    if (einsatz) {
        code += einsatz;
    } else if (gewinn) {
        code += gewinn;
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

    // Zeichen 7-8: leer
    code += '  ';

    return code;
}

function buildVdaiCommand(code: string): Uint8Array {
    const encoder = new TextEncoder();
    const parts: Uint8Array[] = [];
    const sectionSeparators = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    for (let i = 0; i < code.length; i++) {
        if (i > 0) {
            parts.push(encoder.encode('\x1B'));
            parts.push(encoder.encode(sectionSeparators[i]));
        }
        parts.push(encoder.encode(code[i]));
    }

    const totalLength = parts.reduce((sum, p) => sum + p.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const p of parts) {
        result.set(p, offset);
        offset += p.length;
    }

    return result;
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

const allInputs = [
    'vdaiDelete', 'vdaiStat', 'vdaiLast20', 'vdaiCopy', 'vdaiCheck',
    'einsatz', 'gewinn'
];

allInputs.forEach(id => {
    const elements = id.includes('Check') || id === 'vdaiDelete'
        ? [document.getElementById(id)]
        : document.querySelectorAll(`input[name="${id}"]`);
    elements.forEach(el => {
        if (el) {
            (el as HTMLElement).addEventListener('change', updateVdaiCode);
        }
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

if (typeof window !== 'undefined') {
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

            log('Port schließen...');
            await port.close();
            log('Geschlossen.');

            log('Port mit 19200 baud wieder öffnen für Empfang...');
            await port.open({ baudRate: 19200 });
            log('Geöffnet.');

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