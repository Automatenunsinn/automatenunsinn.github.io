const Stk500 = require('stk500');
const intel_hex = require('intel-hex');
import { Buffer } from 'buffer';
import { EventEmitter } from 'events';

// Custom board definition for ATmega48 via Arduino as ISP
const ATMEGA48_BOARD = {
    name: 'ATmega48P',
    protocol: 'stk500v1',
    baudRate: 19200, // ArduinoISP default
    signature: Buffer.from([0x1E, 0x92, 0x0A]),
    pageSize: 64,
    timeout: 10000, // Increased to 10s to match original config
    flashSize: 4096
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

    // Override on to handle buffered data
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
        log('Fordere Port an...');
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
    if (flashBtn && hexData && port) {
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
            const parsed = intel_hex.parse(text);
            hexData = parsed.data;
            log(`Datei geladen und als HEX interpretiert: ${file.name} (${hexData?.length} Bytes Binärdaten)`);
        } catch (e) {
            // If not a valid HEX, treat as raw binary
            hexData = Buffer.from(buffer);
            log(`Datei geladen (Binär): ${file.name} (${hexData.length} Bytes)`);
        }
        
        checkEnableFlash();
    } catch (err) {
        log('Fehler beim Lesen der Datei: ' + err);
    }
}

async function flash(): Promise<void> {
    if (!hexData) {
        log('Keine HEX-Datei ausgewählt!');
        return;
    }
    if (!port) {
        log('Kein Port ausgewählt!');
        return;
    }

    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn) {
        flashBtn.disabled = true;
        flashBtn.classList.remove('success', 'failure');
    }

    const wrapper = new SerialPortWrapper(port);

    try {
        log('Öffne Port mit 19200 Baud...');
        await port.open({ baudRate: ATMEGA48_BOARD.baudRate });
        
        log('Warte auf Programmer (Auto-Reset)...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        wrapper.startReading();

        const stk = new Stk500();
        stk.log = () => {}; // Silence internal STK logging
        
        log('Starte Flash-Vorgang...');
        updateProgress('Initialisiere...', 0);

        const parameters = {
            pagesizehigh: (ATMEGA48_BOARD.pageSize >> 8) & 0xff,
            pagesizelow: ATMEGA48_BOARD.pageSize & 0xff,
            flashsize2: (ATMEGA48_BOARD.flashSize >> 8) & 0xff,
            flashsize1: ATMEGA48_BOARD.flashSize & 0xff
        };

        await new Promise<void>((resolve, reject) => {
            log('Sync...');
            stk.sync(wrapper, 3, ATMEGA48_BOARD.timeout, (err: any) => {
                if (err) return reject(err);
                
                log('Set Device Options...');
                stk.setOptions(wrapper, parameters, ATMEGA48_BOARD.timeout, (err: any) => {
                    if (err) return reject(err);
                    
                    log('Enter Programming Mode...');
                    stk.enterProgrammingMode(wrapper, ATMEGA48_BOARD.timeout, (err: any) => {
                        if (err) return reject(err);
                        
                        log('Verify Signature...');
                        stk.verifySignature(wrapper, ATMEGA48_BOARD.signature, ATMEGA48_BOARD.timeout, (err: any) => {
                            if (err) return reject(err);
                            
                            updateProgress('Flashen...', 10);
                            stk.upload(wrapper, hexData, ATMEGA48_BOARD.pageSize, ATMEGA48_BOARD.timeout, (err: any) => {
                                if (err) return reject(err);
                                
                                updateProgress('Verifizieren...', 70);
                                stk.verify(wrapper, hexData, ATMEGA48_BOARD.pageSize, ATMEGA48_BOARD.timeout, (err: any) => {
                                    if (err) return reject(err);
                                    
                                    log('Exit Programming Mode...');
                                    stk.exitProgrammingMode(wrapper, ATMEGA48_BOARD.timeout, (err: any) => {
                                        if (err) return reject(err);
                                        resolve();
                                    });
                                });
                            });
                        });
                    });
                });
            });
        });

        updateProgress('Flashen erfolgreich abgeschlossen!', 100);
        if (flashBtn) flashBtn.classList.add('success');
    } catch (err: any) {
        log('FLASH-FEHLER: ' + err.message);
        if (err.stack) console.error(err.stack);
        if (flashBtn) flashBtn.classList.add('failure');
    } finally {
        await wrapper.close();
        if (flashBtn) flashBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('connectBtn')?.addEventListener('click', connect);
    document.getElementById('hexFile')?.addEventListener('change', handleFileSelect);
    document.getElementById('flashBtn')?.addEventListener('click', flash);
});
