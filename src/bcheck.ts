export const CHECKSUM_VECTOR_OFFSET = 0x7c;
export const CHECKSUM_VECTOR_ADDEND = 0x12;
export const SUPPORTED_ROM_SIZES = [0x80000, 0x100000];
const COMPENSATION_BYTES = 64;

// Keep the first checksum observed for a ROM available to callers that edit
// the buffer before asking us to preserve it. patchRom passes the baseline
// explicitly, while this cache keeps the standalone helper backwards
// compatible.
type ChecksumSnapshot = { offset: number; size: number; value: number };
const checksumSnapshots = new WeakMap<Uint8Array, ChecksumSnapshot>();

function readUint32BE(bytes: Uint8Array, offset: number): number {
    return (((bytes[offset] << 24) >>> 0) | (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

export function findChecksumOffset(rom: Uint8Array): number {
    if (CHECKSUM_VECTOR_OFFSET + 4 > rom.length) throw new RangeError("Invalid checksum vector");
    const target = readUint32BE(rom, CHECKSUM_VECTOR_OFFSET);
    const offset = target + CHECKSUM_VECTOR_ADDEND;
    if (offset + 4 > rom.length || (offset & 1) !== 0) throw new RangeError("Invalid checksum vector");
    return offset;
}

export function calculateChecksum(rom: Uint8Array, checksumOffset: number, checksumSize: number): number {
    if (checksumSize > rom.length || (checksumSize & 1) !== 0 || checksumOffset < 0 || (checksumOffset & 1) !== 0 || checksumOffset + 4 > checksumSize) {
        throw new RangeError("Invalid checksum range");
    }
    // The firmware adds unsigned 16-bit words into a 32-bit accumulator.
    let sum = 0;
    for (let offset = 0; offset < checksumSize; offset += 2) {
        if (offset >= checksumOffset && offset < checksumOffset + 4) continue;
        sum = (sum + ((rom[offset] << 8) | rom[offset + 1])) >>> 0;
    }
    const snapshot = checksumSnapshots.get(rom);
    if (!snapshot || snapshot.offset !== checksumOffset || snapshot.size !== checksumSize) {
        checksumSnapshots.set(rom, { offset: checksumOffset, size: checksumSize, value: sum });
    }
    return sum;
}

export function preserveChecksum(rom: Uint8Array, originalChecksum?: number): boolean {
    if (SUPPORTED_ROM_SIZES.indexOf(rom.length) < 0) return false;
    const checksumSize = rom.length;
    let checksumOffset: number;
    try { checksumOffset = findChecksumOffset(rom); } catch (_) { return false; }
    const last = rom.length - COMPENSATION_BYTES;
    if (checksumOffset + 4 > last) return false;
    const snapshot = checksumSnapshots.get(rom);
    const original = originalChecksum ??
        (snapshot && snapshot.offset === checksumOffset && snapshot.size === checksumSize ? snapshot.value : undefined) ??
        calculateChecksum(rom, checksumOffset, checksumSize);
    const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
    const current = calculateChecksum(rom, checksumOffset, checksumSize);
    let tailSum = 0;
    for (let offset = last; offset < rom.length; offset += 2) {
        tailSum += view.getUint16(offset, false);
    }
    const base = (current - tailSum) >>> 0;
    let compensation = (original - base) >>> 0;
    // Check capacity before modifying any bytes.
    if (compensation > (COMPENSATION_BYTES / 2) * 0xffff) return false;
    for (let offset = last; offset < rom.length; offset += 2) {
        const word = Math.min(compensation, 0xffff);
        view.setUint16(offset, word, false);
        compensation -= word;
    }
    return true;
}
