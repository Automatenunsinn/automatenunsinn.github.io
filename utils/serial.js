import { delay } from './async.js';
export async function writePort(port, data, delayMs = 2) {
    if (!port?.writable)
        return;
    const writer = port.writable.getWriter();
    try {
        if (delayMs === 0) {
            await writer.write(data);
        }
        else {
            for (const byte of data) {
                await writer.write(new Uint8Array([byte]));
                await delay(delayMs);
            }
        }
    }
    finally {
        writer.releaseLock();
    }
}
export function assembleChunks(chunks, totalLength) {
    const fullData = new Uint8Array(totalLength);
    let offset = 0;
    for (const c of chunks) {
        fullData.set(c, offset);
        offset += c.length;
    }
    return fullData;
}
export async function readWithTimeout(reader, timeoutMs = 5000) {
    return Promise.race([
        reader.read(),
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), timeoutMs);
        })
    ]);
}
export function readLoop(port, onData, onError) {
    if (!port?.readable)
        return;
    const doRead = async () => {
        while (port.readable) {
            const reader = port.readable.getReader();
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done)
                        break;
                    if (value)
                        onData(value);
                }
            }
            catch (error) {
                if (onError)
                    onError(error);
            }
            finally {
                reader.releaseLock();
            }
        }
    };
    doRead();
}
export async function loadFileFromUrl(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    }
    catch (error) {
        console.error('Error loading file:', error);
        return null;
    }
}
