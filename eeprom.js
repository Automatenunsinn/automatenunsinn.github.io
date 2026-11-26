export function patchEEPROM({ file, startOffset, newData }) {
    const eeprom = new Uint8Array(file);
    eeprom.set(newData, startOffset);
    return eeprom;
}
