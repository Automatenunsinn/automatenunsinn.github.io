import { patchEEPROM } from './eeprom';
import { v2Machines, v3Machines, allMachines } from './zlkMappings';
import abCheck from './abCheck';

export const zlkHeader = [0x06, 0x32];

function generatePatchData(serial: string, key: string): { patch1: Uint8Array; patch2: Uint8Array } {
  if (!/^\d{9}$/.test(serial)) {
    throw new Error("Die Zulassungsnummer muss genau 9 Ziffern lang sein.");
  }

  const hexString = "0" + serial;
  const hexBytes = Uint8Array.from(Buffer.from(hexString, "hex"));

  const machineBytes = (allMachines as Record<string, Uint8Array>)[key];
  if (!machineBytes) {
    throw new Error("Unbekannter Automat.");
  }

  return {
    patch1: new Uint8Array([...hexBytes, ...zlkHeader, ...machineBytes]),
    patch2: new TextEncoder().encode(serial)
  };
}

declare global {
  interface Window {
    patchCode: () => void;
    populateMachines: () => void;
    updateMachineInfo: () => void;
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
  machineSelect.addEventListener('change', updateMachineInfo);
}

export function updateMachineInfo(): void {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const machineByteInput = <HTMLInputElement>document.getElementById('machinebyte');
  const machineTypeInput = <HTMLInputElement>document.getElementById('machinetype');
  const key = machineSelect.value;

  if (!key) {
    machineByteInput.value = '';
    machineTypeInput.value = '';
    return;
  }

  const machineBytes = (allMachines as Record<string, Uint8Array>)[key];
  if (!machineBytes) {
    machineByteInput.value = '';
    machineTypeInput.value = '';
    return;
  }

  // Determine type (v2 or v3)
  const type = key in v2Machines ? '2️⃣' : '3️⃣';

  // Format machinebytes as hex (e.g., "02 87")
  const bytesHex = Array.from(machineBytes)
    .map((b: number) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  machineByteInput.value = `${bytesHex}`;
  machineTypeInput.value = `${type}`;
}

export default function patchCode(): void {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const serial = serialInput.value.trim();
  const key = machineSelect.value;
  const statusText = <HTMLDivElement>document.getElementById('statusText');

  // Clear previous status and failure classes
  if (statusText) statusText.textContent = "";
  serialInput.classList.remove("failure");
  machineSelect.classList.remove("failure");

  if (!serial) {
    if (statusText) statusText.textContent = "Bitte die neunstellige Zulassungsnummer eingeben.";
    serialInput.classList.add("failure");
    return;
  }

  try {
    const EEPROM_SIZE = 256;
    let eeprom = new Uint8Array(EEPROM_SIZE).fill(0xFF);
    if (abCheck()) eeprom.fill(0x00, 0, 0x4E);

    const { patch1, patch2 } = generatePatchData(serial, key);

    let patched = patchEEPROM({ file: eeprom.buffer as ArrayBuffer, startOffset: 64, newData: patch1 });
    patched = patchEEPROM({ file: patched.buffer as ArrayBuffer, startOffset: 40, newData: patch2 });

    const blob = new Blob([patched as BlobPart], { type: "application/octet-stream" });
    const dataUrl = URL.createObjectURL(blob);

    const a = <HTMLAnchorElement>document.getElementById('downloadButton');
    a.href = dataUrl;
    a.download = 'eeprom.bin';
    a.click();

    if (statusText) statusText.textContent = "Erfolgreich generiert!";

  } catch (err: any) {
    if (statusText) statusText.textContent = "Fehler: " + err.message;
    if (err.message.includes("serial") || err.message.includes("Serial")) {
        serialInput.classList.add("failure");
    }
    if (err.message.includes("machine") || err.message.includes("Machine")) {
        machineSelect.classList.add("failure");
    }
  }
}

if (typeof window !== 'undefined') {
  window.patchCode = patchCode;
  window.populateMachines = populateMachines;
  window.updateMachineInfo = updateMachineInfo;
  populateMachines();
}