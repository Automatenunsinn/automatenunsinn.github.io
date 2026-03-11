import { patchEEPROM, generatePatchData } from './eeprom';
import { v2Machines, v3Machines, allMachines } from './zlkMappings';
import abCheck from './abCheck';

declare global {
  interface Window {
    patchCode: () => void;
    populateMachines: () => void;
  }
}

export function populateMachines() {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  for (const key in allMachines) {
    const option = <HTMLOptionElement>document.createElement('option');
    option.value = key;
    option.textContent = key;
    machineSelect.appendChild(option);
  }
}

export default function patchCode(): void {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const serial = (<HTMLInputElement>document.getElementById('serialInput')).value.trim();
  const key = machineSelect.value;

  if (!serial) return alert("Bitte die neunstellige Zulassungsnummer eingeben.");

  try {
    const EEPROM_SIZE = 256;
    let eeprom = new Uint8Array(EEPROM_SIZE).fill(0xFF);
    if (abCheck()) eeprom.fill(0x00, 0, 0x4E);

    const { patch1, patch2 } = generatePatchData(serial, key, v2Machines, v3Machines);

    let patched = patchEEPROM({ file: eeprom.buffer as ArrayBuffer, startOffset: 64, newData: patch1 });
    patched = patchEEPROM({ file: patched.buffer as ArrayBuffer, startOffset: 40, newData: patch2 });

    const blob = new Blob([patched as BlobPart], { type: "application/octet-stream" });
    const dataUrl = URL.createObjectURL(blob);

    const a = <HTMLAnchorElement>document.getElementById('downloadButton');
    a.href = dataUrl;
    a.download = 'eeprom.bin';
    a.click();

  } catch (err: any) {
    alert("Error: " + err.message);
  }
}

if (typeof window !== 'undefined') {
  window.patchCode = patchCode;
  window.populateMachines = populateMachines;
  populateMachines();
}