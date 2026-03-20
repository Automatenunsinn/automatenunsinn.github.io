import { v2Machines } from './zlkMappings';

declare global {
  interface Window {
    patchFirmware: () => void;
    populateMachines: () => void;
    updateMachineInfo: () => void;
  }
}

export function populateMachines() {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  if (!machineSelect) return;

  for (const key in v2Machines) {
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

  const machineBytes = (v2Machines as Record<string, Uint8Array>)[key];
  if (!machineBytes) {
    machineByteInput.value = '';
    machineTypeInput.value = '';
    return;
  }

  const bytesHex = Array.from(machineBytes)
    .map((b: number) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');

  machineByteInput.value = `${bytesHex}`;
}

async function patchFirmware(): Promise<void> {
  const firmwareUpload = <HTMLInputElement>document.getElementById('firmwareUpload');
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const statusText = <HTMLDivElement>document.getElementById('statusText');

  // Clear previous status and failure classes
  if (statusText) statusText.textContent = "";
  firmwareUpload.classList.remove("failure");
  serialInput.classList.remove("failure");
  machineSelect.classList.remove("failure");

  if (!firmwareUpload.files || firmwareUpload.files.length === 0) {
    if (statusText) statusText.textContent = "Bitte eine Firmware-Datei auswählen.";
    firmwareUpload.classList.add("failure");
    return;
  }

  const serial = serialInput.value.trim();
  if (!/^\d{9}$/.test(serial)) {
    if (statusText) statusText.textContent = "Die Zulassungsnummer muss genau 9 Ziffern lang sein.";
    serialInput.classList.add("failure");
    return;
  }

  const machineKey = machineSelect.value;
  const machineBytes = (v2Machines as Record<string, Uint8Array>)[machineKey];
  if (!machineBytes) {
    if (statusText) statusText.textContent = "Ungültige Maschine ausgewählt.";
    machineSelect.classList.add("failure");
    return;
  }

  // Machine PTB code is usually the hex representation of machineBytes as a string
  // In Python script it was like '0287'
  const ptbCodeStr = Array.from(machineBytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join('');
  
  // Pad or truncate to 4 chars if necessary (though they seem to be 4 already)
  const caseId = ptbCodeStr.padStart(4, '0').slice(0, 4);

  try {
    const file = firmwareUpload.files[0];
    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    if (buffer.length < 1024 || buffer.length > 1088) {
      if (statusText) statusText.textContent = "Die hochgeladene Datei hat die falsche Größe. Das ist wahrscheinlich keine Firmware.";
      firmwareUpload.classList.add("failure");
      return;
    }

    // Validation: Check if file starts with 0x8C 0xC0 and ends with 0xA5 0xCE
    if (buffer[0] !== 0x8C || buffer[1] !== 0xC0 || 
        buffer[buffer.length - 2] !== 0xA5 || buffer[buffer.length - 1] !== 0xCE) {
      if (statusText) statusText.textContent = "Ungültige Firmware-Datei. Die Datei muss mit 8C C0 beginnen und mit A5 CE enden.";
      firmwareUpload.classList.add("failure");
      return;
    }

    const newBuffer = new Uint8Array(buffer);

    // Patch Machine Code (Case ID)
    // new_buffer += struct.pack('>B', 144 + (case_identification_number[1] - 48 & 15))
    // 144 = 0x90, 48 = ASCII '0'
    newBuffer[534] = 0x90 + (caseId.charCodeAt(1) - 48 & 0x0F);
    newBuffer[535] = 0xE0 + (caseId.charCodeAt(0) - 48 & 0x0F);
    newBuffer[536] = 0xA0 + (caseId.charCodeAt(3) - 48 & 0x0F);
    newBuffer[537] = 0xE0 + (caseId.charCodeAt(2) - 48 & 0x0F);

    // Patch Registration Number
    // Offset 556 (538 + 18)
    const reg = serial;
    newBuffer[556] = 0x90 + (reg.charCodeAt(0) - 48 & 0x0F);
    newBuffer[557] = 0xE0;
    newBuffer[558] = 0xA0 + (reg.charCodeAt(2) - 48 & 0x0F);
    newBuffer[559] = 0xE0 + (reg.charCodeAt(1) - 48 & 0x0F);
    newBuffer[560] = 0xB0 + (reg.charCodeAt(4) - 48 & 0x0F);
    newBuffer[561] = 0xE0 + (reg.charCodeAt(3) - 48 & 0x0F);
    newBuffer[562] = 0xC0 + (reg.charCodeAt(6) - 48 & 0x0F);
    newBuffer[563] = 0xE0 + (reg.charCodeAt(5) - 48 & 0x0F);
    newBuffer[564] = 0xD0 + (reg.charCodeAt(8) - 48 & 0x0F);
    newBuffer[565] = 0xE0 + (reg.charCodeAt(7) - 48 & 0x0F);

    // Patch Date (default '00')
    const date = "00";
    newBuffer[566] = 0xE0 + (date.charCodeAt(0) & 0x0F);
    newBuffer[567] = 0xE0 + ((date.charCodeAt(0) >> 4) & 0x0F);
    newBuffer[568] = 0xF0 + (date.charCodeAt(1) & 0x0F);
    newBuffer[569] = 0xE0 + ((date.charCodeAt(1) >> 4) & 0x0F);

    // Download
    const blob = new Blob([newBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zlk_v1_${serial}.bin`;
    a.click();
    URL.revokeObjectURL(url);

    if (statusText) statusText.textContent = "Erfolgreich gepatcht!";
  } catch (err: any) {
    if (statusText) statusText.textContent = "Fehler beim Patchen: " + err.message;
  }
}

if (typeof window !== 'undefined') {
  window.patchFirmware = patchFirmware;
  window.populateMachines = populateMachines;
  window.updateMachineInfo = updateMachineInfo;
  
  document.addEventListener('DOMContentLoaded', () => {
    populateMachines();
    updateMachineInfo();
  });
}
