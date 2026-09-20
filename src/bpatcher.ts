import abCheck from './abCheck';
import { downloadBlob, setProgressState } from './utils/ui';
import { loadBauartMap } from './bauartMap';
import { lookupMachineName } from './utils/bauartLookup';

export { convertDate };

// Global state
let romBuffer: Uint8Array = new Uint8Array();
let romSize: number = 0;
let loadedDual: boolean = false;
let singleWasSwapped = false;
let patchInProgress = false;
let oddPath: string = "";
let evenPath: string = "";
let singlePath: string = "";

// Pattern constants
//                                                      cmp.l (A0),D0   beq.b +0e
export const PATCH_DATA_CHECKSUM_PATTERN = new Uint8Array([0xb0, 0x90, 0x67, 0x0e]);
//                                                      move.l (A0),D0  bra.b +0e
export const PATCH_DATA_CHECKSUM_VALUE = new Uint8Array([0x20, 0x10, 0x60, 0x0e]);

export const PATCH_DATA_DATE_PATTERN = new Uint8Array([0x70, 0x02, 0x2f, 0x00, 0x70, 0x10, 0x2f, 0x00, 0x4e, 0xb9, 0x00, 0x00]);
export const PATCH_DATA_DATE_VALUE = new Uint8Array([0x70, 0x02, 0x2F, 0x00, 0x70, 0x10, 0x2F, 0x00, 0x4E, 0xB9, 0x00, 0x0F, 0xFF, 0x04]);

export const PATCH_DATA_ZULASSUNG_PATTERN = new Uint8Array([0x2f, 0x0a, 0x70, 0x01, 0x2f, 0x00, 0x70, 0x10, 0x2f, 0x00, 0x4e, 0xb9, 0x00, 0x00]);
export const PATCH_DATA_ZULASSUNG_VALUE = new Uint8Array([0x2F, 0x0A, 0x70, 0x01, 0x2F, 0x00, 0x70, 0x10, 0x2F, 0x00, 0x4E, 0xB9, 0x00, 0x0F, 0xFF, 0x0C]);

export const PATCH_DATA_INITRAM1_PATTERN = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x01]);
export const PATCH_DATA_INITRAM1_VALUE = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x02]);

//                                                          cmpi.l     #0x780b,D0               beq.b +08  cmpi.l #0x786a,D0                        bne.b      +16
export const PATCH_DATA_INITRAM2_PATTERN = new Uint8Array([0x0c, 0x80, 0x00, 0x00, 0x78, 0x0b, 0x67, 0x08, 0x0c, 0x80, 0x00, 0x00, 0x78, 0x6a, 0x66, 0x16]);
export const PATCH_DATA_INITRAM2_VALUE = new Uint8Array([0x0c, 0x80, 0x00, 0x00, 0x78, 0x0b, 0x67, 0x08, 0x0c, 0x80, 0x00, 0x00, 0x78, 0x6a, 0x4e, 0x71]);

export const PATCH_DATA_DATUM_UHR_PATTERN = new TextEncoder().encode("DATUM - UHR    ");
export const PATCH_DATA_FIXED = new Uint8Array([
    0x31, 0x12, 0x10, 0x00, 0x20, 0x3c, 0x00, 0x0f, 0xff, 0x00, 0x4e, 0x75,
    0x30, 0x2f, 0x00, 0x06, 0x22, 0x2f, 0x00, 0x08, 0x4e, 0x4d, 0x4e, 0x71,
    0x0c, 0x80, 0x12, 0x34, 0x56, 0x78, 0x67, 0x06, 0x06, 0x80, 0x00, 0xa9,
    0x8a, 0xc7, 0x4e, 0x75
]);

export const NAME_SEARCH_PATTERN = new Uint8Array([0x00, 0xFF, 0x53, 0x50, 0x49, 0x45, 0x4C, 0x45, 0x20, 0x00, 0x47, 0x45]);
export const NAME_SEARCH_PATTERN_ALT = new Uint8Array([0x00, 0xFF, 0x53, 0x50, 0x49, 0x45, 0x4C, 0x45, 0x20, 0x00, 0x53, 0x53, 0x50]);

let statusText: HTMLElement | null = null;
let romInfo: HTMLElement | null = null;
let progressBar: HTMLElement | null = null;

function setStatus(text: string): void {
    console.log(`[STATUS] ${text}`);
    if (statusText) {
        statusText.textContent = text;
        statusText.style.color = text.startsWith("Suche") || text.startsWith("Muster gefunden") ? "inherit" : "#007bff";
    }
    if (!text.startsWith("Suche") && !text.startsWith("Muster gefunden")) {
        console.log(`[STATUS] ${text}`);
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
        setStatus(label);
        setProgressState(progressBar, error);
    }
    // Small timeout to allow UI to repaint
    await new Promise(resolve => setTimeout(resolve, 1));
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
    const toBCD = (n: number): number => ((Math.floor(n / 10)) << 4) | (n % 10);
    return new Uint8Array([toBCD(day), toBCD(month), toBCD(year % 100), 0]);
}

function swappedCopy(source: Uint8Array): Uint8Array {
    const buffer = new Uint8Array(source);
    for (let i = 0; i < buffer.length - 1; i += 2) {
        const temp = buffer[i];
        buffer[i] = buffer[i + 1];
        buffer[i + 1] = temp;
    }
    return buffer;
}

function byteSwap(): void {
    romBuffer = swappedCopy(romBuffer);
    setStatus("Byte-Tausch abgeschlossen");
    updateRomInfo();
}

function updateRomInfo(): void {
    if (!romInfo) return;
    
    let info = "";
    if (romBuffer.length > 0) {
        info = `ROM Größe: ${romBuffer.length} bytes`;
        if (loadedDual) {
            info += `<br>Modus: Duale 8-Bit geladen<br>ODD: ${oddPath}<br>EVEN: ${evenPath}`;
        } else {
            info += `<br>Modus: 16-Bit geladen<br>Datei: ${singlePath}`;
        }
    } else {
        info = "Keine ROM geladen";
    }
    
    romInfo.innerHTML = info;
}

// File loading functions
async function loadSingleFile(): Promise<boolean> {
    if (patchInProgress) return false;
    const fileInput = document.getElementById("singleRom") as HTMLInputElement;
    const file = fileInput.files?.[0];
    
    if (!file) {
        setStatus("Bitte eine 16-Bit-EPROM-Datei auswählen.");
        await updateProgress(0, "Fehler: Keine Datei ausgewählt", true);
        return false;
    }
    
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
        setStatus(`Datei kann nicht geladen werden: ${e}`);
        await updateProgress(0, "Fehler beim Laden", true);
        return false;
    }
}

async function loadDualFiles(): Promise<boolean> {
    if (patchInProgress) return false;
    const oddInput = document.getElementById("oddRom") as HTMLInputElement;
    const evenInput = document.getElementById("evenRom") as HTMLInputElement;
    
    const oddFile = oddInput.files?.[0];
    const evenFile = evenInput.files?.[0];
    
    if (!oddFile || !evenFile) {
        setStatus("Bitte beide 8-Bit-EPROM-Dateien auswählen.");
        await updateProgress(0, "Fehler: Dateien fehlen", true);
        return false;
    }
    
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
        
        const L = Math.min(odd.length, even.length);
        const combined = new Uint8Array(L * 2);
        
        for (let i = 0; i < L; i++) {
            combined[i * 2] = odd[i];     // ODD
            combined[i * 2 + 1] = even[i]; // EVEN
        }
        
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
        setStatus(`Duale Dateien können nicht geladen werden: ${e}`);
        await updateProgress(0, "Fehler beim Laden", true);
        return false;
    }
}

// Search and patch functions
async function searchPattern(pattern: Uint8Array, reverse: boolean = false, buffer: Uint8Array = romBuffer): Promise<number> {
    if (buffer.length === 0 || pattern.length === 0 || pattern.length >= 0x32) {
        return -1;
    }

    const plen = pattern.length;

    if (!reverse) {
        for (let i = 0; i <= buffer.length - plen; i += 2) {
            const prog = Math.floor((i / buffer.length) * 100);

            // Yield every 1000 iterations to allow UI updates
            if (i % 2000 === 0) {
                setStatus(`Suche... ${prog}%`);
                await new Promise(resolve => setTimeout(resolve, 1));
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
    } else {
        // start from the last possible matching offset with same parity as 0
        let start = buffer.length - plen;
        if (start % 2 !== 0) start--;
        const total = start > 0 ? start : 0;

        for (let i = start; i >= 0; i -= 2) {
            const prog = Math.floor(((total - i) / buffer.length) * 100);

            // Yield every 1000 iterations to allow UI updates
            if ((total - i) % 2000 === 0) {
                setStatus(`Suche... ${prog}%`);
                await new Promise(resolve => setTimeout(resolve, 1));
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
    }

    setStatus("Muster nicht gefunden");
    return -1;
}

function bytesToPrintableText(bytes: Uint8Array): string {
    return Array.from(bytes)
        .map(b => b >= 0x20 && b <= 0x7e ? String.fromCharCode(b) : '.')
        .join('');
}

// Older single-file ROMs store a 16-character display name after this label.
// Text is not necessarily word-aligned, unlike the instruction patch patterns.
export function readLegacyRomName(buffer: Uint8Array): string | null {
    const marker = new TextEncoder().encode("MAX. 100 SPIELE \0");
    for (let offset = buffer.length - marker.length - 17; offset >= 0; offset--) {
        if (!marker.every((byte, index) => buffer[offset + index] === byte)) continue;
        const start = offset + marker.length;
        const name = buffer.subarray(start, start + 16);
        if (buffer[start + 16] !== 0 || !name.every(byte => byte >= 0x20 && byte <= 0x7e)) continue;
        const text = bytesToPrintableText(name).trim();
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

    if (!loadedDual) {
        const legacyName = readLegacyRomName(romBuffer);
        if (legacyName !== null) {
            romNameInput.value = legacyName;
            return;
        }
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

    console.log(`16 bytes before ${foundPatternKey} @ 0x${addr.toString(16).toUpperCase()}: ${Array.from(bytesBefore).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
    console.log(`Text before ${foundPatternKey}: "${textBefore}"`);
}

export type PatchKey = "checksum" | "dateId" | "zulassung" | "initRam" | "datumUhr" | "fixed";
export type PatchSelection = Record<PatchKey, boolean>;
export type PatchResult = { rom: Uint8Array; results: Record<PatchKey, boolean | null> };

const allPatches: PatchSelection = {
    checksum: true, dateId: true, zulassung: true,
    initRam: true, datumUhr: true, fixed: true
};

// Apply the fixed block first: the date ID patch calls code stored in that block.
export async function patchRom(source: Uint8Array, dateStr: string, zlStr: string,
    selection: PatchSelection = allPatches): Promise<PatchResult> {
    const result = new Uint8Array(source);
    const results: Record<PatchKey, boolean | null> = {
        checksum: null, dateId: null, zulassung: null,
        initRam: null, datumUhr: null, fixed: null
    };
    const fixedAddr = source.length >= 0xFFF00 + PATCH_DATA_FIXED.length ? 0xFFF00 : 0x7FF00;
    if (selection.fixed) {
        results.fixed = source.length >= fixedAddr + PATCH_DATA_FIXED.length &&
            source.subarray(fixedAddr, fixedAddr + PATCH_DATA_FIXED.length).every(byte => byte === 0xFF);
        try {
            const convertedDate = convertDate(dateStr);
            if (!/^\d{9}$/.test(zlStr)) throw new Error();
            if (results.fixed) {
                const fixed = new Uint8Array(PATCH_DATA_FIXED);
                fixed.set(convertedDate, 0);
                new DataView(fixed.buffer).setUint32(6, fixedAddr, false);
                new DataView(fixed.buffer).setUint32(26, Number(zlStr), false);
                result.set(fixed, fixedAddr);
            }
        } catch (_) {
            results.fixed = false;
        }
    }

    const find = async (pattern: Uint8Array): Promise<number> => {
        const addr = await searchPattern(pattern, false, source);
        return addr;
    };

    const applyPattern = async (key: PatchKey, pattern: Uint8Array, bytes: Uint8Array): Promise<void> => {
        if (!selection[key]) return;
        const offset = await find(pattern);
        results[key] = offset >= 0 && offset + bytes.length <= result.length;
        if (results[key]) result.set(bytes, offset);
    };
    await applyPattern("checksum", PATCH_DATA_CHECKSUM_PATTERN, PATCH_DATA_CHECKSUM_VALUE);
    const datePatch = new Uint8Array(PATCH_DATA_DATE_VALUE);
    new DataView(datePatch.buffer).setUint32(10, fixedAddr + 4, false);
    const zulassungPatch = new Uint8Array(PATCH_DATA_ZULASSUNG_VALUE);
    new DataView(zulassungPatch.buffer).setUint32(12, fixedAddr + 12, false);
    if (selection.dateId) {
        if (results.fixed === true) {
            await applyPattern("dateId", PATCH_DATA_DATE_PATTERN, datePatch);
        } else {
            results.dateId = false;
        }
    }
    await applyPattern("zulassung", PATCH_DATA_ZULASSUNG_PATTERN, zulassungPatch);

    if (selection.initRam) {
        let offset = await find(PATCH_DATA_INITRAM1_PATTERN);
        let bytes = PATCH_DATA_INITRAM1_VALUE;
        if (offset === -1) {
            offset = await find(PATCH_DATA_INITRAM2_PATTERN);
            bytes = PATCH_DATA_INITRAM2_VALUE;
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

    return { rom: result, results };
}

// Keep the loaded ROM unchanged so another attempt always starts from the original.
async function patchEPROM(): Promise<boolean> {
    if (patchInProgress) return false;
    patchInProgress = true;
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
            fixed: document.getElementById("patchFixed") as HTMLInputElement
        };
        const selection = Object.fromEntries(Object.entries(controls).map(([key, control]) => [key, control.checked])) as PatchSelection;
        Object.values(controls).forEach(control => control.classList.remove("is-valid", "is-invalid"));
        const patched = await patchRom(romBuffer, dateInput.value.trim(), zlInput.value.trim(), selection);
        let successes = 0;
        let failures = 0;
        for (const key of Object.keys(controls) as PatchKey[]) {
            const applied = patched.results[key];
            if (applied === true) successes++;
            if (applied === false) failures++;
            if (applied !== null) {
                controls[key].classList.add(applied ? "is-valid" : "is-invalid");
                controls[key].title = applied ? "Patch angewendet" : "Patch nicht angewendet";
            } else {
                controls[key].title = "Nicht ausgewählt";
            }
        }
        if (successes === 0) throw new Error("Keiner der ausgewählten Patches konnte angewendet werden");
        await exportPatched(patched.rom);
        const summary = `${successes} Patches angewendet, ${failures} nicht angewendet. Datei gespeichert.`;
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
    }
}

async function exportPatched(patched: Uint8Array): Promise<void> {
    if (patched.length === 0) return;

    if (loadedDual) {
        const odd = new Uint8Array(patched.length / 2);
        const even = new Uint8Array(patched.length / 2);

        for (let i = 0; i < odd.length; i++) {
            odd[i] = patched[i * 2];
            even[i] = patched[i * 2 + 1];
        }

        const oddName = oddPath.replace(/\.[^.]+$/, "") + "_odd_patched.ic15";
        const evenName = evenPath.replace(/\.[^.]+$/, "") + "_even_patched.ic10";
        downloadBlob(new Blob([odd], { type: "application/octet-stream" }), oddName);
        downloadBlob(new Blob([even], { type: "application/octet-stream" }), evenName);

        setStatus(`Gepatchte Dateien gespeichert: ${oddName}, ${evenName}`);
        await updateProgress(100, "Dateien gespeichert");
    } else {
        const output = singleWasSwapped ? swappedCopy(patched) : new Uint8Array(patched);
        const name = singlePath.replace(/\.[^.]+$/, "") + "_patched.bin";
        downloadBlob(new Blob([output.buffer as ArrayBuffer], { type: "application/octet-stream" }), name);
        setStatus(`Gepatchte Datei gespeichert: ${name}`);
        await updateProgress(100, "Datei gespeichert");
    }
}

// Initialize UI elements (only in browser environment)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', async () => {
        statusText = document.getElementById('statusText');
        romInfo = document.getElementById('romInfo');
        progressBar = document.getElementById('progressBar');

        await loadBauartMap();

        // Set default date to today
        const dateInput = document.getElementById('dateInput') as HTMLInputElement;
        if (dateInput) {
            dateInput.value = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        }

        const zlInput = document.getElementById('zlInput') as HTMLInputElement | null;
        const machineNameInput = document.getElementById('machinename') as HTMLInputElement | null;
        const romNameInput = document.getElementById('romname') as HTMLInputElement | null;
        if (zlInput && machineNameInput) {
            zlInput.addEventListener('input', () => {
                machineNameInput.value = lookupMachineName(zlInput.value.trim());
            });
            machineNameInput.value = lookupMachineName(zlInput.value.trim());
        }
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
}
