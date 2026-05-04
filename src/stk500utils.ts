const Stk500 = require('stk500');
const intel_hex = require('intel-hex');
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
const statics = require('stk500/lib/statics');

export const ATMEGA48_BOARD = {
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

export class SerialPortWrapper extends EventEmitter {
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

export async function fetchHex(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
    
    if (url.endsWith('.hex')) {
        const text = await response.text();
        const parsed = intel_hex.parse(text);
        return parsed.data;
    } else {
        const buffer = await response.arrayBuffer();
        return Buffer.from(buffer);
    }
}

export async function sendStkCommand(wrapper: SerialPortWrapper, cmd: Buffer, responseLength: number, timeout: number): Promise<Buffer> {
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
                    if (data[i] === statics.Resp_STK_INSYNC) {
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

export async function uploadEeprom(wrapper: SerialPortWrapper, stk: any, data: Buffer, updateProgress?: (status: string, pct: number) => void): Promise<void> {
    const pageSize = ATMEGA48_BOARD.eepromPageSize;
    for (let addr = 0; addr < data.length; addr += pageSize) {
        const chunk = data.slice(addr, Math.min(addr + pageSize, data.length));
        if (updateProgress && addr % 16 === 0) {
            updateProgress(`EEPROM schreiben... (${addr}/${data.length})`, 70 + Math.floor((addr / data.length) * 20));
        }
        
        await new Promise<void>((res, rej) => stk.loadAddress(wrapper, addr >> 1, 2000, (err: any) => err ? rej(err) : res()));
        
        const cmd = Buffer.concat([
            Buffer.from([statics.Cmnd_STK_PROG_PAGE, (chunk.length >> 8) & 0xff, chunk.length & 0xff, 0x45]),
            chunk,
            Buffer.from([statics.Sync_CRC_EOP])
        ]);
        const resp = await sendStkCommand(wrapper, cmd, 2, 2000);
        if (resp[1] !== statics.Resp_STK_OK) throw new Error('EEPROM programming failed');
    }
}

export async function uploadFirmware(wrapper: SerialPortWrapper, stk: any, data: Buffer, pageSize: number, timeout: number, updateProgress?: (status: string, pct: number) => void): Promise<void> {
    const totalBytes = data.length;
    for (let pageaddr = 0; pageaddr < totalBytes; pageaddr += pageSize) {
        const useaddr = pageaddr >> 1;
        await new Promise<void>((res, rej) => stk.loadAddress(wrapper, useaddr, timeout, (err: any) => err ? rej(err) : res()));
        
        const writeBytes = data.slice(pageaddr, Math.min(pageaddr + pageSize, totalBytes));
        await new Promise<void>((res, rej) => stk.loadPage(wrapper, writeBytes, timeout, (err: any) => err ? rej(err) : res()));
        
        if (updateProgress && pageaddr % (pageSize * 4) === 0) {
            const pct = Math.floor((pageaddr / totalBytes) * 70);
            updateProgress(`Firmware schreiben... (${pageaddr}/${totalBytes})`, pct);
        }
    }
}

export async function verifyEeprom(wrapper: SerialPortWrapper, stk: any, data: Buffer): Promise<void> {
    const pageSize = ATMEGA48_BOARD.eepromPageSize;
    for (let addr = 0; addr < data.length; addr += pageSize) {
        const chunk = data.slice(addr, Math.min(addr + pageSize, data.length));
        await new Promise<void>((res, rej) => stk.loadAddress(wrapper, addr >> 1, 2000, (err: any) => err ? rej(err) : res()));
        
        const cmd = Buffer.from([statics.Cmnd_STK_READ_PAGE, (chunk.length >> 8) & 0xff, chunk.length & 0xff, 0x45, statics.Sync_CRC_EOP]);
        const resp = await sendStkCommand(wrapper, cmd, chunk.length + 2, 2000);
        if (resp[resp.length - 1] !== statics.Resp_STK_OK) throw new Error('EEPROM read failed');
        
        const readData = resp.slice(1, resp.length - 1);
        if (!readData.equals(chunk)) throw new Error(`EEPROM mismatch at 0x${addr.toString(16)}`);
    }
}
