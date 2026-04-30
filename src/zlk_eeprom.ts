const Stk500 = require('stk500');
import { 
    ATMEGA48_BOARD, 
    SerialPortWrapper, 
    fetchHex, 
    uploadEeprom, 
    verifyEeprom 
} from './stk500utils';
import { patchEEPROM } from './eeprom';
import { v2Machines, v3Machines, allMachines } from './zlkMappings';
import abCheck from './abCheck';
import { bauartMap, loadBauartMap } from './bauartMap';

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
    flashToAtmega: () => void;
  }
}

export async function flashToAtmega(): Promise<void> {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const serial = serialInput.value.trim();
  const key = machineSelect.value;
  const statusText = <HTMLDivElement>document.getElementById('statusText');

  if (!serial || !key) {
    if (statusText) statusText.textContent = "Bitte Zulassungsnummer und Automat wählen.";
    return;
  }

  try {
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
        lockbytes: 1, fusebytes: 3, flashpollval1: 0xff, flashpollval2: 0xff,
        eeprompollval1: 0xff, eeprompollval2: 0xff,
        pagesizehigh: (ATMEGA48_BOARD.pageSize >> 8) & 0xff,
        pagesizelow: ATMEGA48_BOARD.pageSize & 0xff,
        eepromsizehigh: (ATMEGA48_BOARD.eepromSize >> 8) & 0xff,
        eepromsizelow: ATMEGA48_BOARD.eepromSize & 0xff,
        flashsize2: (ATMEGA48_BOARD.flashSize >> 8) & 0xff,
        flashsize1: ATMEGA48_BOARD.flashSize & 0xff
    };
    await new Promise<void>((res, rej) => stk.setOptions(wrapper, parameters, 2000, (err: any) => err ? rej(err) : res()));
    await new Promise<void>((res, rej) => stk.enterProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
    await new Promise<void>((res, rej) => stk.verifySignature(wrapper, ATMEGA48_BOARD.signature, 2000, (err: any) => err ? rej(err) : res()));

    // Flash firmware
    statusText.textContent = "Flashing firmware...";
    const isV3 = key in v3Machines;
    const firmwareUrl = `https://yellow-cheerful-carp-910.mypinata.cloud/ipfs/bafybeih3vxwimlpwhkhbeipijk3mo4v6ierqgb65mapcyflh6ahtjcrwfe/firmware_${isV3 ? 'v3' : 'v2'}.bin`;
    const firmwareData = await fetchHex(firmwareUrl);
    await new Promise<void>((res, rej) => stk.upload(wrapper, firmwareData, ATMEGA48_BOARD.pageSize, 10000, (err: any) => err ? rej(err) : res()));

    // Patch and Flash EEPROM
    statusText.textContent = "Flashing EEPROM...";
    const EEPROM_SIZE = 256;
    let eeprom = new Uint8Array(EEPROM_SIZE).fill(0xFF);
    if (abCheck()) eeprom.fill(0x00, 0, 0x4E);
    const { patch1, patch2 } = generatePatchData(serial, key);
    let patched = patchEEPROM({ file: eeprom.buffer as ArrayBuffer, startOffset: 64, newData: patch1 });
    patched = patchEEPROM({ file: patched.buffer as ArrayBuffer, startOffset: 40, newData: patch2 });

    await uploadEeprom(wrapper, stk, Buffer.from(patched), (s: string) => statusText.textContent = s);
    await verifyEeprom(wrapper, stk, Buffer.from(patched));

    await new Promise<void>((res, rej) => stk.exitProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
    
    statusText.textContent = "Erfolgreich geflasht!";
    await wrapper.close();
  } catch (err: any) {
    statusText.textContent = "Fehler: " + err.message;
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
  const value = serialInput.value.trim();
  if (value.length >= 4) {
    const prefix = value.slice(0, 4);
    const machineName = bauartMap[prefix];
    if (machineName) {
      machineNameInput.value = machineName;
      if (machineName in allMachines) {
        machineSelect.value = machineName;
        updateMachineInfo();
      }
    } else {
      machineNameInput.value = '';
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