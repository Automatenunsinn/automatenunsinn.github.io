import { swappedCopy, bytesToHex, toBcd, interleaveBytes, deinterleaveBytes } from './utils/binary';
import { delay } from './utils/async';
import abCheck from './abCheck';
import { downloadBlob, setProgressState, disableControls } from './utils/ui';
import { loadBauartMap, bauartDetailsMap } from './bauartMap';
import { lookupMachineName } from './utils/bauartLookup';
import { calculateChecksum, findChecksumOffset, preserveChecksum } from './bcheck';

export { convertDate };

// Global state
let romBuffer: Uint8Array = new Uint8Array();
let romSize: number = 0;
let loadedDual: boolean = false;
let singleWasSwapped = false;
let patchInProgress = false;
let loadingInProgress = false;
let patchedRom: Uint8Array | null = null;
let selectedMode: 'single' | 'dual' | null = null;
let oddPath: string = "";
let evenPath: string = "";
let singlePath: string = "";

function updateWorkflow(): void {
    const ids = ['singleRom', 'oddRom', 'evenRom', 'loadSingleButton', 'loadDualButton', 'patchButton', 'downloadButton'];
    ids.forEach(id => document.getElementById(id)?.classList.remove('glow-green'));
    const patchButton = document.getElementById('patchButton') as HTMLButtonElement | null;
    const downloadButton = document.getElementById('downloadButton') as HTMLButtonElement | null;
    const busy = patchInProgress || loadingInProgress;
    if (patchButton) patchButton.disabled = busy || romBuffer.length === 0;
    if (downloadButton) downloadButton.disabled = busy || !patchedRom;
    if (busy) return;
    if (patchedRom) {
        downloadButton?.classList.add('glow-green');
        return;
    }
    if (romBuffer.length > 0) {
        patchButton?.classList.add('glow-green');
        return;
    }
    const number = (document.getElementById('zlInput') as HTMLInputElement | null)?.value.trim() ?? '';
    const prefix = number.slice(0, Number(number[0]) > 4 ? 3 : 4);
    if (!/^\d{9}$/.test(number) || !bauartDetailsMap[prefix]) return;
    if (!/WULFF/i.test(bauartDetailsMap[prefix].manufacturer)) return;
    const date = bauartDetailsMap[prefix].date;
    const year = date?.match(/\d{4}$/)?.[0];
    const recommended = selectedMode ?? (year ? (Number(year) < 2002 ? 'single' : 'dual') : null);
    const hasFile = (id: string) => !!(document.getElementById(id) as HTMLInputElement | null)?.files?.length;
    if (recommended !== 'dual') {
        document.getElementById(hasFile('singleRom') ? 'loadSingleButton' : 'singleRom')?.classList.add('glow-green');
    }
    if (recommended !== 'single') {
        if (hasFile('oddRom') && hasFile('evenRom')) {
            document.getElementById('loadDualButton')?.classList.add('glow-green');
        } else {
            ['oddRom', 'evenRom'].filter(id => !hasFile(id)).forEach(id => document.getElementById(id)?.classList.add('glow-green'));
        }
    }
}

function invalidatePatched(): void {
    patchedRom = null;
    updateWorkflow();
}

// Pattern constants
//                                                      cmp.l (A0),D0   beq.b +0e
export const PATCH_DATA_CHECKSUM_PATTERN = new Uint8Array([0xb0, 0x90, 0x67, 0x0e]);
//                                                      move.l (A0),D0  bra.b +0e
export const PATCH_DATA_CHECKSUM_VALUE = new Uint8Array([0x20, 0x10, 0x60, 0x0e]);

export const PATCH_DATA_DATE_PATTERN = new Uint8Array([0x70, 0x02, 0x2f, 0x00, 0x70, 0x10, 0x2f, 0x00, 0x4e, 0xb9, 0x00, 0x00]);
export const PATCH_DATA_DATE_VALUE = new Uint8Array([0x70, 0x02, 0x2F, 0x00, 0x70, 0x10, 0x2F, 0x00, 0x4E, 0xB9, 0x00, 0x0F, 0xFF, 0x04]);

export const PATCH_DATA_ZULASSUNG_PATTERN = new Uint8Array([0x2f, 0x0a, 0x70, 0x01, 0x2f, 0x00, 0x70, 0x10, 0x2f, 0x00, 0x4e, 0xb9, 0x00, 0x00]);
export const PATCH_DATA_ZULASSUNG_VALUE = new Uint8Array([0x2F, 0x0A, 0x70, 0x01, 0x2F, 0x00, 0x70, 0x10, 0x2F, 0x00, 0x4E, 0xB9, 0x00, 0x0F, 0xFF, 0x0C]);

//                                                             lea (0xc,SP),SP
export const PATCH_DATA_INITRAM1_PATTERN = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x01]);
//                                                             lea (0xc,SP),SP
export const PATCH_DATA_INITRAM1_VALUE =   new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x02]);

//                                                             lea (0xc,SP),SP      move.w #0x1,(A2)
export const PATCH_DATA_INITRAM2_PATTERN = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x34, 0xbc, 0x00, 0x01]);
//                                                             lea (0xc,SP),SP      move.w #0x2,(A2)
export const PATCH_DATA_INITRAM2_VALUE =   new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x34, 0xbc, 0x00, 0x02]);

//                                                          cmpi.l     #0x780b,D0               beq.b +08  cmpi.l #0x786a,D0                        bne.b      +16
export const PATCH_DATA_INITRAM3_PATTERN = new Uint8Array([0x0c, 0x80, 0x00, 0x00, 0x78, 0x0b, 0x67, 0x08, 0x0c, 0x80, 0x00, 0x00, 0x78, 0x6a, 0x66, 0x16]);
export const PATCH_DATA_INITRAM3_VALUE = new Uint8Array([0x0c, 0x80, 0x00, 0x00, 0x78, 0x0b, 0x67, 0x08, 0x0c, 0x80, 0x00, 0x00, 0x78, 0x6a, 0x4e, 0x71]);

export const PATCH_DATA_DATUM_UHR_PATTERN = new TextEncoder().encode("DATUM - UHR    ");
export const PATCH_DATA_FIXED = new Uint8Array([
    0x31, 0x12, 0x10, 0x00, 0x20, 0x3c, 0x00, 0x0f, 0xff, 0x00, 0x4e, 0x75,
    0x30, 0x2f, 0x00, 0x06, 0x22, 0x2f, 0x00, 0x08, 0x4e, 0x4d, 0x4e, 0x71,
    0x0c, 0x80, 0x12, 0x34, 0x56, 0x78, 0x67, 0x06, 0x06, 0x80, 0x00, 0xa9,
    0x8a, 0xc7, 0x4e, 0x75
]);

//                                                    tst.l D0    bew.w +96               clr.w D3w   clr.w D2w   moveq 0x4,D4 lsl.w 0x4,D2w move.w 0x2710,D0w         move.l D0,(SP), jsr 0x61fc
export const PATCH_DATA_PIN_PATTERN = new Uint8Array([0x4a, 0x80, 0x67, 0x00, 0x00, 0x96, 0x42, 0x43, 0x42, 0x42, 0x78, 0x04, 0xe9, 0x4a, 0x30, 0x3c, 0x27, 0x10, 0x2f, 0x00, 0x4e, 0xb9, 0x00, 0x00, 0x61, 0xfc]);
// Replace just the loop initialization with MOVE.W #0,D2; BRA.B +0x22.
export const PATCH_DATA_PIN_VALUE = new Uint8Array(PATCH_DATA_PIN_PATTERN);
PATCH_DATA_PIN_VALUE.set([0x34, 0x3c, 0, 0, 0x60, 0x22], 6);

const PIN_LOOP_PREFIX = PATCH_DATA_PIN_PATTERN.subarray(6, 20);
const PIN_LOOP_SUFFIX = new Uint8Array([0x58, 0x8f, 0x02, 0x80, 0, 0, 0xff, 0xff,
    0x80, 0xc5, 0x48, 0x40, 0x84, 0x40, 0x52, 0x43, 0xb8, 0x43, 0x62, 0xde, 0x2f, 0x02]);

export const NAME_SEARCH_PATTERN = new Uint8Array([0x00, 0xFF, 0x53, 0x50, 0x49, 0x45, 0x4C, 0x45, 0x20, 0x00, 0x47, 0x45]);
export const NAME_SEARCH_PATTERN_ALT = new Uint8Array([0x00, 0xFF, 0x53, 0x50, 0x49, 0x45, 0x4C, 0x45, 0x20, 0x00, 0x53, 0x53, 0x50]);

let statusText: HTMLElement | null = null;
let romInfo: HTMLElement | null = null;
let progressBar: HTMLElement | null = null;

function setStatus(text: string, log = true): void {
    if (log) console.log(`[STATUS] ${text}`);
    if (statusText) {
        statusText.textContent = text;
        statusText.style.color = text.startsWith("Suche") || text.startsWith("Muster gefunden") ? "inherit" : "#007bff";
    }
}

async function updateProgress(value: number, label: string, error: boolean = false): Promise<void> {
    if (progressBar) {
        const progressValue = Math.max(0, Math.min(100, value));
        const widthValue = `${progressValue}%`;
        progressBar.style.width = widthValue;
        progressBar.setAttribute('aria-valuenow', progressValue.toString());
        progressBar.setAttribute('aria-valuetext', widthValue);
        progressBar.textContent = `${progressValue}%`;
        setStatus(label, false);
        setProgressState(progressBar, error);
    }
    // Small timeout to allow UI to repaint
    await delay(1);
}

// Utility functions
function convertDate(dateStr: string): Uint8Array {
    if (!/^\d{8}$/.test(dateStr)) {
        throw new Error("Datum muss im Format JJJJMMTT angegeben werden");
    }
    const year = Number(dateStr.slice(0, 4));
    const month = Number(dateStr.slice(4, 6));
    const day = Number(dateStr.slice(6, 8));
    const date = new Date(0);
    date.setUTCFullYear(year, month - 1, day);
    if (year === 0 || date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error("Ungültiges Kalenderdatum");
    }
    return new Uint8Array([toBcd(day), toBcd(month), toBcd(year % 100), 0]);
}

function byteSwap(): void {
    romBuffer = swappedCopy(romBuffer);
    setStatus("Byte-Tausch abgeschlossen");
    updateRomInfo();
}

function updateRomInfo(): void {
    if (!romInfo) return;

    while (romInfo.firstChild) {
        romInfo.removeChild(romInfo.firstChild);
    }

    const addLine = (text: string): void => {
        if (romInfo!.firstChild) {
            romInfo!.appendChild(document.createElement('br'));
        }
        romInfo!.appendChild(document.createTextNode(text));
    };

    if (romBuffer.length === 0) {
        addLine("Keine ROM geladen");
        return;
    }

    addLine(`ROM Größe: ${romBuffer.length} bytes`);
    if (loadedDual) {
        addLine("Modus: Duale 8-Bit geladen");
        addLine(`ODD: ${oddPath}`);
        addLine(`EVEN: ${evenPath}`);
    } else {
        addLine("Modus: 16-Bit geladen");
        addLine(`Datei: ${singlePath}`);
    }
}

// File loading functions
async function loadSingleFile(): Promise<boolean> {
    if (patchInProgress || loadingInProgress) return false;
    const fileInput = document.getElementById("singleRom") as HTMLInputElement;
    const file = fileInput.files?.[0];
    
    if (!file) {
        setStatus("Bitte eine 16-Bit-EPROM-Datei auswählen.");
        await updateProgress(0, "Fehler: Keine Datei ausgewählt", true);
        return false;
    }
    
    loadingInProgress = true;
    romBuffer = new Uint8Array();
    invalidatePatched();
    const restore = disableControls('main input, main button');
    try {
        const arrayBuffer = await file.arrayBuffer();
        romBuffer = new Uint8Array(arrayBuffer);
        romSize = romBuffer.length;
        singlePath = file.name;
        loadedDual = false;
        
        setStatus(`16-Bit-ROM geladen: ${file.name} (${romSize} bytes)`);
        
        singleWasSwapped = romSize > 6 && romBuffer[6] >= 0xf4;
        if (singleWasSwapped) {
            byteSwap();
        }
        
        updateRomInfo();
        await setRomNameFromRom();
        return true;
    } catch (e) {
        romBuffer = new Uint8Array();
        setStatus(`Datei kann nicht geladen werden: ${e}`);
        await updateProgress(0, "Fehler beim Laden", true);
        return false;
    } finally {
        loadingInProgress = false;
        restore();
        updateWorkflow();
    }
}

async function loadDualFiles(): Promise<boolean> {
    if (patchInProgress || loadingInProgress) return false;
    const oddInput = document.getElementById("oddRom") as HTMLInputElement;
    const evenInput = document.getElementById("evenRom") as HTMLInputElement;
    
    const oddFile = oddInput.files?.[0];
    const evenFile = evenInput.files?.[0];
    
    if (!oddFile || !evenFile) {
        setStatus("Bitte beide 8-Bit-EPROM-Dateien auswählen.");
        await updateProgress(0, "Fehler: Dateien fehlen", true);
        return false;
    }
    
    loadingInProgress = true;
    romBuffer = new Uint8Array();
    invalidatePatched();
    const restore = disableControls('main input, main button');
    try {
        const [oddArrayBuffer, evenArrayBuffer] = await Promise.all([
            oddFile.arrayBuffer(),
            evenFile.arrayBuffer()
        ]);
        
        const odd = new Uint8Array(oddArrayBuffer);
        const even = new Uint8Array(evenArrayBuffer);
        
        if (odd.length !== even.length) {
            setStatus("ODD- und EVEN-Dateigrößen unterscheiden sich; mit minimaler Länge fortfahren.");
            await updateProgress(10, "Warnung: Unterschiedliche Größen", true);
        }
        
        const combined = interleaveBytes(odd, even);

        romBuffer = combined;
        romSize = combined.length;
        loadedDual = abCheck();
        oddPath = oddFile.name;
        evenPath = evenFile.name;
        
        setStatus(`Duale 8-Bit geladen -> kombiniert (${romSize} bytes)`);
        
        if (romSize > 6 && romBuffer[6] >= 0xf4) {
            byteSwap();
        }
        
        updateRomInfo();
        await setRomNameFromRom();
        return true;
    } catch (e) {
        romBuffer = new Uint8Array();
        setStatus(`Duale Dateien können nicht geladen werden: ${e}`);
        await updateProgress(0, "Fehler beim Laden", true);
        return false;
    } finally {
        loadingInProgress = false;
        restore();
        updateWorkflow();
    }
}

// Search and patch functions
async function searchPattern(pattern: Uint8Array, reverse: boolean = false, buffer: Uint8Array = romBuffer): Promise<number> {
    if (buffer.length === 0 || pattern.length === 0 || pattern.length >= 0x32) {
        return -1;
    }

    const plen = pattern.length;

    // Both directions search only offsets aligned to 16-bit words.
    const start = reverse ? Math.floor((buffer.length - plen) / 2) * 2 : 0;
    const step = reverse ? -2 : 2;

    for (let i = start; i >= 0 && i <= buffer.length - plen; i += step) {
        const distance = Math.abs(i - start);
        const prog = Math.floor((distance / buffer.length) * 100);

        // Yield every 1000 iterations to allow UI updates
        if (distance % 2000 === 0) {
            setStatus(`Suche... ${prog}%`, false);
            await delay(1);
        }

        let match = abCheck();
        for (let j = 0; j < plen; j++) {
            if (buffer[i + j] !== pattern[j]) {
                match = false;
                break;
            }
        }

        if (match) {
            setStatus(`Muster gefunden bei 0x${i.toString(16).toUpperCase()}`);
            return i;
        }
    }

    setStatus("Muster nicht gefunden");
    return -1;
}

export async function applyPattern(source: Uint8Array, result: Uint8Array,
    pattern: Uint8Array, bytes: Uint8Array): Promise<boolean> {
    const offset = await searchPattern(pattern, false, source);
    const applied = offset >= 0 && offset + bytes.length <= result.length;
    if (applied) result.set(bytes, offset);
    return applied;
}

function bytesToPrintableText(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')
        .join('');
}

// Older single-file ROMs store a 16-character display name after this label.
// Text is not necessarily word-aligned, unlike the instruction patch patterns.
export function readLegacyRomName(buffer: Uint8Array): string | null {
    const encoder = new TextEncoder();
    // Both ROM generations contain this common marker prefix; the text
    // following it distinguishes the exact game-count label.
    const marker = encoder.encode("100 ");

    for (let offset = buffer.length - marker.length; offset >= 0; offset--) {
        if (!marker.every((byte, index) => buffer[offset + index] === byte)) continue;
        const headerEnd = buffer.indexOf(0, offset + marker.length);
        if (headerEnd < 0 || !bytesToPrintableText(buffer.subarray(offset, headerEnd)).includes('SPIELE')) continue;
        const start = headerEnd + 1;
        const baseName = buffer.subarray(start, start + 16);
        if (buffer[start + 16] !== 0 || !baseName.every(byte => byte >= 0x20 && byte <= 0x7e)) continue;

        // Series ROMs put the numbered display name in the next text field,
        // prefixed by a non-printable separator. Collapse its field padding.
        let fieldStart = start + 17;
        for (let field = 0; field < 4 && fieldStart < buffer.length; field++) {
            const fieldEnd = buffer.indexOf(0, fieldStart);
            if (fieldEnd < 0) break;
            while (fieldStart < fieldEnd && (buffer[fieldStart] < 0x20 || buffer[fieldStart] > 0x7e)) fieldStart++;
            const text = bytesToPrintableText(buffer.subarray(fieldStart, fieldEnd))
                .trim();
            if (text && /[A-Za-z]/.test(text) && /\d/.test(text)) return text;
            fieldStart = fieldEnd + 1;
        }

        const text = bytesToPrintableText(baseName).trim();
        if (text) return text;
    }
    return null;
}

async function setRomNameFromRom(): Promise<void> {
    const romNameInput = document.getElementById('romname') as HTMLInputElement | null;
    if (!romNameInput) {
        return;
    }

    if (romBuffer.length === 0) {
        romNameInput.value = 'nicht gefunden';
        return;
    }

    const legacyName = readLegacyRomName(romBuffer);
    if (legacyName !== null) {
        romNameInput.value = legacyName;
        return;
    }

    const namePatterns = [
        { key: 'NAME_SEARCH_PATTERN', pattern: NAME_SEARCH_PATTERN },
        { key: 'NAME_SEARCH_PATTERN_ALT', pattern: NAME_SEARCH_PATTERN_ALT }
    ];

    let addr = -1;
    let foundPatternKey = '';

    for (const entry of namePatterns) {
        addr = await searchPattern(entry.pattern, true);
        if (addr !== -1) {
            foundPatternKey = entry.key;
            break;
        }
    }

    if (addr === -1) {
        romNameInput.value = 'nicht gefunden';
        console.log('ROM name pattern not found during load');
        return;
    }

    const start = Math.max(0, addr - 16);
    const bytesBefore = romBuffer.slice(start, addr);
    const textBefore = bytesToPrintableText(bytesBefore);
    romNameInput.value = textBefore;

    console.log(`16 bytes before ${foundPatternKey} @ 0x${addr.toString(16).toUpperCase()}: ${bytesToHex(bytesBefore, ' ')}`);
    console.log(`Text before ${foundPatternKey}: "${textBefore}"`);
}

export type PatchKey = "checksum" | "dateId" | "zulassung" | "initRam" | "datumUhr" | "fixed" | "pin";
export type PatchSelection = Record<PatchKey, boolean>;
export type PatchResult = { rom: Uint8Array; results: Record<PatchKey, boolean | null>;
    errors: Partial<Record<PatchKey, string>> };

const allPatches: PatchSelection = {
    checksum: true, dateId: true, zulassung: true,
    initRam: true, datumUhr: true, fixed: true, pin: true
};

// Both ID-chip patches call code stored in the fixed block.
export async function patchRom(source: Uint8Array, dateStr: string, zlStr: string,
    selection: PatchSelection = allPatches): Promise<PatchResult> {
    const result = new Uint8Array(source);
    const errors: PatchResult['errors'] = {};
    const results: Record<PatchKey, boolean | null> = {
        checksum: null, dateId: null, zulassung: null,
        initRam: null, datumUhr: null, fixed: null, pin: null
    };
    const fixedAddr = source.length >= 0xFFF00 + PATCH_DATA_FIXED.length ? 0xFFF00 : 0x7FF00;
    let originalChecksum: number | undefined;
    if (selection.checksum && (source.length === 0x80000 || source.length === 0x100000)) {
        try {
            originalChecksum = calculateChecksum(source, findChecksumOffset(source), source.length);
        } catch (_) {
            // Older images use the instruction patch below instead.
        }
    }
    if (selection.fixed) {
        results.fixed = source.length >= fixedAddr + PATCH_DATA_FIXED.length &&
            source.subarray(fixedAddr, fixedAddr + PATCH_DATA_FIXED.length).every(byte => byte === 0xFF);
        if (!results.fixed) errors.fixed = `Kein freier fester Block bei 0x${fixedAddr.toString(16).toUpperCase()}`;
        try {
            const convertedDate = convertDate(dateStr);
            if (!/^\d{9}$/.test(zlStr)) throw new Error('Zulassungsnummer muss genau 9 Ziffern enthalten');
            if (results.fixed) {
                const fixed = new Uint8Array(PATCH_DATA_FIXED);
                fixed.set(convertedDate, 0);
                new DataView(fixed.buffer).setUint32(6, fixedAddr, false);
                new DataView(fixed.buffer).setUint32(26, Number(zlStr), false);
                result.set(fixed, fixedAddr);
            }
        } catch (error) {
            results.fixed = false;
            errors.fixed = error instanceof Error ? error.message : 'Ungültige Eingaben für den festen Block';
        }
    }

    const find = async (pattern: Uint8Array): Promise<number> => {
        const addr = await searchPattern(pattern, false, source);
        return addr;
    };

    const datePatch = new Uint8Array(PATCH_DATA_DATE_VALUE);
    new DataView(datePatch.buffer).setUint32(10, fixedAddr + 4, false);
    const zulassungPatch = new Uint8Array(PATCH_DATA_ZULASSUNG_VALUE);
    new DataView(zulassungPatch.buffer).setUint32(12, fixedAddr + 12, false);
    if (selection.dateId) {
        if (results.fixed === true) {
            results.dateId = await applyPattern(source, result, PATCH_DATA_DATE_VALUE, datePatch) ||
                await applyPattern(source, result, datePatch, datePatch) ||
                await applyPattern(source, result, PATCH_DATA_DATE_PATTERN, datePatch);
        } else {
            results.dateId = false;
            errors.dateId = 'Fester Block nicht angewendet: ' + (errors.fixed ?? 'nicht ausgewählt');
        }
    }
    if (selection.zulassung) {
        if (results.fixed === true) {
            results.zulassung = await applyPattern(source, result, PATCH_DATA_ZULASSUNG_PATTERN, zulassungPatch);
        } else {
            results.zulassung = false;
            errors.zulassung = 'Fester Block nicht angewendet: ' + (errors.fixed ?? 'nicht ausgewählt');
        }
    }

    if (selection.initRam) {
        let offset = await find(PATCH_DATA_INITRAM1_PATTERN);
        let bytes = PATCH_DATA_INITRAM1_VALUE;
        if (offset === -1) {
            offset = await find(PATCH_DATA_INITRAM2_PATTERN);
            bytes = PATCH_DATA_INITRAM2_VALUE;
        }
        if (offset === -1) {
            offset = await find(PATCH_DATA_INITRAM3_PATTERN);
            bytes = PATCH_DATA_INITRAM3_VALUE;
        }
        results.initRam = offset >= 0 && offset + bytes.length <= result.length;
        if (results.initRam) result.set(bytes, offset);
    }

    if (selection.datumUhr) {
        const textAddr = await find(PATCH_DATA_DATUM_UHR_PATTERN);
        let referenceAddr = -1;
        if (textAddr !== -1) {
            const addrBytes = new Uint8Array(4);
            new DataView(addrBytes.buffer).setUint32(0, textAddr, false);
            referenceAddr = await find(addrBytes);
        }
        results.datumUhr = textAddr >= 0 && textAddr + PATCH_DATA_DATUM_UHR_PATTERN.length < result.length &&
            referenceAddr >= 0 && referenceAddr + 0x10 <= result.length;
        if (results.datumUhr) {
            result[textAddr + PATCH_DATA_DATUM_UHR_PATTERN.length] = 0x20;
            result.set([0, 0], referenceAddr + 0x0E);
        }
    }

    if (selection.pin) {
        const view = new DataView(source.buffer, source.byteOffset, source.byteLength);
        let offset = -1;
        let start = 6;
        while (start < source.length) {
            const match = await searchPattern(PIN_LOOP_PREFIX, false, source.subarray(start));
            if (match < 0) break;
            const candidate = start + match - 6;
            start = candidate + 8;
            if (candidate + 26 + PIN_LOOP_SUFFIX.length > source.length) continue;
            const skip = view.getInt16(candidate + 4, false);
            const randomTarget = view.getUint32(candidate + 22, false);
            if (view.getUint32(candidate, false) === 0x4a806700 &&
                skip >= 44 && (skip & 1) === 0 && candidate + 4 + skip + 2 <= source.length &&
                source[candidate + 20] === 0x4e && source[candidate + 21] === 0xb9 &&
                randomTarget < source.length && (randomTarget & 1) === 0 &&
                PIN_LOOP_SUFFIX.every((byte, index) => source[candidate + 26 + index] === byte)) {
                offset = candidate;
                break;
            }
        }
        results.pin = offset >= 0;
        // MOVE.W #0,D2; BRA.B to MOVE.L D2,-(SP), skipping the random loop.
        // Leave its JSR operand and all other instructions unchanged.
        if (results.pin) result.set([0x34, 0x3c, 0, 0, 0x60, 0x22], offset + 6);
        else errors.pin = 'Unterstützte PIN-Erzeugungsschleife nicht gefunden';
    }

    if (selection.checksum) {
        if (originalChecksum === undefined) {
            results.checksum = await applyPattern(source, result, PATCH_DATA_CHECKSUM_PATTERN, PATCH_DATA_CHECKSUM_VALUE);
            console.log(results.checksum
                ? '[Prüfsumme] Prüfroutine per Instruktionspatch umgangen'
                : '[Prüfsumme] Instruktionspatch fehlgeschlagen: Patch-Muster nicht gefunden');
        } else if (preserveChecksum(result, originalChecksum)) {
            results.checksum = true;
            console.log('[Prüfsumme] Ursprüngliche Prüfsumme durch Ausgleich beibehalten');
        } else {
            const checksumOffset = findChecksumOffset(result);
            const checksum = calculateChecksum(result, checksumOffset, result.length);
            new DataView(result.buffer, result.byteOffset, result.byteLength)
                .setUint32(checksumOffset, checksum, false);
            results.checksum = true;
            console.log('[Prüfsumme] Prüfsumme neu berechnet und gespeichert');
        }
    }

    return { rom: result, results, errors };
}

// Keep the loaded ROM unchanged so another attempt always starts from the original.
async function patchEPROM(): Promise<boolean> {
    if (patchInProgress || loadingInProgress) return false;
    patchInProgress = true;
    invalidatePatched();
    const restore = disableControls('main input, main button');
    try {
        if (romBuffer.length === 0) throw new Error("Keine ROM geladen");
        const dateInput = document.getElementById("dateInput") as HTMLInputElement;
        const zlInput = document.getElementById("zlInput") as HTMLInputElement;
        setStatus("Patch-Prozess starten...");
        await updateProgress(10, "Starte Patch-Prozess...");
        const controls: Record<PatchKey, HTMLInputElement> = {
            checksum: document.getElementById("patchChecksum") as HTMLInputElement,
            dateId: document.getElementById("patchDateId") as HTMLInputElement,
            zulassung: document.getElementById("patchZulassung") as HTMLInputElement,
            initRam: document.getElementById("patchInitRam") as HTMLInputElement,
            datumUhr: document.getElementById("patchDatumUhr") as HTMLInputElement,
            fixed: document.getElementById("patchFixed") as HTMLInputElement,
            pin: document.getElementById("patchPin") as HTMLInputElement
        };
        const selection = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.checked])) as PatchSelection;
        Object.values(controls).forEach(control => control.classList.remove("is-valid", "is-invalid"));
        const patched = await patchRom(romBuffer, dateInput.value.replace(/-/g, ''), zlInput.value.trim(), selection);
        let successes = 0;
        let failures = 0;
        for (const key of Object.keys(controls) as PatchKey[]) {
            const applied = patched.results[key];
            if (applied === true) successes++;
            if (applied === false) failures++;
            if (applied !== null) {
                controls[key].classList.add(applied ? "is-valid" : "is-invalid");
                controls[key].title = applied ? "Patch angewendet" :
                    (patched.errors[key] ?? "Patch-Muster nicht gefunden");
            } else {
                controls[key].title = "Nicht ausgewählt";
            }
        }
        const details = Object.values(patched.errors).join('; ');
        if (successes === 0) throw new Error(details || "Keiner der ausgewählten Patches konnte angewendet werden");
        patchedRom = patched.rom;
        const summary = `${successes} Patches angewendet, ${failures} nicht angewendet. Bereit zum Herunterladen.` +
            (details ? ` ${details}` : '');
        setStatus(summary);
        await updateProgress(100, summary, failures > 0);
        return true;
    } catch (e) {
        const message = `Fehler beim Patchen: ${e instanceof Error ? e.message : e}`;
        setStatus(message);
        await updateProgress(0, message, true);
        return false;
    } finally {
        patchInProgress = false;
        restore();
        updateWorkflow();
    }
}

async function downloadPatched(): Promise<void> {
    if (patchedRom && !patchInProgress && !loadingInProgress) await exportPatched(patchedRom);
}

async function exportPatched(patched: Uint8Array): Promise<void> {
    if (patched.length === 0) return;

    if (loadedDual) {
        const [odd, even] = deinterleaveBytes(patched);

        const oddName = oddPath.replace(/\.[^.]+$/, "") + "_odd_patched.ic15";
        const evenName = evenPath.replace(/\.[^.]+$/, "") + "_even_patched.ic10";
        downloadBlob(new Blob([odd], { type: "application/octet-stream" }), oddName);
        downloadBlob(new Blob([even], { type: "application/octet-stream" }), evenName);

        setStatus(`Gepatchte Dateien heruntergeladen: ${oddName}, ${evenName}`);
        await updateProgress(100, "Dateien heruntergeladen");
    } else {
        const output = singleWasSwapped ? swappedCopy(patched) : new Uint8Array(patched);
        const name = singlePath.replace(/\.[^.]+$/, "") + "_patched.bin";
        downloadBlob(new Blob([output.buffer as ArrayBuffer], { type: "application/octet-stream" }), name);
        setStatus(`Gepatchte Datei heruntergeladen: ${name}`);
        await updateProgress(100, "Datei heruntergeladen");
    }
}

// Initialize UI elements (only in browser environment)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        statusText = document.getElementById('statusText');
        romInfo = document.getElementById('romInfo');
        progressBar = document.getElementById('progressBar');

        await loadBauartMap();

        const zlInput = document.getElementById('zlInput') as HTMLInputElement | null;
        const machineNameInput = document.getElementById('machinename') as HTMLInputElement | null;
        const romNameInput = document.getElementById('romname') as HTMLInputElement | null;
        const atuZlInput = document.getElementById('atuZlInput') as HTMLInputElement | null;
        const atuMachineNameInput = document.getElementById('atuMachinename') as HTMLInputElement | null;
        const updatePlate = (source: HTMLInputElement | null) => {
            const value = source?.value.trim() ?? '';
            if (zlInput && zlInput !== source) zlInput.value = value;
            if (atuZlInput && atuZlInput !== source) atuZlInput.value = value;
            const name = lookupMachineName(value);
            if (machineNameInput) machineNameInput.value = name;
            if (atuMachineNameInput) atuMachineNameInput.value = name;
            const prefix = value.slice(0, Number(value[0]) > 4 ? 3 : 4);
            const details = value.length >= 4 ? bauartDetailsMap[prefix] : undefined;
            const manufacturer = document.getElementById('plateManufacturer');
            const approvalDate = document.getElementById('plateApprovalDate');
            if (manufacturer) {
                manufacturer.textContent = details?.manufacturer || '—';
                manufacturer.classList.toggle('glow-red', !!details?.manufacturer && !/WULFF/i.test(details.manufacturer));
            }
            if (approvalDate) approvalDate.textContent = details?.date || '—';
            invalidatePatched();
        };
        zlInput?.addEventListener('input', () => updatePlate(zlInput));
        atuZlInput?.addEventListener('input', () => updatePlate(atuZlInput));
        updatePlate(zlInput);
        ['singleRom', 'oddRom', 'evenRom'].forEach(id => {
            const input = document.getElementById(id) as HTMLInputElement | null;
            input?.addEventListener('change', () => {
                selectedMode = input.files?.length ? (id === 'singleRom' ? 'single' : 'dual') : null;
                romBuffer = new Uint8Array();
                if (romNameInput) romNameInput.value = '';
                updateRomInfo();
                invalidatePatched();
            });
        });
        document.getElementById('dateInput')?.addEventListener('input', invalidatePatched);
        document.getElementById('patchOptions')?.addEventListener('change', invalidatePatched);
        if (romNameInput) {
            romNameInput.value = '';
        }
    });
}

// Export functions to window for HTML onclick handlers (only in browser environment)
if (typeof window !== 'undefined') {
    (window as any).loadSingleFile = loadSingleFile;
    (window as any).loadDualFiles = loadDualFiles;
    (window as any).patchEPROM = patchEPROM;
    (window as any).downloadPatched = downloadPatched;
}
