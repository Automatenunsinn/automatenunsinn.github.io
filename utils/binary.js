export function readUint32BE(data, offset = 0) {
    return ((data[offset] << 24) | (data[offset + 1] << 16) |
        (data[offset + 2] << 8) | data[offset + 3]) >>> 0;
}
/** Swap adjacent bytes in a copy, leaving an unpaired trailing byte unchanged. */
export function swappedCopy(source) {
    const result = new Uint8Array(source);
    for (let i = 0; i < result.length - 1; i += 2) {
        const byte = result[i];
        result[i] = result[i + 1];
        result[i + 1] = byte;
    }
    return result;
}
export function bytesToHex(bytes, separator = '') {
    return Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join(separator);
}
/** Encode a decimal value from 0 to 99 as packed BCD. */
export function toBcd(value) {
    return (Math.floor(value / 10) << 4) | (value % 10);
}
/** Interleave two ROM lanes, truncating to the shorter lane. */
export function interleaveBytes(first, second) {
    const length = Math.min(first.length, second.length);
    const result = new Uint8Array(length * 2);
    for (let i = 0; i < length; i++) {
        result[i * 2] = first[i];
        result[i * 2 + 1] = second[i];
    }
    return result;
}
/** Split complete 16-bit words into their first and second byte lanes. */
export function deinterleaveBytes(data) {
    const length = Math.floor(data.length / 2);
    const first = new Uint8Array(length);
    const second = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        first[i] = data[i * 2];
        second[i] = data[i * 2 + 1];
    }
    return [first, second];
}
