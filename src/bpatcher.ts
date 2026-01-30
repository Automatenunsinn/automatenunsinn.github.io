import abCheck from './abCheck';

export { convertDate };

// Global state
let romBuffer: Uint8Array = new Uint8Array();
let romSize: number = 0;
let loadedDual: boolean = false;
let oddPath: string = "";
let evenPath: string = "";
let singlePath: string = "";

// Pattern constants
export const PATCH_DATA_CHECKSUM_PATTERN = new Uint8Array([0xb0, 0x90, 0x67, 0x0e]);
export const PATCH_DATA_CHECKSUM_VALUE = new Uint8Array([0x20, 0x10, 0x60, 0x0e]);

export const PATCH_DATA_DATE_PATTERN = new Uint8Array([0x70, 0x02, 0x2f, 0x00, 0x70, 0x10, 0x2f, 0x00, 0x4e, 0xb9, 0x00, 0x00]);
export const PATCH_DATA_DATE_VALUE = new Uint8Array([0x70, 0x02, 0x2F, 0x00, 0x70, 0x10, 0x2F, 0x00, 0x4E, 0xB9, 0x00, 0x0F, 0xFF, 0x04]);

export const PATCH_DATA_ZULASSUNG_PATTERN = new Uint8Array([0x2f, 0x0a, 0x70, 0x01, 0x2f, 0x00, 0x70, 0x10, 0x2f, 0x00, 0x4e, 0xb9, 0x00, 0x00]);
export const PATCH_DATA_ZULASSUNG_VALUE = new Uint8Array([0x2F, 0x0A, 0x70, 0x01, 0x2F, 0x00, 0x70, 0x10, 0x2F, 0x00, 0x4E, 0xB9, 0x00, 0x0F, 0xFF, 0x0C]);

export const PATCH_DATA_INITRAM1_PATTERN = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x01]);
export const PATCH_DATA_INITRAM1_VALUE = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x02]);

export const PATCH_DATA_INITRAM2_PATTERN = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x01]);
export const PATCH_DATA_INITRAM2_VALUE = new Uint8Array([0x4f, 0xef, 0x00, 0x0c, 0x36, 0xbc, 0x00, 0x02]);

export const PATCH_DATA_DATUM_UHR_PATTERN = new TextEncoder().encode("DATUM - UHR    ");
export const PATCH_DATA_FIXED = new Uint8Array([
    0x31, 0x12, 0x10, 0x00, 0x20, 0x3c, 0x00, 0x0f, 0xff, 0x00, 0x4e, 0x75,
    0x30, 0x2f, 0x00, 0x06, 0x22, 0x2f, 0x00, 0x08, 0x4e, 0x4d, 0x4e, 0x71,
    0x0c, 0x80, 0x12, 0x34, 0x56, 0x78, 0x67, 0x06, 0x06, 0x80, 0x00, 0xa9,
    0x8a, 0xc7, 0x4e, 0x75
]);

let currentPatchBytes: Uint8Array = new Uint8Array();
let statusText: HTMLElement | null = null;
let romInfo: HTMLElement | null = null;
let progressBar: HTMLProgressElement | null = null;

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
        progressBar.value = value;
        setStatus(label);
        if (error) {
            progressBar.className = 'failure';
        } else {
            progressBar.className = 'success';
        }
    }
    // Small timeout to allow UI to repaint
    await new Promise(resolve => setTimeout(resolve, 1));
}

// Utility functions
function convertDate(dateStr: string): Uint8Array {
    try {
        if (dateStr.length === 8) {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6));
            const day = parseInt(dateStr.substring(6, 8));
            
            // Convert to BCD
            const toBCD = (n: number): number => {
                return ((Math.floor(n / 10)) << 4) | (n % 10);
            };
            
            return new Uint8Array([
                toBCD(day),
                toBCD(month),
                toBCD(year % 100),
                0
            ]);
        }
    } catch (e) {
        console.warn("Invalid date format:", e);
    }
    return new Uint8Array([0x00, 0x00, 0x00, 0x00]);
}

function byteSwap(): void {
    if (romBuffer.length === 0) return;
    
    setStatus("Byte-Paare tauschen...");
    
    const buffer = new Uint8Array(romBuffer);
    
    for (let i = 0; i < buffer.length - 1; i += 2) {
        const temp = buffer[i];
        buffer[i] = buffer[i + 1];
        buffer[i + 1] = temp;
        
        const prog = Math.floor((i / buffer.length) * 100);
    }
    
    romBuffer = buffer;
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
        
        if (romSize > 6 && romBuffer[6] === 0xfc) {
            byteSwap();
        }
        
        updateRomInfo();
        return true;
    } catch (e) {
        setStatus(`Datei kann nicht geladen werden: ${e}`);
        await updateProgress(0, "Fehler beim Laden", true);
        return false;
    }
}

async function loadDualFiles(): Promise<boolean> {
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
        
        if (romSize > 6 && romBuffer[6] === 0xfc) {
            byteSwap();
        }
        
        updateRomInfo();
        return true;
    } catch (e) {
        setStatus(`Duale Dateien können nicht geladen werden: ${e}`);
        await updateProgress(0, "Fehler beim Laden", true);
        return false;
    }
}

// Search and patch functions
async function searchPattern(pattern: Uint8Array): Promise<number> {
    if (romBuffer.length === 0 || pattern.length === 0 || pattern.length >= 0x32) {
        return -1;
    }

    const plen = pattern.length;

    for (let i = 0; i <= romBuffer.length - plen; i += 2) {
        const prog = Math.floor((i / romBuffer.length) * 100);
        setStatus(`Suche... ${prog}%`);

        // Yield every 1000 iterations to allow UI updates
        if (i % 2000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1));
        }

        let match = abCheck();
        for (let j = 0; j < plen; j++) {
            if (romBuffer[i + j] !== pattern[j]) {
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

async function applyPatch(offset: number, length: number): Promise<void> {
    if (length <= 0 || length >= 0x32 || currentPatchBytes.length === 0) {
        setStatus("Ungültige Patch-Länge oder keine Patch-Daten");
        await updateProgress(0, "Fehler: Ungültige Patch-Daten", true);
        return;
    }
    
    if (offset + length > romBuffer.length) {
        // Extend buffer if needed
        const newBuffer = new Uint8Array(offset + length);
        newBuffer.set(romBuffer);
        romBuffer = newBuffer;
    }
    
    const src = currentPatchBytes;
    const actualLength = Math.min(length, src.length);
    
    for (let i = 0; i < actualLength; i++) {
        romBuffer[offset + i] = src[i];
    }
}

// Main patch function
async function patchEPROM(): Promise<boolean> {
    if (romBuffer.length === 0) {
        setStatus("Keine ROM geladen");
        await updateProgress(0, "Fehler: Keine ROM geladen", true);
        return false;
    }

    const dateInput = document.getElementById("dateInput") as HTMLInputElement;
    const zlInput = document.getElementById("zlInput") as HTMLInputElement;

    const dateStr = dateInput.value.trim();
    const zlStr = zlInput.value.trim();

    if (!dateStr || !zlStr) {
        setStatus("Bitte Datum und Zulassungsnummer eingeben.");
        await updateProgress(0, "Fehler: Eingaben fehlen", true);
        return false;
    }

    setStatus("Patch-Prozess starten...");
    await updateProgress(10, "Starte Patch-Prozess...");

    try {
        // Checksum patch
        currentPatchBytes = PATCH_DATA_CHECKSUM_PATTERN;
        let addr = await searchPattern(currentPatchBytes);
        if (addr === -1) {
            setStatus("Kann Checksumme nicht Patchen!");
            await updateProgress(20, "Fehler: Checksumme nicht gefunden", true);
        } else {
            currentPatchBytes = PATCH_DATA_CHECKSUM_VALUE;
            await applyPatch(addr, 4);
            setStatus(`Checksumme lautet: $${addr.toString(16).toUpperCase()}\nWert: ${Array.from(currentPatchBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(20, "Checksumme gepatcht");
        }
        
        // Date/ID patch
        currentPatchBytes = PATCH_DATA_DATE_PATTERN;
        addr = await searchPattern(currentPatchBytes);
        if (addr === -1) {
            setStatus("Kann Datum ID-Chip nicht Patchen!");
            await updateProgress(30, "Fehler: Datum ID-Chip nicht gefunden", true);
        } else {
            currentPatchBytes = PATCH_DATA_DATE_VALUE;
            await applyPatch(addr, 14);
            setStatus(`PatchDatum lautet: $${addr.toString(16).toUpperCase()}\nWert: ${Array.from(currentPatchBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(30, "Datum ID-Chip gepatcht");
        }
        
        // Zulassung patch
        currentPatchBytes = PATCH_DATA_ZULASSUNG_PATTERN;
        addr = await searchPattern(currentPatchBytes);
        if (addr === -1) {
            setStatus("Kann Zulassung ID-Chip nicht Patchen!");
            await updateProgress(40, "Fehler: Zulassung nicht gefunden", true);
        } else {
            currentPatchBytes = PATCH_DATA_ZULASSUNG_VALUE;
            await applyPatch(addr, 16);
            setStatus(`Zulassung lautet: $${addr.toString(16).toUpperCase()}\nWert: ${Array.from(currentPatchBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(40, "Zulassung gepatcht");
        }
        
        // Init RAM patch (try pattern 1, fallback to 2)
        currentPatchBytes = PATCH_DATA_INITRAM1_PATTERN;
        addr = await searchPattern(currentPatchBytes);
        if (addr !== -1) {
            currentPatchBytes = PATCH_DATA_INITRAM1_VALUE;
            await applyPatch(addr, 8);
            setStatus(`PatchInitRam 1 lautet: $${addr.toString(16).toUpperCase()}\nWert: ${Array.from(currentPatchBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(50, "Init-Ram gepatcht");
        } else {
            currentPatchBytes = PATCH_DATA_INITRAM2_PATTERN;
            addr = await searchPattern(currentPatchBytes);
            if (addr !== -1) {
                currentPatchBytes = PATCH_DATA_INITRAM2_VALUE;
                await applyPatch(addr, 8);
                setStatus(`PatchInitRam 2 lautet: $${addr.toString(16).toUpperCase()}\nWert: ${Array.from(currentPatchBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
                await updateProgress(50, "Init-Ram gepatcht");
            } else {
                setStatus("Kann Init-Ram Typ1 u. 2 nicht Patchen!");
                await updateProgress(50, "Fehler: Init-Ram nicht gefunden", true);
            }
        }
        
        // Date/Time patch
        currentPatchBytes = PATCH_DATA_DATUM_UHR_PATTERN;
        addr = await searchPattern(currentPatchBytes);
        if (addr === -1) {
            setStatus("Kann DATUM - UHR Teil1 nicht finden!");
            await updateProgress(60, "Fehler: DATUM-UHR Teil1 nicht gefunden", true);
        } else {
            currentPatchBytes = new Uint8Array([0x20]);
            await applyPatch(addr + PATCH_DATA_DATUM_UHR_PATTERN.length, 1);
            setStatus(`DatumUhr 1 lautet: $${addr.toString(16).toUpperCase()}\nWert: ${Array.from(currentPatchBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(60, "DATUM-UHR Teil1 gepatcht");
        }
        
        // Search for second occurrence
        const addrBytes = new Uint8Array([
            (addr >> 24) & 0xFF,
            (addr >> 16) & 0xFF,
            (addr >> 8) & 0xFF,
            addr & 0xFF
        ]);
        
        currentPatchBytes = addrBytes;
        addr = await searchPattern(currentPatchBytes);
        if (addr === -1) {
            setStatus(`Kann DATUM - UHR Teil2 nicht finden! Wert: ${Array.from(addrBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(70, "Fehler: DATUM-UHR Teil2 nicht gefunden", true);
        } else {
            currentPatchBytes = new Uint8Array([0x00, 0x00]);
            await applyPatch(addr + 0x0E, 2);
            setStatus(`DatumUhr 2 lautet: $${(addr + 0x0E).toString(16).toUpperCase()}\nWert: ${Array.from(currentPatchBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(70, "DATUM-UHR Teil2 gepatcht");
        }
        
        // Fixed block at 0xFFF00
        const fixedAddr = 0xFFF00;
        if (romBuffer.length > fixedAddr) {
            currentPatchBytes = PATCH_DATA_FIXED;
            await applyPatch(fixedAddr, 0x28);
            
            // Apply date conversion to fixed block
            const convertedDate = convertDate(dateStr);
            for (let i = 0; i < 4; i++) {
                romBuffer[fixedAddr + i] = convertedDate[i];
            }
            setStatus(`Fester Block gepatcht bei 0x${fixedAddr.toString(16).toUpperCase()}`);
            
            // Apply zl nummer
            const zlNum = parseInt(zlStr);
            const zlBytes = new Uint8Array([
                (zlNum >> 24) & 0xFF,
                (zlNum >> 16) & 0xFF,
                (zlNum >> 8) & 0xFF,
                zlNum & 0xFF
            ]);

            for (let i = 0; i < 4; i++) {
                romBuffer[fixedAddr + 26 + i] = zlBytes[i];
            }

            setStatus(`Fester Block gepatcht bei 0x${(fixedAddr + 26).toString(16).toUpperCase()}\nWert: ${Array.from(zlBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`);
            await updateProgress(90, "Fester Block gepatcht");
        } else {
            setStatus("ROM zu klein für festen Block");
            await updateProgress(90, "Fehler: ROM zu klein", true);
        }

        setStatus(`Patchen abgeschlossen.`);
        await updateProgress(100, "Patchen abgeschlossen");

        await exportPatched();
        return true;
    } catch (e) {
        setStatus(`Fehler beim Patchen: ${e}`);
        await updateProgress(0, "Fehler beim Patchen", true);
        return false;
    }
}

async function exportPatched(): Promise<void> {
    if (romBuffer.length === 0) return;

    const blob = new Blob([romBuffer.buffer as ArrayBuffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    if (loadedDual) {
        // Export dual files
        const odd = new Uint8Array(romBuffer.length / 2);
        const even = new Uint8Array(romBuffer.length / 2);

        for (let i = 0; i < odd.length; i++) {
            odd[i] = romBuffer[i * 2];
            even[i] = romBuffer[i * 2 + 1];
        }

        const oddBlob = new Blob([odd], { type: "application/octet-stream" });
        const evenBlob = new Blob([even], { type: "application/octet-stream" });

        const oddUrl = URL.createObjectURL(oddBlob);
        const evenUrl = URL.createObjectURL(evenBlob);

        const oddA = document.createElement("a");
        const evenA = document.createElement("a");

        oddA.href = oddUrl;
        oddA.download = oddPath.replace(/\.[^.]+$/, "") + "_patched.ic10";
        oddA.click();

        evenA.href = evenUrl;
        evenA.download = evenPath.replace(/\.[^.]+$/, "") + "_patched.ic14";
        evenA.click();

        URL.revokeObjectURL(oddUrl);
        URL.revokeObjectURL(evenUrl);

        setStatus(`Gepatchte Dateien gespeichert: ${oddA.download}, ${evenA.download}`);
        await updateProgress(100, "Dateien gespeichert");
    } else {
        a.href = url;
        a.download = singlePath.replace(/\.[^.]+$/, "") + "_patched.bin";
        a.click();
        setStatus(`Gepatchte Datei gespeichert: ${a.download}`);
        await updateProgress(100, "Datei gespeichert");
    }

    URL.revokeObjectURL(url);
}

// Initialize UI elements (only in browser environment)
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        statusText = document.getElementById('statusText');
        romInfo = document.getElementById('romInfo');
        progressBar = document.getElementById('progressBar') as HTMLProgressElement;

        // Set default date to today
        const dateInput = document.getElementById('dateInput') as HTMLInputElement;
        if (dateInput) {
            dateInput.value = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        }
    });
}

// Export functions to window for HTML onclick handlers (only in browser environment)
if (typeof window !== 'undefined') {
    (window as any).loadSingleFile = loadSingleFile;
    (window as any).loadDualFiles = loadDualFiles;
    (window as any).patchEPROM = patchEPROM;
}