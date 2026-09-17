const Stk500 = require('stk500');
import { Buffer } from 'buffer';
import {
  AT90S1200_BOARD,
  ATMEGA48_BOARD,
  BoardConfig,
  SerialPortWrapper,
  buildStkOptions,
  eraseChip,
  fetchHex,
  findBoardBySignature,
  readDeviceSignature,
  resetFusesToFactoryDefaults,
  uploadEeprom,
  uploadFirmware,
  verifyDeviceSignature,
  verifyEeprom,
  verifyFirmware
} from './stk500utils';
import { patchEEPROM } from './eeprom';
import { v2Machines, v3Machines, allMachines } from './zlkMappings';
import abCheck from './abCheck';
import { loadBauartMap } from './bauartMap';
import { lookupMachineName } from './utils/bauartLookup';
import { clearValidationState, setValidationState, downloadUint8Array } from './utils/ui';
import { loadFileFromUrl } from './utils/serial';

/** V1 base firmware, shipped next to the other files in the hex folder. */
const V1_FIRMWARE_URL = './hex/firmware_v1.bin';

/** V1 firmwares are 1 KB, some dumps carry a small trailer. */
const FIRMWARE_MIN_SIZE = 1024;
const FIRMWARE_MAX_SIZE = 1088;
const EEPROM_SIZE = 0x100;

/** Date written into the V2 EEPROM (06/32). */
export const dateInfo = [0x06, 0x32];

type CardType = 'v1' | 'v2';

const cardBoards: Record<CardType, BoardConfig> = {
  v1: AT90S1200_BOARD,
  v2: ATMEGA48_BOARD
};

function currentCardType(): CardType {
  const select = <HTMLSelectElement>document.getElementById('cardTypeSelect');
  return select && select.value === 'v1' ? 'v1' : 'v2';
}

// A V1 card only knows the older V2 machine firmware, a V2 card also knows V3.
function machinesForCardType(type: CardType): Record<string, Uint8Array> {
  return (type === 'v1' ? v2Machines : allMachines) as Record<string, Uint8Array>;
}

function setCardType(type: CardType): void {
  const select = <HTMLSelectElement>document.getElementById('cardTypeSelect');
  if (select) select.value = type;
  applyCardType();
}

export function populateMachines(): void {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  if (!machineSelect) return;

  const machines = machinesForCardType(currentCardType());
  const previous = machineSelect.value;
  machineSelect.innerHTML = '';

  for (const key in machines) {
    const option = <HTMLOptionElement>document.createElement('option');
    option.value = key;
    option.textContent = key;
    machineSelect.appendChild(option);
  }

  if (previous && previous in machines) machineSelect.value = previous;
}

export function updateMachineInfo(): void {
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const machineByteInput = <HTMLInputElement>document.getElementById('machinebyte');
  const machineTypeInput = <HTMLInputElement>document.getElementById('machinetype');
  const cardType = currentCardType();
  const key = machineSelect ? machineSelect.value : '';
  const machineBytes = key ? machinesForCardType(cardType)[key] : undefined;

  if (machineByteInput) {
    machineByteInput.value = machineBytes
      ? Array.from(machineBytes)
        .map((b: number) => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ')
      : '';
  }

  // The firmware generation is only of interest for a V2 card.
  if (machineTypeInput) {
    machineTypeInput.value = machineBytes && cardType === 'v2'
      ? (key in v2Machines ? '2️⃣' : '3️⃣')
      : '';
  }
}

export function autoSelectMachine(): void {
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const machineNameInput = <HTMLInputElement>document.getElementById('machinename');
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  if (!serialInput) return;

  const machineName = lookupMachineName(serialInput.value.trim()).toUpperCase();
  if (machineNameInput) machineNameInput.value = machineName;
  if (!machineName || !machineSelect) return;

  if (machineName in machinesForCardType(currentCardType())) {
    machineSelect.value = machineName;
    updateMachineInfo();
  }
}

/** Show only the fields the selected card type needs. */
export function applyCardType(): void {
  const cardType = currentCardType();
  const machineTypeWrapper = document.getElementById('machinetypeWrapper');
  const partNumber = document.getElementById('partNumber');
  const statusText = document.getElementById('statusText');

  if (machineTypeWrapper) machineTypeWrapper.style.display = cardType === 'v2' ? 'block' : 'none';
  if (partNumber) partNumber.textContent = cardType === 'v1' ? '3240/000201' : '3240/003001';
  if (statusText) statusText.textContent = '';

  populateMachines();
  autoSelectMachine();
  updateMachineInfo();
}

/** Patch machine code, registration number and date into a V1 firmware image. */
export function patchV1Firmware(buffer: Uint8Array, serial: string, machineBytes: Uint8Array): Uint8Array {
  // The machine code is the PTB number, e.g. "0287" for an ADP 1002.
  const caseId = Array.from(machineBytes)
    .map(b => b.toString(16).padStart(2, '0').toUpperCase())
    .join('')
    .padStart(4, '0')
    .slice(0, 4);

  const newBuffer = new Uint8Array(buffer);

  // Machine code (case ID) at offset 534.
  newBuffer[534] = 0x90 + (caseId.charCodeAt(1) - 48 & 0x0F);
  newBuffer[535] = 0xE0 + (caseId.charCodeAt(0) - 48 & 0x0F);
  newBuffer[536] = 0xA0 + (caseId.charCodeAt(3) - 48 & 0x0F);
  newBuffer[537] = 0xE0 + (caseId.charCodeAt(2) - 48 & 0x0F);

  // Registration number at offset 556.
  newBuffer[556] = 0x90 + (serial.charCodeAt(0) - 48 & 0x0F);
  newBuffer[557] = 0xE0;
  newBuffer[558] = 0xA0 + (serial.charCodeAt(2) - 48 & 0x0F);
  newBuffer[559] = 0xE0 + (serial.charCodeAt(1) - 48 & 0x0F);
  newBuffer[560] = 0xB0 + (serial.charCodeAt(4) - 48 & 0x0F);
  newBuffer[561] = 0xE0 + (serial.charCodeAt(3) - 48 & 0x0F);
  newBuffer[562] = 0xC0 + (serial.charCodeAt(6) - 48 & 0x0F);
  newBuffer[563] = 0xE0 + (serial.charCodeAt(5) - 48 & 0x0F);
  newBuffer[564] = 0xD0 + (serial.charCodeAt(8) - 48 & 0x0F);
  newBuffer[565] = 0xE0 + (serial.charCodeAt(7) - 48 & 0x0F);

  // Date (default '00') at offset 566.
  const date = '00';
  newBuffer[566] = 0xE0 + (date.charCodeAt(0) & 0x0F);
  newBuffer[567] = 0xE0 + ((date.charCodeAt(0) >> 4) & 0x0F);
  newBuffer[568] = 0xF0 + (date.charCodeAt(1) & 0x0F);
  newBuffer[569] = 0xE0 + ((date.charCodeAt(1) >> 4) & 0x0F);

  return newBuffer;
}

type V1FirmwareResult = { ok: true; firmware: Uint8Array } | { ok: false; message: string };

/** Load the V1 base firmware from the hex folder and patch it with the given data. */
async function loadV1Firmware(serial: string, machineBytes: Uint8Array): Promise<V1FirmwareResult> {
  const buffer = await loadFileFromUrl(V1_FIRMWARE_URL);
  if (!buffer) {
    return { ok: false, message: `Die Basis-Firmware ${V1_FIRMWARE_URL} konnte nicht geladen werden.` };
  }

  if (buffer.length < FIRMWARE_MIN_SIZE || buffer.length > FIRMWARE_MAX_SIZE) {
    return { ok: false, message: 'Die Basis-Firmware hat die falsche Größe. Das ist wahrscheinlich keine V1-Firmware.' };
  }
  if (buffer[0] !== 0x8C || buffer[1] !== 0xC0 ||
    buffer[buffer.length - 2] !== 0xA5 || buffer[buffer.length - 1] !== 0xCE) {
    return { ok: false, message: 'Ungültige Basis-Firmware. Die Datei muss mit 8C C0 beginnen und mit A5 CE enden.' };
  }

  return { ok: true, firmware: patchV1Firmware(buffer, serial, machineBytes) };
}

function generatePatchData(serial: string, key: string): { patch1: Uint8Array; patch2: Uint8Array } {
  const hexBytes = Uint8Array.from(Buffer.from('0' + serial, 'hex')); // 5 bytes
  const machineBytes = (allMachines as Record<string, Uint8Array>)[key];
  if (!machineBytes) throw new Error('Unbekannter Automat.');

  return {
    patch1: new Uint8Array([...hexBytes, ...dateInfo, ...machineBytes]),
    patch2: new TextEncoder().encode(serial)
  };
}

/** Build the 256 byte EEPROM image of a V2 card. */
export function buildV2Eeprom(serial: string, key: string): Uint8Array {
  const eeprom = new Uint8Array(EEPROM_SIZE).fill(0xFF);
  if (abCheck()) eeprom.fill(0x00, 0, 0x4E);

  const { patch1, patch2 } = generatePatchData(serial, key);
  let patched = patchEEPROM({ file: eeprom.buffer as ArrayBuffer, startOffset: 0x40, newData: patch1 });
  patched = patchEEPROM({ file: patched.buffer as ArrayBuffer, startOffset: 0x28, newData: patch2 });
  return patched;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function syncStk(stk: any, wrapper: SerialPortWrapper): Promise<void> {
  return new Promise<void>((res, rej) => stk.sync(wrapper, 3, 2000, (err: any) => err ? rej(err) : res()));
}

function setStkOptions(stk: any, wrapper: SerialPortWrapper, board: BoardConfig): Promise<void> {
  return new Promise<void>((res, rej) => stk.setOptions(wrapper, buildStkOptions(board), 2000, (err: any) => err ? rej(err) : res()));
}

function enterProgrammingMode(stk: any, wrapper: SerialPortWrapper): Promise<void> {
  return new Promise<void>((res, rej) => stk.enterProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
}

function exitProgrammingMode(stk: any, wrapper: SerialPortWrapper): Promise<void> {
  return new Promise<void>((res, rej) => stk.exitProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
}

function readStatusText(): HTMLDivElement {
  return <HTMLDivElement>document.getElementById('statusText');
}

function readProgressBar(): HTMLProgressElement {
  return <HTMLProgressElement>document.getElementById('progressBar');
}

/** Program a patched V1 firmware into the AT90S1200 of a V1 card. */
async function flashV1(wrapper: SerialPortWrapper, stk: any, firmware: Uint8Array): Promise<void> {
  const board = AT90S1200_BOARD;
  const statusText = readStatusText();
  const progressBar = readProgressBar();
  // A dump can carry a trailer, the AT90S1200 flash only holds 1 KB.
  const data = Buffer.from(firmware.slice(0, board.flashSize));

  if (statusText) statusText.textContent = 'Lösche Speicher...';
  await eraseChip(wrapper);
  if (progressBar) progressBar.value = 10;

  // The chip erase leaves programming mode.
  await exitProgrammingMode(stk, wrapper);
  await delay(100);
  await enterProgrammingMode(stk, wrapper);
  await verifyDeviceSignature(wrapper, board.signature);

  await uploadFirmware(wrapper, stk, data, board.pageSize, board.timeout, (status: string, pct: number) => {
    if (statusText) statusText.textContent = status;
    if (progressBar) progressBar.value = 10 + Math.floor((pct / 100) * 70);
  });

  if (statusText) statusText.textContent = 'Firmware verifizieren...';
  await verifyFirmware(wrapper, stk, data, board.pageSize, (status: string, pct: number) => {
    if (statusText) statusText.textContent = status;
    if (progressBar) progressBar.value = 80 + Math.floor((pct / 100) * 20);
  });

  await exitProgrammingMode(stk, wrapper);
}

/** Program firmware and EEPROM of a V2 card. */
async function flashV2(wrapper: SerialPortWrapper, stk: any, serial: string, key: string): Promise<void> {
  const board = ATMEGA48_BOARD;
  const statusText = readStatusText();
  const progressBar = readProgressBar();

  if (statusText) statusText.textContent = 'Setze Fuses zurück...';
  await resetFusesToFactoryDefaults(wrapper);
  if (progressBar) progressBar.value = 8;

  // Fuse writes take effect after reset. Re-enter ISP before chip erase so the
  // factory HFUSE (EESAVE=1) makes erase clear the EEPROM as well.
  await exitProgrammingMode(stk, wrapper);
  await delay(100);
  await enterProgrammingMode(stk, wrapper);
  await verifyDeviceSignature(wrapper, board.signature);

  if (statusText) statusText.textContent = 'Lösche Speicher...';
  await eraseChip(wrapper);
  if (progressBar) progressBar.value = 10;

  // Leave/re-enter once more after erase before programming.
  await exitProgrammingMode(stk, wrapper);
  await delay(100);
  await enterProgrammingMode(stk, wrapper);
  await verifyDeviceSignature(wrapper, board.signature);

  if (statusText) statusText.textContent = 'Flashing firmware...';
  const isV3 = key in v3Machines;
  const firmwareUrl = `https://yellow-cheerful-carp-910.mypinata.cloud/ipfs/bafybeih3vxwimlpwhkhbeipijk3mo4v6ierqgb65mapcyflh6ahtjcrwfe/firmware_${isV3 ? 'v3' : 'v2'}.bin`;
  const firmwareData = await fetchHex(firmwareUrl);
  await uploadFirmware(wrapper, stk, firmwareData, board.pageSize, board.timeout, (status: string, pct: number) => {
    if (statusText) statusText.textContent = status;
    if (progressBar) progressBar.value = 10 + Math.floor((pct / 100) * 45);
  });

  if (statusText) statusText.textContent = 'Firmware verifizieren...';
  await verifyFirmware(wrapper, stk, firmwareData, board.pageSize, (status: string, pct: number) => {
    if (statusText) statusText.textContent = status;
    if (progressBar) progressBar.value = 55 + Math.floor((pct / 100) * 15);
  });

  if (statusText) statusText.textContent = 'Flashing EEPROM...';
  const eeprom = Buffer.from(buildV2Eeprom(serial, key));
  await uploadEeprom(wrapper, stk, eeprom, (status: string, pct: number) => {
    if (statusText) statusText.textContent = status;
    if (progressBar) progressBar.value = pct;
  });

  await verifyEeprom(wrapper, stk, eeprom, (status: string, pct: number) => {
    if (statusText) statusText.textContent = status;
    if (progressBar) progressBar.value = pct;
  });

  await exitProgrammingMode(stk, wrapper);
}

/** Generate the file for the selected card type and download it. */
export async function patchCode(): Promise<void> {
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const statusText = <HTMLDivElement>document.getElementById('statusText');

  if (statusText) statusText.textContent = '';
  clearValidationState(serialInput);
  clearValidationState(machineSelect);

  const serial = serialInput ? serialInput.value.trim() : '';
  if (!/^\d{9}$/.test(serial)) {
    if (statusText) statusText.textContent = 'Die Zulassungsnummer muss genau 9 Ziffern lang sein.';
    setValidationState(serialInput, false);
    return;
  }

  const cardType = currentCardType();
  const key = machineSelect ? machineSelect.value : '';
  const machineBytes = key ? machinesForCardType(cardType)[key] : undefined;
  if (!machineBytes) {
    if (statusText) statusText.textContent = 'Bitte wählen Sie eine Maschine aus.';
    setValidationState(machineSelect, false);
    return;
  }

  if (cardType === 'v1') {
    if (statusText) statusText.textContent = 'Basis-Firmware laden...';
    const result = await loadV1Firmware(serial, machineBytes);
    if (!result.ok) {
      if (statusText) statusText.textContent = result.message;
      return;
    }
    downloadUint8Array(result.firmware, `zlk_v1_${serial}.bin`);
    if (statusText) statusText.textContent = `ZLK V1 Firmware für ${serial} erstellt.`;
    return;
  }

  downloadUint8Array(buildV2Eeprom(serial, key), 'eeprom.bin');
  if (statusText) statusText.textContent = `ZLK V2 EEPROM für ${serial} erstellt.`;
}

/**
 * Read the signature of the connected MCU and flash the matching card version,
 * independent of the type selected in the dropdown.
 */
export async function flashCard(): Promise<void> {
  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
  const statusText = <HTMLDivElement>document.getElementById('statusText');
  const progressBar = <HTMLProgressElement>document.getElementById('progressBar');

  if (statusText) statusText.textContent = '';
  clearValidationState(serialInput);
  clearValidationState(machineSelect);

  const serial = serialInput ? serialInput.value.trim() : '';
  if (!/^\d{9}$/.test(serial)) {
    if (statusText) statusText.textContent = 'Die Zulassungsnummer muss genau 9 Ziffern lang sein.';
    setValidationState(serialInput, false);
    return;
  }

  const selectedType = currentCardType();
  const key = machineSelect ? machineSelect.value : '';
  if (!key || !machinesForCardType(selectedType)[key]) {
    if (statusText) statusText.textContent = 'Bitte wählen Sie eine Maschine aus.';
    setValidationState(machineSelect, false);
    return;
  }

  let wrapper: SerialPortWrapper | null = null;

  try {
    if (progressBar) {
      progressBar.style.display = 'block';
      progressBar.value = 0;
    }
    if (statusText) statusText.textContent = 'Verbinde...';

    const port = await (navigator as any).serial.requestPort();
    await port.open({ baudRate: cardBoards[selectedType].baudRate });
    wrapper = new SerialPortWrapper(port);
    wrapper.startReading();

    const stk = new Stk500();
    stk.log = () => {};

    await syncStk(stk, wrapper);
    // The programmer is set up for an ATmega48 first, the signature read from
    // the MCU decides afterwards which card is really connected.
    await setStkOptions(stk, wrapper, ATMEGA48_BOARD);
    await enterProgrammingMode(stk, wrapper);

    const signature = await readDeviceSignature(wrapper);
    const board = findBoardBySignature(signature);
    if (!board) {
      throw new Error(`Unbekannter Mikrocontroller (Signatur ${signature.toString('hex').toUpperCase()}).`);
    }

    const cardType: CardType = board.signature.equals(AT90S1200_BOARD.signature) ? 'v1' : 'v2';
    if (progressBar) progressBar.value = 5;

    if (cardType !== selectedType) {
      // Follow the connected card: the dropdown only picks the generated file.
      setCardType(cardType);
    }

    if (!board.signature.equals(ATMEGA48_BOARD.signature)) {
      // Configure the programmer for the detected device before touching it.
      await exitProgrammingMode(stk, wrapper);
      await delay(100);
      await setStkOptions(stk, wrapper, board);
      await enterProgrammingMode(stk, wrapper);
      await verifyDeviceSignature(wrapper, board.signature);
    }

    if (statusText) {
      statusText.textContent = `${board.name} erkannt: ZLK ${cardType === 'v1' ? 'V1' : 'V2'} wird geschrieben...`;
    }

    const machineBytes = machinesForCardType(cardType)[key];
    if (!machineBytes) {
      throw new Error(`Den Automaten "${key}" gibt es für eine ZLK ${cardType === 'v1' ? 'V1' : 'V2'} nicht.`);
    }

    if (cardType === 'v1') {
      if (statusText) statusText.textContent = 'Basis-Firmware laden...';
      const result = await loadV1Firmware(serial, machineBytes);
      if (!result.ok) throw new Error(result.message);
      await flashV1(wrapper, stk, result.firmware);
    } else {
      await flashV2(wrapper, stk, serial, key);
    }

    if (progressBar) progressBar.value = 100;
    if (statusText) statusText.textContent = `Erfolgreich geflasht! (${board.name})`;
  } catch (err: any) {
    if (statusText) statusText.textContent = 'Fehler: ' + err.message;
    if (progressBar) progressBar.style.display = 'none';
  } finally {
    if (wrapper) await wrapper.close();
    setTimeout(() => {
      const bar = readProgressBar();
      if (bar) bar.style.display = 'none';
    }, 2000);
  }
}

function handleUrlParams(): void {
  const urlParams = new URLSearchParams(window.location.search);
  const q = urlParams.get('q');
  if (!q) return;

  const serialInput = <HTMLInputElement>document.getElementById('serialInput');
  if (serialInput) serialInput.value = q;
}

declare global {
  interface Window {
    patchCode: () => Promise<void>;
    flashCard: () => Promise<void>;
    updateCardType: () => void;
  }
}

if (typeof window !== 'undefined') {
  window.patchCode = patchCode;
  window.flashCard = flashCard;
  window.updateCardType = applyCardType;

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
      await loadBauartMap();
      applyCardType();
      handleUrlParams();
      autoSelectMachine();

      const serialInput = <HTMLInputElement>document.getElementById('serialInput');
      if (serialInput) serialInput.addEventListener('input', autoSelectMachine);

      const machineSelect = <HTMLSelectElement>document.getElementById('machineSelect');
      if (machineSelect) machineSelect.addEventListener('change', updateMachineInfo);
    });
  }
}
