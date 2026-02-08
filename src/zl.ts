import abCheck from './abCheck';

declare global {
    interface Window {
        main: () => void;
    }
}

type ZlData = {
    zlNr: number;
    code: number;
};

function blockAlgorithm(data: number[], dataArray: number[]): void {
    for (let i = 0; i < 12; ++i) {
        data[i] = (dataArray[i] + data[i]) % 10;
    }

    for (let j = 0; j <= 5; ++j) {
        for (let k = 0; k <= 11; k += 3) {
            const v9 = 100 * data[k] + 10 * data[k + 1] + data[k + 2];
            const v10 = ((481 * v9 + 117) % 1000) & 0xFFFF;

            data[k + 0] = Math.floor(v10 / 100);
            data[k + 1] = Math.floor((v10 % 100) / 10);
            data[k + 2] = v10 % 10;
        }

        const tmp = data[11];

        for (let k = 0; k <= 10; ++k) {
            data[11 - k] = data[10 - k];
        }

        data[0] = tmp;
    }
}

function generateChecksum(data: number[]): number {
    const v7 = 1000 * data[0] + 100 * data[1] + 10 * data[2] + data[3];
    const v8 = 1000 * data[4] + 100 * data[5] + 10 * data[6] + data[7];
    const v9 = 1000 * data[8] + 100 * data[9] + 10 * data[10] + data[11];

    return (v9 + v8 + v7) % 10000;
}

function generateZlCode(data: number[], firstArray: number[], secondArray: number[]): number {
    blockAlgorithm(data, firstArray);
    blockAlgorithm(data, secondArray);

    return generateChecksum(data);
}

export function generateZlCodeV2(data: number[]): number {
    const v3 = [4, 1, 1, 8, 2, 2, 1, 5, 9, 8, 1, 0];
    const v2 = [5, 2, 5, 7, 3, 7, 0, 2, 5, 8, 0, 6];

    return generateZlCode(data, v3, v2);
}

export function generateZlCodeV3(data: number[]): number {
    const v3 = [7, 2, 1, 1, 4, 9, 8, 4, 3, 8, 6, 1];
    const v2 = [3, 1, 8, 3, 2, 0, 5, 6, 2, 7, 0, 5];

    return generateZlCode(data, v3, v2);
}

function nthDig(n: number, k: number): number {
    while (n--) {
        k = Math.floor(k / 10);
    }
    return k % 10;
}

export function convertZlDataToArray(zlData: ZlData, zlnr: number[], code: number[]): void {
    const tmpZlnr = [
        nthDig(8, zlData.zlNr),
        nthDig(7, zlData.zlNr),
        nthDig(6, zlData.zlNr),
        nthDig(5, zlData.zlNr),
        nthDig(4, zlData.zlNr),
        nthDig(3, zlData.zlNr),
        nthDig(2, zlData.zlNr),
        nthDig(1, zlData.zlNr),
        nthDig(0, zlData.zlNr),
        nthDig(7, zlData.code),
        nthDig(6, zlData.code),
        nthDig(5, zlData.code),
        nthDig(4, zlData.code)
    ];

    for (let i = 0; i < 13; i++) {
        zlnr[i] = tmpZlnr[i];
    }

    code[0] = nthDig(0, zlData.code) + (nthDig(1, zlData.code) * 10) + (nthDig(2, zlData.code) * 100) + (nthDig(3, zlData.code) * 1000);
}

export function rotateZlStr(zlStr: number[], firstPart: string[]): void {
    for (let i = 0; i < 4; ++i) {
        firstPart[i] = String.fromCharCode(zlStr[9 + i] + 0x30);
    }

    const firstNr = zlStr[0];
    for (let i = 0; i < 13; ++i) {
        zlStr[i] = i !== 12 ? zlStr[i + 1] : firstNr;
    }
}

export default function main(): void {
    // Get input values
    const zlNrInput = document.getElementById('zlNr') as HTMLInputElement;
    const dateField = document.getElementById('date') as HTMLInputElement;
    const versionInput = document.getElementById('version') as HTMLSelectElement;
    const outputField = document.getElementById('out') as HTMLInputElement;

    const zlNr = parseInt(zlNrInput.value.replace(".", "").trim(), 10);
    const version = versionInput.value;

    // Handle date field
    if (dateField.value === "") {
        dateField.className = "failure";
        const today = new Date();
        const futureDate = new Date(today.setFullYear(today.getFullYear() + 2));
        dateField.valueAsDate = futureDate;
    } else {
        dateField.className = "success";
    }

    const dateInput: string = dateField.value;

    // Convert date to MMYY format and add 4 zeroes
    const dateParts: string[] = dateInput.split('-');
    const datecode = dateParts[1] + dateParts[0].slice(-2);
    const code = parseInt(dateParts[1] + dateParts[0].slice(-2) + '0000', 10);

    const zl = { zlNr: zlNr, code: code };

    const zlStr: number[] = new Array(13).fill(0);
    const codeArray: number[] = [0];
    convertZlDataToArray(zl, zlStr, codeArray);

    const firstPart: string[] = new Array(5).fill("0");

    if(abCheck()) rotateZlStr(zlStr, firstPart);
    outputField.value = datecode;

    let key: number | undefined;
    if (version === 'V2') {
        key = generateZlCodeV2(zlStr);
    } else if (version === 'V3') {
        key = generateZlCodeV3(zlStr);
    }

    if (key !== undefined) {
        outputField.value += key.toString().padStart(4, '0');
    }

    outputField.style.animation = "shine 1s ease-in infinite";
}

if (typeof window !== 'undefined') {
    window.main = main;
}