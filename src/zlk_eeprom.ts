const Stk500 = require('stk500');
import { 
    ATMEGA48_BOARD, 
    SerialPortWrapper, 
    fetchHex, 
    uploadEeprom, 
    verifyEeprom,
    uploadFirmware 
} from './stk500utils';
import { patchEEPROM } from './eeprom';
import { v2Machines, v3Machines, allMachines } from './zlkMappings';
import abCheck from './abCheck';
import { loadBauartMap } from './bauartMap';
import { lookupMachineName } from './utils/bauartLookup';

export const dateInfo = [0x06, 0x32];

function generatePatchData(serial: string, key: string): { patch1: Uint8Array; patch2: Uint8Array } {
  if (!/^\d{9}$/.test(serial)) {
    throw new Error("Die Zulassungsnummer muss genau 9 Ziffern lang sein.");
  }

  const hexString = "0" + serial; // 5 bytes
  const hexBytes = Uint8Array.from(Buffer.from(hexString, "hex"));

  const machineBytes = (allMachines as Record<string, Uint8Array>)[key];
  if (!machineBytes) {
    throw new Error("Unbekannter Automat.");
  }

  return {
    patch1: new Uint8Array([...hexBytes, ...dateInfo, ...machineBytes]),
    patch2: new TextEncoder().encode(serial)
  };
}

declare global {
  interface Window {
    patchCode: () => void;
    populateMachines: () => void;
    updateMachineInfo: () => void;
    flashToAtmega: () => void;
    autoSelectMachine: () => void;
  }
}

export async function flashToAtmega(): Promise<void> {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const serial = serialInput.value.trim();
  const key = machineSelect.value;
  const statusText = <HTMLDivElement>document.getElementById('statusText');
  const progressBar = <HTMLProgressElement>document.getElementById('progressBar');

  if (!serial || !key) {
    if (statusText) statusText.textContent = "Bitte Zulassungsnummer und Automat wählen.";
    return;
  }

  try {
    progressBar.style.display = 'block';
    progressBar.value = 0;
    statusText.textContent = "Verbinde...";
    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: ATMEGA48_BOARD.baudRate });
    const wrapper = new SerialPortWrapper(port);
    wrapper.startReading();

    const stk = new Stk500();
    stk.log = () => {};

    await new Promise<void>((res, rej) => stk.sync(wrapper, 3, 2000, (err: any) => err ? rej(err) : res()));
    
    // Set parameters and enter programming mode
    const parameters = {
        devicecode: 0x41, parmode: 0x01, polling: 0x01, selftimed: 0x01,
        lockbytes: 1, fusebytes: 3, flashpollval1: 0xFF, flashpollval2: 0xFF,
        eeprompollval1: 0xFF, eeprompollval2: 0xFF,
        pagesizehigh: (ATMEGA48_BOARD.pageSize >> 8) & 0xFF,
        pagesizelow: ATMEGA48_BOARD.pageSize & 0xFF,
        eepromsizehigh: (ATMEGA48_BOARD.eepromSize >> 8) & 0xFF,
        eepromsizelow: ATMEGA48_BOARD.eepromSize & 0xFF,
        flashsize2: (ATMEGA48_BOARD.flashSize >> 8) & 0xFF,
        flashsize1: ATMEGA48_BOARD.flashSize & 0xFF
    };
    await new Promise<void>((res, rej) => stk.setOptions(wrapper, parameters, 2000, (err: any) => err ? rej(err) : res()));
    await new Promise<void>((res, rej) => stk.enterProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
    await new Promise<void>((res, rej) => stk.verifySignature(wrapper, ATMEGA48_BOARD.signature, 2000, (err: any) => err ? rej(err) : res()));

    // Flash firmware with progress
    statusText.textContent = "Flashing firmware...";
    const isV3 = key in v3Machines;
    const firmwareUrl = `https://yellow-cheerful-carp-910.mypinata.cloud/ipfs/bafybeih3vxwimlpwhkhbeipijk3mo4v6ierqgb65mapcyflh6ahtjcrwfe/firmware_${isV3 ? 'v3' : 'v2'}.bin`;
    const firmwareData = await fetchHex(firmwareUrl);
    await uploadFirmware(wrapper, stk, firmwareData, ATMEGA48_BOARD.pageSize, 10000, (status: string, pct: number) => {
      statusText.textContent = status;
      progressBar.value = pct;
    });

    // Patch and Flash EEPROM with progress
    statusText.textContent = "Flashing EEPROM...";
    const EEPROM_SIZE = 0x100;
    let eeprom = new Uint8Array(EEPROM_SIZE).fill(0xFF);
    if (abCheck()) eeprom.fill(0x00, 0, 0x4E);
    const { patch1, patch2 } = generatePatchData(serial, key);
    let patched = patchEEPROM({ file: eeprom.buffer as ArrayBuffer, startOffset: 0x40, newData: patch1 });
    patched = patchEEPROM({ file: patched.buffer as ArrayBuffer, startOffset: 0x28, newData: patch2 });

    await uploadEeprom(wrapper, stk, Buffer.from(patched), (status: string, pct: number) => {
      statusText.textContent = status;
      progressBar.value = pct;
    });

    await verifyEeprom(wrapper, stk, Buffer.from(patched));

    await new Promise<void>((res, rej) => stk.exitProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
    
    progressBar.value = 100;
    statusText.textContent = "Erfolgreich geflasht!";
    await wrapper.close();
    setTimeout(() => { progressBar.style.display = 'none'; }, 2000);
  } catch (err: any) {
    statusText.textContent = "Fehler: " + err.message;
    progressBar.style.display = 'none';
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

export function autoSelectMachine(): void {
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const machineNameInput = <HTMLInputElement>document.getElementById('machinename');
  const machineName = lookupMachineName(serialInput.value.trim()).toUpperCase();
  if (machineName) {
    machineNameInput.value = machineName;
    if (machineName in allMachines) {
      machineSelect.value = machineName;
      updateMachineInfo();
    }
  } else {
    machineNameInput.value = '';
  }
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

function handleUrlParams(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');
  if (q) {
    const serialInput = <HTMLInputElement>document.getElementById('serialInput');
    if (serialInput) {
      serialInput.value = q;
    }
  }
}

if (typeof window !== 'undefined') {
  window.patchCode = patchCode;
  window.populateMachines = populateMachines;
  window.updateMachineInfo = updateMachineInfo;
  window.flashToAtmega = flashToAtmega;
  window.autoSelectMachine = autoSelectMachine;
  
  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadBauartMap();
      populateMachines();
      handleUrlParams();
      autoSelectMachine();

      const serialInput = <HTMLInputElement>document.getElementById('serialInput');
      serialInput.addEventListener('input', autoSelectMachine);
    });
  }
}