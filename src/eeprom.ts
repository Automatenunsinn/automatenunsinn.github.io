export interface PatchOptions {
  file: ArrayBuffer;
  startOffset: number;
  newData: Uint8Array;
}

export function patchEEPROM({ file, startOffset, newData }: PatchOptions): Uint8Array {
  const eeprom = new Uint8Array(file);
  eeprom.set(newData, startOffset);
  return eeprom;
}
