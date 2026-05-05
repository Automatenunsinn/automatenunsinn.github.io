import { SerialPort } from '../types/webserial';

export async function writePort(port: SerialPort, data: Uint8Array, delayMs: number = 2): Promise<void> {
    if (!port?.writable) return;

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

export function assembleChunks(chunks: Uint8Array[], totalLength: number): Uint8Array {
    const fullData = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
        fullData.set(c, offset);
        offset += c.length;
    }
    return fullData;
}

export async function readWithTimeout(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs: number = 5000
): Promise<{ value?: Uint8Array; done?: boolean }> {
    return Promise.race([
        reader.read(),
        new Promise<{ done: true }>((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), timeoutMs);
        })
    ]);
}

export function readLoop(
    port: SerialPort,
    onData: (data: Uint8Array) => void,
    onError?: (error: any) => void
): void {
    if (!port?.readable) return;

    const doRead = async (): Promise<void> => {
        while (port.readable) {
            const reader = port.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    if (value) onData(value);
                }
            } catch (error) {
                if (onError) onError(error);
            } finally {
                reader.releaseLock();
            }
        }
    };

    doRead();
}

export async function loadFileFromUrl(url: string): Promise<Uint8Array | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        console.error('Error loading file:', error);
        return null;
    }
}
