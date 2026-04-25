const Stk500 = require('stk500');
const intel_hex = require('intel-hex');
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// STK500 Constants needed for custom EEPROM logic (not exposed by library)
const Resp_STK_INSYNC = 0x14;
const Resp_STK_OK = 0x10;
const Cmnd_STK_PROG_PAGE = 0x64;
const Cmnd_STK_READ_PAGE = 0x74;
const Sync_CRC_EOP = 0x20;

const ATMEGA48_BOARD = {
    name: 'ATmega48P',
    protocol: 'stk500v1',
    baudRate: 19200,
    signature: Buffer.from([0x1E, 0x92, 0x0A]),
    pageSize: 64,
    timeout: 10000,
    flashSize: 4096,
    eepromSize: 256,
    eepromPageSize: 4
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

    public clearBuffer() {
        this.readBuffer = Buffer.alloc(0);
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
            await this.port.close();
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

let port: any = null;
let hexData: Buffer | null = null;
let eepromData: Buffer | null = null;

function log(msg: string): void {
    const logArea = document.getElementById('logArea') as HTMLTextAreaElement | null;
    if (logArea) {
        logArea.value += msg + '\n';
        logArea.scrollTop = logArea.scrollHeight;
    }
    console.log(msg);
}

function updateProgress(status: string, pct: number): void {
    const progressBar = document.getElementById('progressBar') as HTMLProgressElement | null;
    if (progressBar) {
        progressBar.value = pct;
    }
    log(`[${pct}%] ${status}`);
}

async function connect(): Promise<void> {
    try {
        port = await (navigator as any).serial.requestPort();
        log('Port ausgewählt.');
        const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;
        if (connectBtn) {
            connectBtn.textContent = 'Verbunden';
            connectBtn.classList.add('success');
        }
        checkEnableFlash();
    } catch (err) {
        log('Fehler beim Verbinden: ' + err);
    }
}

function checkEnableFlash(): void {
    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn && (hexData || eepromData) && port) {
        flashBtn.disabled = false;
    }
}

async function handleFileSelect(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        const buffer = await file.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        try {
            hexData = intel_hex.parse(text).data;
            log(`Flash-Datei geladen (HEX): ${file.name} (${hexData?.length} Bytes)`);
        } catch (e) {
            hexData = Buffer.from(buffer);
            log(`Flash-Datei geladen (Binär): ${file.name} (${hexData.length} Bytes)`);
        }
        checkEnableFlash();
    } catch (err) {
        log('Fehler beim Lesen der Flash-Datei: ' + err);
    }
}

async function handleEepromFileSelect(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        const buffer = await file.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        try {
            eepromData = intel_hex.parse(text).data;
            log(`EEPROM-Datei geladen (HEX): ${file.name} (${eepromData?.length} Bytes)`);
        } catch (e) {
            eepromData = Buffer.from(buffer);
            log(`EEPROM-Datei geladen (Binär): ${file.name} (${eepromData.length} Bytes)`);
        }
        checkEnableFlash();
    } catch (err) {
        log('Fehler beim Lesen der EEPROM-Datei: ' + err);
    }
}

async function sendStkCommand(wrapper: SerialPortWrapper, cmd: Buffer, responseLength: number, timeout: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        let buffer = Buffer.alloc(0);
        let started = false;
        let timeoutId: any = null;

        const cleanup = () => {
            if (timeoutId) clearTimeout(timeoutId);
            wrapper.removeListener('data', handleChunk);
        };

        const handleChunk = (data: Buffer) => {
            let i = 0;
            if (!started) {
                for (; i < data.length; i++) {
                    if (data[i] === Resp_STK_INSYNC) {
                        started = true;
                        break;
                    }
                }
            }
            if (started) {
                if (i < data.length) buffer = Buffer.concat([buffer, data.slice(i)]);
                if (buffer.length >= responseLength) {
                    cleanup();
                    resolve(buffer);
                }
            }
        };

        if (timeout > 0) {
            timeoutId = setTimeout(() => {
                cleanup();
                reject(new Error('STK500 command timeout'));
            }, timeout);
        }

        wrapper.on('data', handleChunk);
        wrapper.write(cmd, (err: any) => {
            if (err) {
                cleanup();
                reject(err);
            }
        });
    });
}

async function uploadEeprom(wrapper: SerialPortWrapper, stk: any, data: Buffer): Promise<void> {
    const pageSize = ATMEGA48_BOARD.eepromPageSize;
    for (let addr = 0; addr < data.length; addr += pageSize) {
        const chunk = data.slice(addr, Math.min(addr + pageSize, data.length));
        if (addr % 16 === 0) updateProgress(`EEPROM schreiben... (${addr}/${data.length})`, 70 + Math.floor((addr / data.length) * 20));
        
        await new Promise<void>((res, rej) => stk.loadAddress(wrapper, addr >> 1, 2000, (err: any) => err ? rej(err) : res()));
        
        const cmd = Buffer.concat([
            Buffer.from([Cmnd_STK_PROG_PAGE, (chunk.length >> 8) & 0xff, chunk.length & 0xff, 0x45]),
            chunk,
            Buffer.from([Sync_CRC_EOP])
        ]);
        const resp = await sendStkCommand(wrapper, cmd, 2, 2000);
        if (resp[1] !== Resp_STK_OK) throw new Error('EEPROM programming failed');
    }
}

async function verifyEeprom(wrapper: SerialPortWrapper, stk: any, data: Buffer): Promise<void> {
    const pageSize = ATMEGA48_BOARD.eepromPageSize;
    for (let addr = 0; addr < data.length; addr += pageSize) {
        const chunk = data.slice(addr, Math.min(addr + pageSize, data.length));
        await new Promise<void>((res, rej) => stk.loadAddress(wrapper, addr >> 1, 2000, (err: any) => err ? rej(err) : res()));
        
        const cmd = Buffer.from([Cmnd_STK_READ_PAGE, (chunk.length >> 8) & 0xff, chunk.length & 0xff, 0x45, Sync_CRC_EOP]);
        const resp = await sendStkCommand(wrapper, cmd, chunk.length + 2, 2000);
        if (resp[resp.length - 1] !== Resp_STK_OK) throw new Error('EEPROM read failed');
        
        const readData = resp.slice(1, resp.length - 1);
        if (!readData.equals(chunk)) throw new Error(`EEPROM mismatch at 0x${addr.toString(16)}`);
    }
}

async function flash(): Promise<void> {
    if (!hexData && !eepromData) return;
    if (!port) return;

    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn) {
        flashBtn.disabled = true;
        flashBtn.classList.remove('success', 'failure');
    }

    const wrapper = new SerialPortWrapper(port);
    try {
        log('Öffne Port und initialisiere...');
        await port.open({ baudRate: ATMEGA48_BOARD.baudRate });
        await new Promise(res => setTimeout(res, 2000));
        wrapper.startReading();

        const stk = new Stk500();
        stk.log = () => {};

        await new Promise<void>((res, rej) => stk.sync(wrapper, 3, 2000, (err: any) => err ? rej(err) : res()));

        const parameters = {
            devicecode: 0x41, parmode: 0x01, polling: 0x01, selftimed: 0x01,
            lockbytes: 1, fusebytes: 3, flashpollval1: 0xff, flashpollval2: 0xff,
            eeprompollval1: 0xff, eeprompollval2: 0xff,
            pagesizehigh: (ATMEGA48_BOARD.pageSize >> 8) & 0xff,
            pagesizelow: ATMEGA48_BOARD.pageSize & 0xff,
            eepromsizehigh: (ATMEGA48_BOARD.eepromSize >> 8) & 0xff,
            eepromsizelow: ATMEGA48_BOARD.eepromSize & 0xff,
            flashsize2: (ATMEGA48_BOARD.flashSize >> 8) & 0xff,
            flashsize1: ATMEGA48_BOARD.flashSize & 0xff
        };

        await new Promise<void>((res, rej) => stk.setOptions(wrapper, parameters, 2000, (err: any) => err ? rej(err) : res()));
        await new Promise<void>((res, rej) => stk.enterProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
        await new Promise<void>((res, rej) => stk.verifySignature(wrapper, ATMEGA48_BOARD.signature, 2000, (err: any) => err ? rej(err) : res()));

        if (hexData) {
            updateProgress('Flash wird beschrieben...', 10);
            await new Promise<void>((res, rej) => stk.upload(wrapper, hexData, ATMEGA48_BOARD.pageSize, 10000, (err: any) => err ? rej(err) : res()));
            updateProgress('Flash wird verifiziert...', 50);
            await new Promise<void>((res, rej) => stk.verify(wrapper, hexData, ATMEGA48_BOARD.pageSize, 10000, (err: any) => err ? rej(err) : res()));
        }

        if (eepromData) {
            updateProgress('EEPROM wird beschrieben...', 70);
            await uploadEeprom(wrapper, stk, eepromData);
            updateProgress('EEPROM wird verifiziert...', 90);
            await verifyEeprom(wrapper, stk, eepromData);
        }

        await new Promise<void>((res, rej) => stk.exitProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
        updateProgress('Erfolgreich abgeschlossen!', 100);
        if (flashBtn) flashBtn.classList.add('success');
    } catch (err: any) {
        log('FEHLER: ' + err.message);
        if (flashBtn) flashBtn.classList.add('failure');
    } finally {
        await wrapper.close();
        if (flashBtn) flashBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('connectBtn')?.addEventListener('click', connect);
    document.getElementById('hexFile')?.addEventListener('change', handleFileSelect);
    document.getElementById('eepromFile')?.addEventListener('change', handleEepromFileSelect);
    document.getElementById('flashBtn')?.addEventListener('click', flash);
});
