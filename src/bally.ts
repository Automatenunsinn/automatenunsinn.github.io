import { CustomBase32 } from './base32';
import { Xtea } from './xtea';
import { Crc8 } from './crc8';
import { generatePatchData } from './eeprom';

declare global {
  interface Window {
    parseCode: () => void;
    genCode: () => void;
    maxDate: () => void;
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

    if (Crc8.calculateCrc8(result.subarray(0, 15)) !== result[15]) {
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

    plaintext[15] = Crc8.calculateCrc8(plaintext.subarray(0, 15)) + 1;
    console.log(plaintext);
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

    this.crypto.setData(segment2);
    this.crypto.encrypt();
    encrypted.set(this.crypto.getData(), 8);

    return CustomBase32.base32Encode(encrypted);
  }

  public createKc(homologationId: number, enableCode: number): string {
    const array = new Uint8Array(8);
    new DataView(array.buffer).setUint32(0, homologationId, true); // Little-endian
    new DataView(array.buffer).setUint16(4, enableCode, true); // Little-endian

    array[7] = Crc8.calculateCrc8(array.subarray(0, 7));

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

export function parseCode() {
  const code: string = (<HTMLInputElement>document.getElementById("code")).value;
  try {
    bcrypto.decrypt(code);
    (<HTMLInputElement>document.getElementById("date")).valueAsDate = bcrypto.Date;
    (<HTMLInputElement>document.getElementById("code")).style.backgroundColor = "#353";
  } catch(e) {
    (<HTMLInputElement>document.getElementById("code")).style.backgroundColor = "#533";
  }
}

export function genCode() {
  try {
    const ndate: Date = ((<HTMLInputElement>document.getElementById("date")).valueAsDate!);
    const fsc = bcrypto.encryptFsc(ndate);
    (<HTMLInputElement>document.getElementById("out")).value = fsc;
    (<HTMLInputElement>document.getElementById("date")).style.backgroundColor = "#353";
    (<HTMLInputElement>document.getElementById("out")).style.animation = "shine 1s ease-in infinite";
  } catch(e) {
    (<HTMLInputElement>document.getElementById("date")).style.backgroundColor = "#533";
  }
}

export function maxDate() {
  (<HTMLInputElement>document.getElementById("date")).value = "2089-01-01";
}

window.parseCode = parseCode;
window.genCode = genCode;
window.maxDate = maxDate;
