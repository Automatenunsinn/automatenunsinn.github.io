const Stk500 = require('stk500');
const intel_hex = require('intel-hex');
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';
const statics = require('stk500/lib/statics');

function debugLog(...args: any[]): void {
    if (typeof console !== 'undefined') console.debug('[stk500]', ...args);
}

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
            const reader = this.port.readable.getReader();
            this.reader = reader;
            try {
                while (true) {
                    const { value, done } = await reader.read();
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

export async function verifyDeviceSignature(wrapper: SerialPortWrapper, expected: Buffer, timeout: number = 2000): Promise<void> {
    const cmd = Buffer.from([statics.Cmnd_STK_READ_SIGN, statics.Sync_CRC_EOP]);
    const resp = await sendStkCommand(wrapper, cmd, expected.length + 2, timeout);
    const signature = resp.slice(1, -1);
    if (resp[resp.length - 1] !== statics.Resp_STK_OK || !signature.equals(expected)) {
        throw new Error(`Ungültige MCU-Signatur: erwartet ${expected.toString('hex')}, erhalten ${signature.toString('hex')}`);
    }
}

export async function uploadEeprom(wrapper: SerialPortWrapper, stk: any, data: Buffer, updateProgress?: (status: string, pct: number) => void): Promise<void> {
    const pageSize = ATMEGA48_BOARD.eepromPageSize;
    for (let addr = 0; addr < data.length; addr += pageSize) {
        const chunk = data.slice(addr, Math.min(addr + pageSize, data.length));
        if (updateProgress && addr % 16 === 0) {
            updateProgress(`EEPROM schreiben... (${addr}/${data.length})`, 70 + Math.floor((addr / data.length) * 20));
        }
        // Chip erase leaves these pages at 0xFF; avoid needlessly invoking
        // ArduinoISP's slow byte-at-a-time EEPROM writer for them.
        if (chunk.every(byte => byte === 0xFF)) continue;
        
        // ArduinoISP's `here` is a word address and converts it to an EEPROM
        // byte address by multiplying by two.
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
        if (!readData.equals(chunk)) {
            const mismatch = readData.findIndex((value, i) => value !== chunk[i]);
            const at = mismatch >= 0 ? addr + mismatch : addr;
            throw new Error(`EEPROM mismatch at 0x${at.toString(16)} (expected ${chunk[mismatch]?.toString(16).padStart(2, '0')}, got ${readData[mismatch]?.toString(16).padStart(2, '0')})`);
        }
    }
}

export async function verifyFirmware(wrapper: SerialPortWrapper, stk: any, data: Buffer, pageSize: number = 64): Promise<void> {
    for (let addr = 0; addr < data.length; addr += pageSize) {
        const chunk = data.slice(addr, Math.min(addr + pageSize, data.length));
        await new Promise<void>((res, rej) => stk.loadAddress(wrapper, addr >> 1, 2000, (err: any) => err ? rej(err) : res()));
        const cmd = Buffer.from([statics.Cmnd_STK_READ_PAGE, (chunk.length >> 8) & 0xff, chunk.length & 0xff, 0x46, statics.Sync_CRC_EOP]);
        const resp = await sendStkCommand(wrapper, cmd, chunk.length + 2, 2000);
        const readData = resp.slice(1, resp.length - 1);
        if (resp[resp.length - 1] !== statics.Resp_STK_OK || !readData.equals(chunk)) {
            const mismatch = readData.findIndex((value, i) => value !== chunk[i]);
            throw new Error(`Firmware mismatch at 0x${(addr + Math.max(0, mismatch)).toString(16)}`);
        }
    }
}

export async function eraseChip(wrapper: SerialPortWrapper, timeout: number = 55000): Promise<void> {
    const universal = async (a: number, b: number, c: number, d: number): Promise<number> => {
        debugLog('UNIVERSAL request', [a, b, c, d].map(v => v.toString(16).padStart(2, '0')).join(' '));
        const resp = await sendStkCommand(wrapper, Buffer.from([0x56, a, b, c, d, statics.Sync_CRC_EOP]), 3, 2000);
        debugLog('UNIVERSAL response', resp.toString('hex'));
        if (resp[resp.length - 1] !== statics.Resp_STK_OK) throw new Error('Universal command failed');
        return resp[1];
    };
    await universal(0xAC, 0x80, 0x00, 0x00);
    debugLog('chip erase requested');
    await new Promise(resolve => setTimeout(resolve, 100));
}

/** Restore the ATmega48P's documented factory fuse values. */
export async function resetFusesToFactoryDefaults(wrapper: SerialPortWrapper): Promise<void> {
    const writeFuse = async (value: number, instruction: number) => {
        const resp = await sendStkCommand(
            wrapper,
            Buffer.from([0x56, 0xAC, instruction, 0x00, value, statics.Sync_CRC_EOP]),
            3,
            2000
        );
        if (resp[resp.length - 1] !== statics.Resp_STK_OK) throw new Error('Fuse programming failed');
        // Fuse programming is self-timed; ArduinoISP returns before it ends.
        await new Promise(resolve => setTimeout(resolve, 20));
    };

    // Factory defaults: LFUSE=0x62, HFUSE=0xDF, EFUSE=0x01.
    await writeFuse(0x62, 0xA0);
    await writeFuse(0xDF, 0xA8);
    await writeFuse(0x01, 0xA4);
}
