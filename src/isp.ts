const Stk500 = require('stk500');
const intel_hex = require('intel-hex');
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

interface BoardConfig {
    name: string;
    protocol: string;
    baudRate: number;
    signature: Buffer;
    pageSize: number;
    timeout: number;
    flashSize: number;
}

const BOARDS: Record<string, BoardConfig> = {
    nano: {
        name: 'Arduino Nano',
        protocol: 'stk500v1',
        baudRate: 115200,
        signature: Buffer.from([0x1E, 0x95, 0x0F]),
        pageSize: 128,
        timeout: 400,
        flashSize: 32768
    },
    nanoOldBootloader: {
        name: 'Arduino Nano (Old Bootloader)',
        protocol: 'stk500v1',
        baudRate: 57600,
        signature: Buffer.from([0x1E, 0x95, 0x0F]),
        pageSize: 128,
        timeout: 400,
        flashSize: 32768
    }
};

class SerialPortWrapper extends EventEmitter {
    private port: any;
    private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
    private isClosing: boolean = false;
    private readBuffer: Buffer = Buffer.alloc(0);

    constructor(port: any) {
        super();
        this.port = port;
    }

    on(event: string | symbol, listener: (...args: any[]) => void): this {
        super.on(event, listener);
        if (event === 'data' && this.readBuffer.length > 0) {
            const data = this.readBuffer;
            this.readBuffer = Buffer.alloc(0);
            setTimeout(() => this.emit('data', data), 0);
        }
        return this;
    }

    async write(data: Buffer, callback?: (err?: any) => void) {
        try {
            const writer = this.port.writable.getWriter();
            try {
                await writer.write(new Uint8Array(data));
                if (callback) callback();
            } finally {
                writer.releaseLock();
            }
        } catch (err) {
            console.error('Write error:', err);
            if (callback) callback(err);
        }
    }

    async close(callback?: (err?: any) => void) {
        this.isClosing = true;
        try {
            if (this.reader) {
                await this.reader.cancel();
                this.reader = null;
            }
            if (this.port && this.port.close) {
                await this.port.close();
            }
            if (callback) callback();
        } catch (err) {
            if (callback) callback(err);
        }
    }

    async startReading() {
        while (this.port.readable && !this.isClosing) {
            this.reader = this.port.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await this.reader.read();
                    if (done) break;
                    if (value) {
                        const chunk = Buffer.from(value);
                        if (this.listenerCount('data') > 0) {
                            this.emit('data', chunk);
                        } else {
                            this.readBuffer = Buffer.concat([this.readBuffer, chunk]);
                        }
                    }
                }
            } catch (err) {
                if (!this.isClosing) console.error('Serial read error:', err);
                break;
            } finally {
                if (this.reader) {
                    this.reader.releaseLock();
                    this.reader = null;
                }
            }
        }
    }
}

async function fetchHex(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    const text = await response.text();
    const parsed = intel_hex.parse(text);
    return parsed.data;
}

async function flash(button: HTMLButtonElement): Promise<void> {
    const hexUrl = button.getAttribute('hex-href');
    const boardKey = button.getAttribute('board');
    const verify = button.hasAttribute('verify');
    const progressSpan = button.querySelector('.upload-progress') as HTMLElement;

    if (!hexUrl || !boardKey || !BOARDS[boardKey]) {
        console.error('Missing configuration for button', button);
        return;
    }

    const config = BOARDS[boardKey];
    
    // Disable all flash buttons during flashing
    const allButtons = document.querySelectorAll('button[arduino-uploader]') as NodeListOf<HTMLButtonElement>;
    allButtons.forEach(btn => btn.disabled = true);
    button.classList.remove('success', 'failure');

    let port: any = null;
    let wrapper: SerialPortWrapper | null = null;

    try {
        if (progressSpan) progressSpan.textContent = ' (Warte auf Port...)';
        port = await (navigator as any).serial.requestPort();
        
        if (progressSpan) progressSpan.textContent = ' (Lade HEX...)';
        const hexData = await fetchHex(hexUrl);

        if (progressSpan) progressSpan.textContent = ' (Öffne Port...)';
        await port.open({ baudRate: config.baudRate });
        
        wrapper = new SerialPortWrapper(port);
        wrapper.startReading();

        if (progressSpan) progressSpan.textContent = ' (Reset...)';
        // Explicitly trigger reset via DTR/RTS
        await port.setSignals({ dataTerminalReady: false, requestToSend: false });
        await new Promise(resolve => setTimeout(resolve, 250));
        await port.setSignals({ dataTerminalReady: true, requestToSend: true });
        // Small delay for bootloader to stabilize
        await new Promise(resolve => setTimeout(resolve, 50));

        const stk = new Stk500();
        let sent = 0;
        let total = Math.ceil(hexData.length / config.pageSize);
        if (verify) total *= 2;

        stk.log = (what: string) => {
            if (what === 'page done' || what === 'verify done') {
                sent += 1;
                const percent = Math.round((100 * sent) / total);
                if (progressSpan) progressSpan.textContent = ` (${percent}%)`;
            }
            console.log(what);
        };

        if (progressSpan) progressSpan.textContent = ' (0%)';

        const run = (method: string, ...args: any[]) => {
            return new Promise<void>((resolve, reject) => {
                (stk as any)[method](wrapper, ...args, (err: any) => {
                    if (err) return reject(err);
                    resolve();
                });
            });
        };

        // Match the sequence from the provided code
        await run('sync', 3, config.timeout);
        await run('sync', 3, config.timeout);
        await run('sync', 3, config.timeout);
        await run('verifySignature', config.signature, config.timeout);
        await run('setOptions', {}, config.timeout);
        await run('enterProgrammingMode', config.timeout);
        await run('upload', hexData, config.pageSize, config.timeout);
        if (verify) {
            await run('verify', hexData, config.pageSize, config.timeout);
        }
        await run('exitProgrammingMode', config.timeout);

        if (progressSpan) {
            progressSpan.textContent = ' (Fertig!)';
            button.classList.add('success');
        }
    } catch (err: any) {
        console.error('Flash error:', err);
        if (progressSpan) {
            progressSpan.textContent = ' (Fehler!)';
            button.classList.add('failure');
        }
        alert('Fehler beim Flashen: ' + err.message);
    } finally {
        if (wrapper) {
            await wrapper.close();
        }
        allButtons.forEach(btn => btn.disabled = false);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('button[arduino-uploader]');
    buttons.forEach(button => {
        button.addEventListener('click', () => flash(button as HTMLButtonElement));
    });
});
