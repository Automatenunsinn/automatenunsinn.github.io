import { CustomBase32 } from './base32.js';
import { Xtea } from './xtea.js';
import crc from 'crc';
import abCheck from './abCheck.js';
import { setValidationState } from './utils/ui.js';
const { crc81wire } = crc;
// Helper function to use crc81wire with Uint8Array (crc library has incompatible types)
const calculateCrc8 = (data) => crc81wire(data, 255);
export class Fsc {
    randomId; // ushort
    homologationId; // uint
    programId; // uint
    date = null;
    crypto = null;
    decoded = false;
    get RandomId() {
        return this.randomId;
    }
    get HomologationId() {
        return this.homologationId;
    }
    get ProgramId() {
        return this.programId;
    }
    get Date() {
        return this.date;
    }
    get Decoded() {
        return this.decoded;
    }
    static insertChar(input, pos, character) {
        return [input.slice(0, pos), character, input.slice(pos)].join("");
    }
    static addHyphens(code) {
        let output = this.insertChar(code, 20, '-');
        output = this.insertChar(output, 15, '-');
        output = this.insertChar(output, 10, '-');
        output = this.insertChar(output, 5, '-');
        return output;
    }
    static generateBauartKey(keyInd, masterKey) {
        const bauartKey = [...masterKey];
        if (keyInd !== 0) {
            for (let i = 0; i < 4; i++) {
                bauartKey[i] += keyInd + 21545;
                bauartKey[i] -= (~keyInd << 16) + 880279552;
            }
        }
        return bauartKey;
    }
    setKeyInd(keyInd) {
        const masterKey = [1878738899, 2928249263, 3927923331, 606835660];
        const bauartKey = Fsc.generateBauartKey(keyInd, masterKey);
        this.crypto = new Xtea();
        this.crypto.init(bauartKey, 29);
    }
    decrypt(code, keyInd = 0) {
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
        this.decoded = true;
        return result;
    }
    encryptFsc(date) {
        const plaintext = new Uint8Array(16);
        new DataView(plaintext.buffer).setUint32(0, this.homologationId, true); // Little-endian
        new DataView(plaintext.buffer).setUint16(7, this.randomId, true); // Little-endian
        plaintext[4] = date.getFullYear() - 2000;
        plaintext[5] = date.getMonth() + 1;
        plaintext[6] = date.getDate();
        const keyInd = (this.homologationId >> 5) / 3125 & 0xffff;
        return Fsc.addHyphens(this.encrypt(plaintext, keyInd));
    }
    encrypt(plaintext, keyInd) {
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
        if (abCheck())
            this.crypto.setData(segment2);
        this.crypto.encrypt();
        encrypted.set(this.crypto.getData(), 8);
        return CustomBase32.base32Encode(encrypted);
    }
    createKc(homologationId, enableCode) {
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
export function handlePaste(event) {
    const pastedText = event.clipboardData?.getData('text');
    if (!pastedText)
        return;
    // Parse the pasted text more robustly
    const parsed = parseCodeString(pastedText);
    if (parsed) {
        event.preventDefault(); // Prevent default paste behavior
        // Fill the input fields
        document.getElementById("code1").value = parsed[0];
        document.getElementById("code2").value = parsed[1];
        document.getElementById("code3").value = parsed[2];
        document.getElementById("code4").value = parsed[3];
        document.getElementById("code5").value = parsed[4];
        // Trigger parsing
        parseCode();
    }
    // If it doesn't match, let the default paste behavior happen
}
export function parseCodeString(input) {
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
    const code = document.getElementById("out1").value +
        '-' + document.getElementById("out2").value +
        '-' + document.getElementById("out3").value +
        '-' + document.getElementById("out4").value +
        '-' + document.getElementById("out5").value;
    navigator.clipboard.writeText(code).then(() => {
        // Optional: Show some feedback that the code was copied
        console.log('Code copied to clipboard');
    }).catch(err => {
        console.error('Failed to copy code: ', err);
    });
}
export function parseCode() {
    const code = document.getElementById("code1").value +
        document.getElementById("code2").value +
        document.getElementById("code3").value +
        document.getElementById("code4").value +
        document.getElementById("code5").value;
    try {
        bcrypto.decrypt(code);
        document.getElementById("date").valueAsDate = bcrypto.Date;
        for (let i = 1; i <= 5; i++) {
            const input = document.getElementById("code" + i);
            setValidationState(input, true);
        }
    }
    catch (e) {
        for (let i = 1; i <= 5; i++) {
            const input = document.getElementById("code" + i);
            setValidationState(input, false);
        }
    }
}
export function genCode() {
    try {
        if (!bcrypto.Decoded) {
            parseCode();
            if (!bcrypto.Decoded) {
                return; // parseCode() already flagged the RMC fields as invalid
            }
        }
        const ndate = (document.getElementById("date").valueAsDate);
        const fsc = bcrypto.encryptFsc(ndate);
        const parts = fsc.split('-');
        for (let i = 1; i <= 5; i++) {
            document.getElementById("out" + i).value = parts[i - 1];
        }
        setValidationState(document.getElementById("date"), true);
    }
    catch (e) {
        setValidationState(document.getElementById("date"), false);
    }
}
export function maxDate() {
    document.getElementById("date").value = "2069-06-09";
}
export function addTwoYears() {
    const dateInput = document.getElementById("date");
    const currentDate = dateInput.valueAsDate;
    if (currentDate) {
        const newDate = new Date(currentDate);
        newDate.setFullYear(newDate.getFullYear() + 2);
        dateInput.valueAsDate = newDate;
    }
}
export function checkLength(input, maxLen, nextId) {
    if (input.value.length === maxLen) {
        if (nextId) {
            const nextInput = document.getElementById(nextId);
            if (nextInput) {
                nextInput.focus();
            }
        }
        else {
            // Last field, parse the code
            parseCode();
        }
    }
}
function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    if (q) {
        const parsed = parseCodeString(q);
        if (parsed) {
            document.getElementById("code1").value = parsed[0];
            document.getElementById("code2").value = parsed[1];
            document.getElementById("code3").value = parsed[2];
            document.getElementById("code4").value = parsed[3];
            document.getElementById("code5").value = parsed[4];
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
    if (typeof document !== 'undefined') {
        document.addEventListener('DOMContentLoaded', handleUrlParams);
    }
}
