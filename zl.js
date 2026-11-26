import abCheck from './abCheck.js';
import { loadBauartMap } from './bauartMap.js';
import { lookupMachineName } from './utils/bauartLookup.js';
import { setValidationState } from './utils/ui.js';
function blockAlgorithm(data, dataArray) {
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
function generateChecksum(data) {
    const v7 = 1000 * data[0] + 100 * data[1] + 10 * data[2] + data[3];
    const v8 = 1000 * data[4] + 100 * data[5] + 10 * data[6] + data[7];
    const v9 = 1000 * data[8] + 100 * data[9] + 10 * data[10] + data[11];
    return (v9 + v8 + v7) % 10000;
}
function generateZlCode(data, firstArray, secondArray) {
    blockAlgorithm(data, firstArray);
    blockAlgorithm(data, secondArray);
    return generateChecksum(data);
}
export function generateZlCodeV2(data) {
    const v3 = [4, 1, 1, 8, 2, 2, 1, 5, 9, 8, 1, 0];
    const v2 = [5, 2, 5, 7, 3, 7, 0, 2, 5, 8, 0, 6];
    return generateZlCode(data, v3, v2);
}
export function generateZlCodeV3(data) {
    const v3 = [7, 2, 1, 1, 4, 9, 8, 4, 3, 8, 6, 1];
    const v2 = [3, 1, 8, 3, 2, 0, 5, 6, 2, 7, 0, 5];
    return generateZlCode(data, v3, v2);
}
function nthDig(n, k) {
    while (n--) {
        k = Math.floor(k / 10);
    }
    return k % 10;
}
export function convertZlDataToArray(zlData, zlnr, code) {
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
export function rotateZlStr(zlStr, firstPart) {
    for (let i = 0; i < 4; ++i) {
        firstPart[i] = String.fromCharCode(zlStr[9 + i] + 0x30);
    }
    const firstNr = zlStr[0];
    for (let i = 0; i < 13; ++i) {
        zlStr[i] = i !== 12 ? zlStr[i + 1] : firstNr;
    }
}
function updateMachineName(zlNrInput) {
    const machineNameInput = document.getElementById('machinename');
    machineNameInput.value = lookupMachineName(zlNrInput.value.trim());
}
export default function main() {
    // Get input values
    const zlNrInput = document.getElementById('zlNr');
    const dateField = document.getElementById('date');
    const versionInput = document.getElementById('version');
    const outputField = document.getElementById('out');
    updateMachineName(zlNrInput);
    const zlNr = parseInt(zlNrInput.value.replace(".", "").trim(), 10);
    const version = versionInput.value;
    // Handle date field
    if (dateField.value === "") {
        setValidationState(dateField, false);
        const today = new Date();
        const futureDate = new Date(today.setFullYear(today.getFullYear() + 2));
        dateField.valueAsDate = futureDate;
    }
    else {
        setValidationState(dateField, true);
    }
    const dateInput = dateField.value;
    // Convert date to MMYY format and add 4 zeroes
    const dateParts = dateInput.split('-');
    const datecode = dateParts[1] + dateParts[0].slice(-2);
    const code = parseInt(dateParts[1] + dateParts[0].slice(-2) + '0000', 10);
    const zl = { zlNr: zlNr, code: code };
    const zlStr = new Array(13).fill(0);
    const codeArray = [0];
    convertZlDataToArray(zl, zlStr, codeArray);
    const firstPart = new Array(5).fill("0");
    if (abCheck())
        rotateZlStr(zlStr, firstPart);
    outputField.value = datecode;
    let key;
    if (version === 'V2') {
        key = generateZlCodeV2(zlStr);
    }
    else if (version === 'V3') {
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
function initGlow() {
    const zlInput = document.getElementById('zlNr');
    const dateInput = document.getElementById('date');
    if (!zlInput)
        return;
    const hasValue = (el) => !!el && el.value.trim() !== '';
    const isComplete = () => zlInput.value.trim().length >= 9;
    const setGlow = (el, on) => {
        if (!el)
            return;
        el.classList.toggle('glow-green', on);
    };
    function updateGlow() {
        if (!hasValue(zlInput)) {
            setGlow(zlInput, true);
            setGlow(dateInput, false);
            return;
        }
        setGlow(zlInput, !isComplete());
        setGlow(dateInput, isComplete());
    }
    zlInput.addEventListener('input', () => {
        updateGlow();
        updateMachineName(zlInput);
        const versionSelect = document.getElementById('version');
        if (!versionSelect)
            return;
        const cleaned = zlInput.value.replace('.', '').trim();
        if (cleaned === '')
            return;
        if (cleaned[0] === '2' && cleaned.length == 1) {
            versionSelect.value = 'V2';
        }
        if (cleaned[0] === '4' && cleaned.length == 1) {
            versionSelect.value = 'V3';
        }
    });
    zlInput.addEventListener('blur', updateGlow);
    zlInput.addEventListener('focus', () => {
        setGlow(zlInput, false);
        setGlow(dateInput, false);
    });
    if (dateInput) {
        dateInput.addEventListener('focus', () => setGlow(dateInput, false));
    }
    updateGlow();
}
function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const q = urlParams.get('q');
    if (q) {
        const zlNrInput = document.getElementById('zlNr');
        if (zlNrInput) {
            zlNrInput.value = q;
            updateMachineName(zlNrInput);
            main();
        }
    }
}
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async function () {
        await loadBauartMap();
        initGlow();
        document.getElementById('date').valueAsDate = new Date();
        handleUrlParams();
    });
}
