// WebSerial type definitions based on WebIDL specification
export interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
}

export interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
}

export interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
}

export interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
}

export interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: "none" | "even" | "odd";
    bufferSize?: number;
    flowControl?: "none" | "hardware";
}

export interface Serial extends EventTarget {
    onconnect: EventHandler;
    ondisconnect: EventHandler;
    getPorts(): Promise<SerialPort[]>;
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

export type EventHandler = ((this: Serial, ev: Event) => any) | null;

declare global {
    interface Navigator {
        serial: Serial;
    }
}
