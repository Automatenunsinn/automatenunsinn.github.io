import { CustomBase32 } from './base32';
import { Xtea } from './xtea';
import { crc81wire } from 'crc';
import { generatePatchData } from './eeprom';
import abCheck from './abCheck';

// Helper function to use crc81wire with Uint8Array (crc library has incompatible types)
const calculateCrc8 = (data: Uint8Array): number => (crc81wire as any)(data, 255);

declare global {
  interface Window {
    parseCode: () => void;
    genCode: () => void;
    maxDate: () => void;
    addTwoYears: () => void;
    checkLength: (input: HTMLInputElement, maxLen: number, nextId: string | null) => void;
    handlePaste: (event: ClipboardEvent) => void;
    copyCode: () => void;
  }
}

export class Fsc {
  private randomId: number; // ushort
  private homologationId: number; // uint
  private programId: number; // uint
  private date: Date | null = null;
  private crypto: Xtea | null = null;

  get RandomId(): number {
    return this.randomId;
  }

  get HomologationId(): number {
    return this.homologationId;
  }

  get ProgramId(): number {
    return this.programId;
  }

  get Date(): Date | null {
    return this.date;
  }

  private static insertChar(input: string, pos: number, character: string): string {
    return [input.slice(0, pos), character, input.slice(pos)].join("");
  }

  private static addHyphens(code: string): string {
    let output = this.insertChar(code, 20, '-');
    output = this.insertChar(output, 15, '-');
    output = this.insertChar(output, 10, '-');
    output = this.insertChar(output, 5, '-');
    return output;
  }

  private static generateBauartKey(keyInd: number, masterKey: number[]): number[] {
    const bauartKey = [...masterKey];
    if (keyInd !== 0) {
      for (let i = 0; i < 4; i++) {
        bauartKey[i] += keyInd + 21545;
        bauartKey[i] -= (~keyInd << 16) + 880279552;
      }
    }
    return bauartKey;
  }

  private setKeyInd(keyInd: number): void {
    const masterKey = [1878738899, 2928249263, 3927923331, 606835660];
    const bauartKey = Fsc.generateBauartKey(keyInd, masterKey);
    this.crypto = new Xtea();
    this.crypto.init(bauartKey, 29);
  }

  public decrypt(code: string, keyInd: number = 0): Uint8Array {
    const input = CustomBase32.base32Decode(code);
    if (input.length % 8 != 0) {
      throw new Error('Invalid input length');
    }

    this.setKeyInd(keyInd);
    const result = new Uint8Array(16);
    const segment1 = input.subarray(0, 8);
    const segment2 = input.subarray(8, 16);

    if (!this.crypto) {
      throw new Error('Xtea not initialized');
    }


    this.crypto.setData(segment1);
    this.crypto.decrypt();
    result.set(this.crypto.getData(), 0);

    this.crypto.setData(segment2);
    this.crypto.decrypt();
    result.set(this.crypto.getData(), 8);

    if (calculateCrc8(result.subarray(0, 15)) !== result[15]) {
      throw new Error('Crc8 failure decoding key');
    }

    // Extract data
    this.randomId = new DataView(result.buffer).getUint16(0, true); // Little-endian
    this.homologationId = new DataView(result.buffer).getUint32(2, true); // Little-endian
    this.programId = new DataView(result.buffer).getUint32(6, true); // Little-endian
    const year = result[10];
    const month = result[11];
    const day = result[12];
    this.date = year && month && day ? new Date(2000 + year, month - 1, day + 1) : null;
    return result;
  }

  public encryptFsc(date: Date): string {
    const plaintext = new Uint8Array(16);
    new DataView(plaintext.buffer).setUint32(0, this.homologationId, true); // Little-endian
    new DataView(plaintext.buffer).setUint16(7, this.randomId, true); // Little-endian
    plaintext[4] = date.getFullYear() - 2000;
    plaintext[5] = date.getMonth() + 1;
    plaintext[6] = date.getDate();

    const keyInd = (this.homologationId >> 5) / 3125 & 0xffff;
    return Fsc.addHyphens(this.encrypt(plaintext, keyInd));
  }

  public encrypt(plaintext: Uint8Array, keyInd: number): string {

    plaintext[15] = calculateCrc8(plaintext.subarray(0, 15)) + 1;
    this.setKeyInd(keyInd);

    const encrypted = new Uint8Array(16);
    const segment1 = plaintext.subarray(0, 8);
    const segment2 = plaintext.subarray(8, 16);

    if (!this.crypto) {
      throw new Error('Xtea not initialized');
    }

    this.crypto.setData(segment1);
    this.crypto.encrypt();
    encrypted.set(this.crypto.getData(), 0);

    if (abCheck()) this.crypto.setData(segment2);
    this.crypto.encrypt();
    encrypted.set(this.crypto.getData(), 8);

    return CustomBase32.base32Encode(encrypted);
  }

  public createKc(homologationId: number, enableCode: number): string {
    const array = new Uint8Array(8);
    new DataView(array.buffer).setUint32(0, homologationId, true);
    new DataView(array.buffer).setUint16(4, enableCode, true);

    array[7] = calculateCrc8(array.subarray(0, 7));

    this.setKeyInd(4712);

    const encrypted = new Uint8Array(8);
    if (!this.crypto) {
      throw new Error('Xtea not initialized');
    }

    this.crypto.setData(array);
    this.crypto.encrypt();
    encrypted.set(this.crypto.getData());

    return CustomBase32.base32Encode(encrypted);
  }
}

let bcrypto = new Fsc();

export function handlePaste(event: ClipboardEvent) {
  const pastedText = event.clipboardData?.getData('text');
  if (!pastedText) return;

  // Parse the pasted text more robustly
  const parsed = parseCodeString(pastedText);

  if (parsed) {
    event.preventDefault(); // Prevent default paste behavior

    // Fill the input fields
    (<HTMLInputElement>document.getElementById("code1")).value = parsed[0];
    (<HTMLInputElement>document.getElementById("code2")).value = parsed[1];
    (<HTMLInputElement>document.getElementById("code3")).value = parsed[2];
    (<HTMLInputElement>document.getElementById("code4")).value = parsed[3];
    (<HTMLInputElement>document.getElementById("code5")).value = parsed[4];

    // Trigger parsing
    parseCode();
  }
  // If it doesn't match, let the default paste behavior happen
}

export function parseCodeString(input: string): string[] | null {
  // Remove all spaces, dashes, underscores, and dots, keep only alphanumeric characters
  const cleanInput = input.replace(/[\s\-_.]/g, '').toUpperCase();

  // Check if we have exactly 26 characters
  if (cleanInput.length !== 26) {
    return null;
  }

  // Validate all characters are in the allowed base32 set [1-9A-Z]
  const validChars = /^[1-9A-Z]+$/;
  if (!validChars.test(cleanInput)) {
    return null;
  }

  // Split into groups: 5, 5, 5, 5, 6
  const groups = [
    cleanInput.substring(0, 5),
    cleanInput.substring(5, 10),
    cleanInput.substring(10, 15),
    cleanInput.substring(15, 20),
    cleanInput.substring(20, 26)
  ];

  return groups;
}

export function copyCode() {
  const code = (<HTMLInputElement>document.getElementById("out1")).value +
    '-' + (<HTMLInputElement>document.getElementById("out2")).value +
    '-' + (<HTMLInputElement>document.getElementById("out3")).value +
    '-' + (<HTMLInputElement>document.getElementById("out4")).value +
    '-' + (<HTMLInputElement>document.getElementById("out5")).value;

  navigator.clipboard.writeText(code).then(() => {
    // Optional: Show some feedback that the code was copied
    console.log('Code copied to clipboard');
  }).catch(err => {
    console.error('Failed to copy code: ', err);
  });
}

export function parseCode() {
  const code: string = (<HTMLInputElement>document.getElementById("code1")).value +
    (<HTMLInputElement>document.getElementById("code2")).value +
    (<HTMLInputElement>document.getElementById("code3")).value +
    (<HTMLInputElement>document.getElementById("code4")).value +
    (<HTMLInputElement>document.getElementById("code5")).value;
  try {
    bcrypto.decrypt(code);
    (<HTMLInputElement>document.getElementById("date")).valueAsDate = bcrypto.Date;
    for (let i = 1; i <= 5; i++) {
      const input = <HTMLInputElement>document.getElementById("code" + i);
      input.classList.remove("failure");
      input.classList.add("success");
    }
  } catch(e) {
    for (let i = 1; i <= 5; i++) {
      const input = <HTMLInputElement>document.getElementById("code" + i);
      input.classList.remove("success");
      input.classList.add("failure");
    }
  }
}

export function genCode() {
  try {
    const ndate: Date = ((<HTMLInputElement>document.getElementById("date")).valueAsDate!);
    const fsc = bcrypto.encryptFsc(ndate);
    const parts = fsc.split('-');
    for (let i = 1; i <= 5; i++) {
      (<HTMLInputElement>document.getElementById("out" + i)).value = parts[i - 1];
    }
    (<HTMLInputElement>document.getElementById("date")).className = "success";
  } catch(e) {
    (<HTMLInputElement>document.getElementById("date")).className = "failure";
  }
}

export function maxDate() {
  (<HTMLInputElement>document.getElementById("date")).value = "2089-01-01";
}

export function addTwoYears() {
  const dateInput = <HTMLInputElement>document.getElementById("date");
  const currentDate = dateInput.valueAsDate;
  if (currentDate) {
    const newDate = new Date(currentDate);
    newDate.setFullYear(newDate.getFullYear() + 2);
    dateInput.valueAsDate = newDate;
  }
}

export function checkLength(input: HTMLInputElement, maxLen: number, nextId: string | null) {
  if (input.value.length === maxLen) {
    if (nextId) {
      const nextInput = document.getElementById(nextId) as HTMLInputElement;
      if (nextInput) {
        nextInput.focus();
      }
    } else {
      // Last field, parse the code
      parseCode();
    }
  }
}

if (typeof window !== 'undefined') {
  window.parseCode = parseCode;
  window.genCode = genCode;
  window.maxDate = maxDate;
  window.addTwoYears = addTwoYears;
  window.checkLength = checkLength;
  window.handlePaste = handlePaste;
  window.copyCode = copyCode;
}