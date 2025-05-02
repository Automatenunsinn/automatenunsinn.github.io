export interface MachineConfig {
  [key: string]: Uint8Array;
}

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

export function generatePatchData(machineSerial: string, machineKey: string, v2Machines: MachineConfig, v3Machines: MachineConfig): { patch1: Uint8Array, patch2: Uint8Array } {
  if (!/^\d{9}$/.test(machineSerial)) {
    throw new Error("Machine serial must be exactly 9 digits.");
  }

  const hexString = "0" + machineSerial;
  const hexBytes = Uint8Array.from(Buffer.from(hexString, "hex"));

  const machineBytes = v2Machines[machineKey] || v3Machines[machineKey];
  if (!machineBytes) {
    throw new Error("Unknown machine key.");
  }

  return {
    patch1: new Uint8Array([...hexBytes, ...machineBytes]), // offset 64
    patch2: new TextEncoder().encode(machineSerial)          // offset 40
  };
}
