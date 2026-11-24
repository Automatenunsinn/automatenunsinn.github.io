export function readUint32BE(data: Uint8Array, offset: number = 0): number {
    return ((data[offset] << 24) | (data[offset + 1] << 16) |
        (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}

/** Swap adjacent bytes in a copy, leaving an unpaired trailing byte unchanged. */
export function swappedCopy(source: Uint8Array): Uint8Array {
    const result = new Uint8Array(source);
    for (let i = 0; i < result.length - 1; i += 2) {
        const byte = result[i];
        result[i] = result[i + 1];
        result[i + 1] = byte;
    }
    return result;
}

export function bytesToHex(bytes: Uint8Array | number[], separator: string = ''): string {
    return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join(separator);
}

/** Encode a decimal value from 0 to 99 as packed BCD. */
export function toBcd(value: number): number {
    return (Math.floor(value / 10) << 4) | (value % 10);
}
