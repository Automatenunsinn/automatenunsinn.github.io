import { parseDate, dumpXcInfo, XcInfo } from './xcfunctions';
import { BASE_URL, deviceConfig, fileMappings } from './fileMappings';

// WebSerial type definitions based on WebIDL specification
interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
}

interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
}

interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
}

interface SerialPort {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
}

interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: "none" | "even" | "odd";
    bufferSize?: number;
    flowControl?: "none" | "hardware";
}

interface Serial extends EventTarget {
    onconnect: EventHandler;
    ondisconnect: EventHandler;
    getPorts(): Promise<SerialPort[]>;
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
}

type EventHandler = ((this: Serial, ev: Event) => any) | null;

declare global {
    interface Navigator {
        serial: Serial;
    }
}

// Flash file types
interface FileMappingEntry {
    name?: string;
    bin: string;
    config?: string;
    loader?: string;
}

type FileMapping = string | FileMappingEntry;

interface FactoryResetEntry {
    name: string;
    bin: string;
}

interface FileMappings {
    roteDBFiles: FileMapping[];
    blaugelb1MBDBFiles: FileMapping[];
    blaugelbUHGDBFiles: FileMapping[];
    gelbeDBFiles: FileMapping[];
    lila2MBFiles: FileMapping[];
    factoryResetFiles: FactoryResetEntry[];
}

const KILL_COMMAND = "7c6b696c6cfdc4551b53594e4353594e4357414954474f0a";

// Response codes from device
const RESPONSES: Record<number, string> = {
    0x31: "Unbekannter Befehl",
    0x32: "Warte auf weitere Daten.",
    0x33: "Datei OK, wird gestartet.",
    0x34: "Initialisierung der Daten abgeschlossen."
};

// State variables
let commandBuffer: Uint8Array = convertHexStringToByteArray(KILL_COMMAND);
let loaderData: Uint8Array = new Uint8Array();
let xcData: Uint8Array = new Uint8Array();
let factoryData: Uint8Array = new Uint8Array();
let int1 = 0;
let int2 = 0;
let intFactory = 0;
let schnelleDB = false;
let stopUpload = false;
let currentLoader = 'roteDB';
let currentFileInfo: FileMappingEntry | null = null;
let currentFactoryReset: FactoryResetEntry | null = null;

// Serial port
let port: SerialPort | null = null;
let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;

// Helper functions
function convertHexStringToByteArray(hexString: string): Uint8Array {
    if (hexString.length % 2 !== 0) {
        throw new Error(`Der Binärschlüssel muss gerade sein: ${hexString}`);
    }
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return bytes;
}

function shiftmod(v: number): number {
    return ((Math.floor(v / 10) << 4) | (v % 10)) & 0xFF;
}

function log(msg: string): void {
    const logArea = document.getElementById('logArea') as HTMLTextAreaElement | null;
    if (logArea) {
        logArea.value += msg + '\n';
        logArea.scrollTop = logArea.scrollHeight;
    }
    console.log(msg);
}

function setStatus(msg: string): void {
    // Status is now reflected in the connect button color
    console.log('Status:', msg);
}

function updateProgress(value: number, max?: number): void {
    const progress = document.getElementById('progressBar') as HTMLProgressElement | null;
    if (progress) {
        if (max !== undefined) {
            progress.max = max;
        }
        progress.value = value;
    }
}

function updateFileInfo(info: string): void {
    const fileInfoEl = document.getElementById('fileInfo') as HTMLElement | null;
    if (fileInfoEl) {
        fileInfoEl.textContent = info;
    }
}

// Log XC info to the log area
function logXcInfo(info: XcInfo): void {
    log('=== XC-Datei Info ===');
    log(`Name: ${info.name}`);
    log(`Copyright: ${info.copyright}`);
    log(`Version: ${info.version}`);
    log(`Datum: ${info.date}`);
    log(`Spielart: ${info.gameType}`);
    log(`Größe: ${info.size} Bytes`);
    log(`Hersteller: ${info.manufacturer}`);
    log(`DB-Typ: 0x${info.dbtype.toString(16).toUpperCase().padStart(4, '0')}`);
    log(`MD5: ${info.md5}`);
    log(`CRC32: ${info.crc32}`);
}

// Get currently selected size
function getSelectedSize(): string {
    const checkedRadio = document.querySelector('input[name="size"]:checked') as HTMLInputElement | null;
    return checkedRadio?.value || 'roteDB';
}

// Populate file select dropdown based on selected size
function populateFileSelect(): void {
    const datalist = document.getElementById('fileList') as HTMLDataListElement | null;
    if (!datalist || !fileMappings) return;
    
    const selectedSize = getSelectedSize();
    const categories = sizeToCategories[selectedSize];
    
    datalist.innerHTML = '';
    
    if (!categories) return;
    
    // Store file entries for lookup
    const fileEntries: Map<string, FileMappingEntry> = new Map();
    
    // Loader type is determined by the selected module size, not the file category
    const loaderType = selectedSize;
    
    for (const category of categories) {
        const files = fileMappings[category];
        if (!files || files.length === 0) continue;
        
        for (const file of files) {
            const option = document.createElement('option');
            let entry: FileMappingEntry;
            
            if (typeof file === 'string') {
                entry = { bin: file, loader: loaderType };
                option.value = file.replace('.bin', '');
            } else {
                entry = file as FileMappingEntry;
                entry.loader = entry.loader || loaderType;
                option.value = entry.name || entry.bin.replace('.bin', '');
            }
            
            // Store the entry for lookup by display name
            fileEntries.set(option.value, entry);
            datalist.appendChild(option);
        }
    }
    
    // Store the file entries map on the window object for lookup
    (window as any).fileEntries = fileEntries;
}

// Populate factory reset dropdown
function populateFactoryResetSelect(): void {
    const select = document.getElementById('factoryResetSelect') as HTMLSelectElement | null;
    if (!select || !fileMappings) return;
    
    select.innerHTML = '<option value="">-- Factory Reset auswählen --</option>';
    
    const factoryFiles = fileMappings.factoryResetFiles;
    if (!factoryFiles || factoryFiles.length === 0) return;
    
    for (const file of factoryFiles) {
        const option = document.createElement('option');
        option.value = JSON.stringify(file);
        option.textContent = file.name;
        select.appendChild(option);
    }
}

// Handle incoming data
function handleIncoming(data: Uint8Array): void {
    console.log('Incoming data:', data);
    if (data.length <= 1) return;
    if (data[0] === 0xFF) return;

    for (let i = 0; i < data.length - 1; i++) {
        if (data[i] === 0x1B) {
            const code = data[i + 1];
            if (code in RESPONSES) {
                const msg = RESPONSES[code];
                log(msg);
                setStatus(msg);
            } else {
                setStatus(`${data[i].toString(16).padStart(2, '0').toUpperCase()} ${data[i + 1].toString(16).padStart(2, '0').toUpperCase()}`);
            }
        }
    }
    log('RX: ' + Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
}

// Read data from serial port
async function readLoop(): Promise<void> {
    if (!port || !port.readable) {
        console.log('readLoop: port or readable is null');
        return;
    }

    console.log('readLoop: starting...');
    while (port.readable) {
        const reader = port.readable.getReader();
        console.log('readLoop: reader acquired');
        try {
            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }
                handleIncoming(value);
            }
        } catch (error) {
            console.error('readLoop error:', error);
        } finally {
            reader.releaseLock();
        }
    }
}

// Write data to serial port with optional delay between bytes
async function writeData(data: Uint8Array, delayMs: number = 2): Promise<void> {
    if (!port || !port.writable) return;
    
    writer = port.writable.getWriter();
    try {
        for (const byte of data) {
            await writer.write(new Uint8Array([byte]));
            if (delayMs > 0) {
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    } finally {
        if (writer) {
            writer.releaseLock();
        }
    }
}

// Load file from URL
async function loadFileFromUrl(url: string): Promise<Uint8Array | null> {
    try {
        log(`Lade von: ${url}`);
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        return new Uint8Array(arrayBuffer);
    } catch (error) {
        log('Fehler beim Laden der Datei: ' + error);
        return null;
    }
}

// Load selected file from input (downloads both loader and XC file)
async function loadSelectedFile(): Promise<void> {
    const input = document.getElementById('fileSelect') as HTMLInputElement | null;
    if (!input) return;
    
    const selectedName = input.value.trim();
    if (!selectedName) return;
    
    // Look up the file entry from the stored map
    const fileEntries: Map<string, FileMappingEntry> = (window as any).fileEntries;
    if (!fileEntries || !fileEntries.has(selectedName)) {
        log('Datei nicht in der Liste gefunden: ' + selectedName);
        return;
    }
    
    try {
        currentFileInfo = fileEntries.get(selectedName) as FileMappingEntry;
        // Loader type is determined by the selected module size, not the file
        currentLoader = getSelectedSize();
        
        log(`Ausgewählte Datei: ${currentFileInfo.name || currentFileInfo.bin}`);
        log(`Loader-Typ: ${currentLoader}`);
        
        const config = loaderConfig[currentLoader];
        if (!config) {
            log(`Unbekannter Loader-Typ: ${currentLoader}`);
            return;
        }
        
        updateFileInfo(`Loader: ${currentLoader} | Datei: ${currentFileInfo.bin}`);
        
        // Download loader from example.com
        log('Lade Loader...');
        const loaderUrl = `${BASE_URL}/loader/${config.loaderFile}`;
        const loadedLoader = await loadFileFromUrl(loaderUrl);
        if (!loadedLoader) {
            log('Fehler beim Laden des Loaders!');
            return;
        }
        loaderData = loadedLoader;
        int1 = loaderData.length % 64;
        log(`Loader geladen: ${loaderData.length} Bytes`);
        
        // Download XC file from example.com
        log('Lade XC-Datei...');
        const xcUrl = `${BASE_URL}/xc/${currentFileInfo.bin}`;
        const loadedXc = await loadFileFromUrl(xcUrl);
        if (!loadedXc) {
            log('Fehler beim Laden der XC-Datei!');
            return;
        }
        xcData = loadedXc;
        int2 = xcData.length % 64;
        
        // Dump XC file info
        const xcInfo = dumpXcInfo(xcData);
        if (xcInfo) {
            // Set schnelleDB based on dbtype (Group B types are fast)
            schnelleDB = GROUP_B.has(xcInfo.dbtype);
            
            log(`XC-Datei geladen: ${xcData.length} Bytes`);
            logXcInfo(xcInfo);
            setStatus('Dateien geladen');
            
            // Enable buttons
            const uploadLoaderBtn = document.getElementById('uploadLoaderBtn') as HTMLButtonElement | null;
            const setTimeBtn = document.getElementById('setTimeBtn') as HTMLButtonElement | null;
            const uploadXcBtn = document.getElementById('uploadXcBtn') as HTMLButtonElement | null;
            const fullFlashBtn = document.getElementById('fullFlashBtn') as HTMLButtonElement | null;
            
            if (uploadLoaderBtn) uploadLoaderBtn.disabled = false;
            if (fullFlashBtn) fullFlashBtn.disabled = false;
        } else {
            log('Header kaputt oder falscher Dateityp...!');
        }
    } catch (e) {
        log('Fehler: ' + e);
    }
}

// Load factory reset file from dropdown
async function loadFactoryResetFile(): Promise<void> {
    const select = document.getElementById('factoryResetSelect') as HTMLSelectElement | null;
    if (!select) return;
    
    const selectedOption = select.options[select.selectedIndex];
    if (!selectedOption || !selectedOption.value) return;
    
    try {
        currentFactoryReset = JSON.parse(selectedOption.value) as FactoryResetEntry;
        
        log(`Ausgewähltes Factory Reset: ${currentFactoryReset.name}`);
        
        // Download factory reset file from example.com
        log('Lade Factory Reset Datei...');
        const factoryUrl = `${BASE_URL}/factory/${currentFactoryReset.bin}`;
        const loadedFactory = await loadFileFromUrl(factoryUrl);
        if (!loadedFactory) {
            log('Fehler beim Laden der Factory Reset Datei!');
            return;
        }
        factoryData = loadedFactory;
        intFactory = factoryData.length % 64;
        
        log(`Factory Reset geladen: ${factoryData.length} Bytes`);
        setStatus('Factory Reset geladen');
        
        // Enable factory upload button
        const uploadFactoryBtn = document.getElementById('uploadFactoryBtn') as HTMLButtonElement | null;
        if (uploadFactoryBtn) uploadFactoryBtn.disabled = false;
    } catch (e) {
        log('Fehler: ' + e);
    }
}

// Load custom factory reset file from user's computer
async function loadCustomFactoryFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xc,.Xc,.XC,.bin';
    
    input.onchange = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
            log(`Lade Factory Reset Datei: ${file.name}`);
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            factoryData = data;
            intFactory = factoryData.length % 64;
            
            // Create a pseudo entry for the custom file
            currentFactoryReset = {
                name: file.name,
                bin: file.name
            };
            
            log(`Factory Reset geladen: ${factoryData.length} Bytes`);
            setStatus('Factory Reset geladen');
            
            // Update factory info display
            const factoryInfo = document.getElementById('factoryInfo') as HTMLElement | null;
            if (factoryInfo) {
                factoryInfo.textContent = `Eigene Datei: ${file.name} (${factoryData.length} Bytes)`;
            }
            
            // Enable factory upload button
            const uploadFactoryBtn = document.getElementById('uploadFactoryBtn') as HTMLButtonElement | null;
            if (uploadFactoryBtn) uploadFactoryBtn.disabled = false;
        } catch (e) {
            log('Fehler beim Laden der Factory Reset Datei: ' + e);
        }
    };
    
    input.click();
}

// Upload factory reset file to device
async function uploadFactory(): Promise<boolean> {
    if (!port || !port.writable) {
        log('Nicht verbunden...!');
        return false;
    }
    
    if (factoryData.length === 0) {
        log('Keine Factory Reset Datei geladen!');
        return false;
    }
    
    log('Uploade Factory Reset...');
    setStatus('Uploade Factory Reset...');
    
    try {
        const factoryTotal = factoryData.length;
        updateProgress(0, factoryTotal);
        
        // Send upload header first
        const head = commandBuffer.slice(8, 24);
        const buffer = new Uint8Array(24);
        buffer.set(head, 0);
        await writeData(buffer, 2);
        
        // Upload first 256 bytes
        for (let i = 0; i < 256; i++) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writeData(new Uint8Array([factoryData[i]]), 0);
            updateProgress(i);
        }
        
        await new Promise(resolve => setTimeout(resolve, 25));
        
        let num = 256;
        while (num < factoryTotal - intFactory) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writeData(factoryData.slice(num, num + 64), 0);
            updateProgress(num);
            num += 64;
        }
        
        if (intFactory > 0) {
            await writeData(factoryData.slice(num, num + intFactory), 0);
        }
        updateProgress(num + intFactory);
        
        log('Factory Reset Upload fertig...!');
        setStatus('Factory Reset hochgeladen');
        
        return true;
    } catch (e) {
        log('Factory Reset Upload Fehler: ' + e);
        return false;
    }
}

// Upload loader to device
async function uploadLoader(): Promise<boolean> {
    if (!port || !port.writable) {
        log('Nicht verbunden...!');
        return false;
    }
    
    if (loaderData.length === 0) {
        log('Kein Loader geladen!');
        return false;
    }
    
    log('Uploade Loader...');
    setStatus('Uploade Loader...');
    
    try {
        const total = loaderData.length;
        updateProgress(0, total);
        stopUpload = false;
        
        let num = 0;
        while (num < total - int1) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writeData(loaderData.slice(num, num + 64), 0);
            updateProgress(num);
            num += 64;
        }
        
        if (int1 > 0) {
            await writeData(loaderData.slice(num, num + int1), 0);
        }
        updateProgress(num + int1);
        
        log('Loader Upload fertig...!');
        setStatus('Loader hochgeladen');
        
        // Enable time button after loader upload
        const setTimeBtn = document.getElementById('setTimeBtn') as HTMLButtonElement | null;
        if (setTimeBtn) setTimeBtn.disabled = false;
        
        return true;
    } catch (e) {
        log('Loader Upload Fehler: ' + e);
        return false;
    }
}

// Get the selected date from DOM (year from dropdown, current date/time otherwise)
function getSelectedDate(): Date {
    const yearSelect = document.getElementById('yearSelect') as HTMLSelectElement | null;
    const selectedYear = yearSelect ? parseInt(yearSelect.value, 10) : new Date().getFullYear();
    
    const now = new Date();
    // Use selected year but keep current month, day, and time
    return new Date(selectedYear, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
}

// Enable UI elements after time is set
function enableUiAfterTimeSet(): void {
    const uploadXcBtn = document.getElementById('uploadXcBtn') as HTMLButtonElement | null;
    if (uploadXcBtn) uploadXcBtn.disabled = false;
}

// Set time on device
async function setTime(date: Date): Promise<boolean> {
    if (!port || !port.writable) {
        log('Nicht verbunden...!');
        return false;
    }
    
    log('Setze Zeit...');
    setStatus('Setze Zeit...');
    
    try {
        const weekday = (date.getDay() + 6) % 7 + 1;
        const header2 = (date.getTimezoneOffset() > 0) ? 1 : 0;
        
        const yyyy = date.getFullYear() % 100;
        
        const numArray = new Uint8Array(24);
        numArray.set(commandBuffer.slice(8, 24), 0);
        numArray[16] = shiftmod(date.getHours());
        numArray[17] = shiftmod(date.getMinutes());
        numArray[18] = header2;
        numArray[19] = shiftmod(date.getDate());
        numArray[20] = shiftmod(date.getMonth() + 1);
        numArray[21] = shiftmod(yyyy);
        numArray[22] = weekday;
        
        let s = 0;
        for (let i = 16; i < numArray.length - 1; i++) {
            s = (s + numArray[i]) & 0xFF;
        }
        numArray[23] = s;
        
        await writeData(numArray, 2);
        
        log(`Zeit gesetzt: ${date.toLocaleDateString('de-DE')} ${date.toLocaleTimeString('de-DE')}`);
        setStatus('Zeit gesetzt');
        
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        return true;
    } catch (e) {
        log('Fehler beim Setzen der Zeit: ' + e);
        return false;
    }
}

// Set time from DOM (wrapper that gets date from UI and calls setTime)
async function setTimeFromDOM(): Promise<boolean> {
    const date = getSelectedDate();
    const result = await setTime(date);
    if (result) {
        enableUiAfterTimeSet();
    }
    return result;
}

// Upload XC file to device
async function uploadXc(): Promise<boolean> {
    if (!port || !port.writable) {
        log('Nicht verbunden...!');
        return false;
    }
    
    if (xcData.length === 0) {
        log('Keine XC-Datei geladen!');
        return false;
    }
    
    log('Uploade XC-Datei...');
    setStatus('Uploade XC-Datei...');
    
    try {
        // Send upload header first
        const head = commandBuffer.slice(8, 24);
        const buffer = new Uint8Array(24);
        buffer.set(head, 0);
        await writeData(buffer, 2);
        
        const total = xcData.length;
        updateProgress(0, total);
        stopUpload = false;
        
        // Upload first 256 bytes
        for (let i = 0; i < 256; i++) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writeData(new Uint8Array([xcData[i]]), 0);
            updateProgress(i);
        }
        
        await new Promise(resolve => setTimeout(resolve, 25));
        
        // Switch to higher baud rate for fast DB
        if (schnelleDB && port) {
            await port.close();
            await port.open({ baudRate: 115200 });
            readLoop();
        }
        
        let num = 256;
        while (num < total - int2) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writeData(xcData.slice(num, num + 64), 0);
            updateProgress(num);
            num += 64;
        }
        
        if (int2 > 0) {
            await writeData(xcData.slice(num, num + int2), 0);
        }
        updateProgress(num + int2);
        
        log('XC Upload fertig...!');
        setStatus('XC hochgeladen');
        
        // Restore baud rate if changed
        if (schnelleDB && port) {
            await port.close();
            await port.open({ baudRate: 57600 });
            readLoop();
        }
        
        return true;
    } catch (e) {
        log('XC Upload Fehler: ' + e);
        return false;
    }
}

// Full flash workflow: loader -> time -> [factory reset] -> xc
async function fullFlash(): Promise<void> {
    if (!port || !port.writable) {
        log('Nicht verbunden...!');
        return;
    }
    
    if (loaderData.length === 0 || xcData.length === 0) {
        log('Keine Dateien geladen!');
        return;
    }
    
    log('Starte kompletten Flash-Vorgang...');
    
    // Step 1: Upload loader
    const loaderOk = await uploadLoader();
    if (!loaderOk) {
        log('Flash-Vorgang abgebrochen: Loader fehlgeschlagen');
        return;
    }
    
    // Step 2: Set time
    const timeOk = await setTime(getSelectedDate());
    enableUiAfterTimeSet();
    if (!timeOk) {
        log('Flash-Vorgang abgebrochen: Zeit setzen fehlgeschlagen');
        return;
    }
    
    // Wait a moment
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Step 3: Upload factory reset if selected
    if (factoryData.length > 0) {
        log('Uploade Factory Reset vor XC-Datei...');
        
        // Send upload header first
        const head = commandBuffer.slice(8, 24);
        const buffer = new Uint8Array(24);
        buffer.set(head, 0);
        await writeData(buffer, 2);
        
        const factoryTotal = factoryData.length;
        updateProgress(0, factoryTotal);
        stopUpload = false;
        
        // Upload first 256 bytes
        for (let i = 0; i < 256; i++) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return;
            }
            await writeData(new Uint8Array([factoryData[i]]), 0);
            updateProgress(i);
        }
        
        await new Promise(resolve => setTimeout(resolve, 25));
        
        let num = 256;
        while (num < factoryTotal - intFactory) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return;
            }
            await writeData(factoryData.slice(num, num + 64), 0);
            updateProgress(num);
            num += 64;
        }
        
        if (intFactory > 0) {
            await writeData(factoryData.slice(num, num + intFactory), 0);
        }
        updateProgress(num + intFactory);
        
        log('Factory Reset hochgeladen');
        
        // Wait for device to process factory reset
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Step 4: Upload XC file
    const xcOk = await uploadXc();
    if (!xcOk) {
        log('Flash-Vorgang abgebrochen: XC Upload fehlgeschlagen');
        return;
    }
    
    log('Kompletter Flash-Vorgang erfolgreich!');
    setStatus('Fertig!');
}

// Connect to serial port
async function connect(): Promise<void> {
    const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;
    
    try {
        if (port) {
            if (reader) {
                await reader.cancel();
            }
            await port.close();
            port = null;
            
            if (connectBtn) {
                connectBtn.textContent = 'Verbinden';
                connectBtn.className = '';
            }
            
            // Disable kill button when disconnected
            const killBtn = document.getElementById('killBtn') as HTMLButtonElement | null;
            if (killBtn) killBtn.disabled = true;
            
            setStatus('Getrennt...');
            return;
        }
        
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 57600 });
        
        readLoop();
        
        if (connectBtn) {
            connectBtn.textContent = 'Trennen';
            connectBtn.className = 'success';
        }
        setStatus('Verbunden');
        
        // Enable kill button when connected
        const killBtn = document.getElementById('killBtn') as HTMLButtonElement | null;
        if (killBtn) killBtn.disabled = false;
    } catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
            log('Kein Gerät ausgewählt.');
        } else {
            log(String(error));
        }
        if (connectBtn) connectBtn.className = 'failure';
    }
}

//dbtype
const GROUP_A = new Set([0x5926, 0x594A, 0x6102, 0x6103]);
const GROUP_B = new Set([0x4102, 0x4A03, 0x4A04, 0x4B04, 0x4C04]);

// Load custom XC file from user's computer
async function loadCustomXcFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xc,.Xc,.XC,.bin';
    
    input.onchange = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
            log(`Lade Datei: ${file.name}`);
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            // Check header
            if (data.length <= 0x100) {
                log('Datei zu klein für XC-Format!');
                return;
            }
            
            // Dump XC file info
            const xcInfo = dumpXcInfo(data);
            if (xcInfo) {
                // Set schnelleDB based on dbtype (Group B types are fast)
                schnelleDB = GROUP_B.has(xcInfo.dbtype);
                xcData = data;
                int2 = xcData.length % 64;
                
                log(`XC-Datei geladen: ${xcData.length} Bytes`);
                logXcInfo(xcInfo);
                
                updateFileInfo(`Eigene Datei: ${file.name}`);
                setStatus('XC-Datei geladen');
                
                // Enable buttons
                const uploadLoaderBtn = document.getElementById('uploadLoaderBtn') as HTMLButtonElement | null;
                const fullFlashBtn = document.getElementById('fullFlashBtn') as HTMLButtonElement | null;
                
                if (uploadLoaderBtn) uploadLoaderBtn.disabled = false;
                if (fullFlashBtn) fullFlashBtn.disabled = false;
            } else {
                log('Header kaputt oder falscher Dateityp...!');
                // Still set xcData and try to dump info for analysis
                xcData = data;
                int2 = xcData.length % 64;
                
                updateFileInfo(`Eigene Datei: ${file.name} (Header ungültig)`);
                setStatus('XC-Datei geladen (Warnung: Header ungültig)');
                
                // Enable buttons anyway - user may want to try uploading
                const uploadLoaderBtn = document.getElementById('uploadLoaderBtn') as HTMLButtonElement | null;
                const fullFlashBtn = document.getElementById('fullFlashBtn') as HTMLButtonElement | null;
                
                if (uploadLoaderBtn) uploadLoaderBtn.disabled = false;
                if (fullFlashBtn) fullFlashBtn.disabled = false;
            }
        } catch (e) {
            log('Fehler beim Laden der Datei: ' + e);
        }
    };
    
    input.click();
}

// Load custom loader from user's computer
async function loadCustomLoaderFile(): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xc,.Xc,.XC,.bin';
    
    input.onchange = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
            log(`Lade Loader: ${file.name}`);
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            
            loaderData = data;
            int1 = loaderData.length % 64;
            
            log(`Loader geladen: ${loaderData.length} Bytes`);
            setStatus('Loader geladen');
            
            const loaderInfo = document.getElementById('loaderInfo') as HTMLElement | null;
            if (loaderInfo) {
                loaderInfo.textContent = `Eigener Loader: ${file.name} (${loaderData.length} Bytes)`;
            }
            
            // Enable upload button
            const uploadLoaderBtn = document.getElementById('uploadLoaderBtn') as HTMLButtonElement | null;
            if (uploadLoaderBtn) uploadLoaderBtn.disabled = false;
        } catch (e) {
            log('Fehler beim Laden des Loaders: ' + e);
        }
    };
    
    input.click();
}

// Reset loader to default based on size selection
function resetLoader(): void {
    loaderData = new Uint8Array();
    int1 = 0;
    
    const loaderInfo = document.getElementById('loaderInfo') as HTMLElement | null;
    if (loaderInfo) {
        loaderInfo.textContent = 'Automatisch basierend auf Größe';
    }
    
    log('Loader zurückgesetzt.');
    setStatus('Loader zurückgesetzt');
}

// Send kill command to erase database
async function sendKillCommand(): Promise<void> {
    if (!port || !port.writable) {
        log('Nicht verbunden...!');
        return;
    }
    
    log('Sende Kill-Befehl...');
    setStatus('Sende Kill-Befehl...');

    commandBuffer = convertHexStringToByteArray(KILL_COMMAND);
    console.log(commandBuffer);
    try {
        await writeData(commandBuffer, 2);
        log('Kill-Befehl gesendet.');
        setStatus('Kill-Befehl gesendet');
    } catch (e) {
        log('Fehler beim Senden des Kill-Befehls: ' + e);
    }
}

// Populate year dropdown with years from 1990 to 2050
function populateYearDropdown(): void {
    const yearSelect = document.getElementById('yearSelect') as HTMLSelectElement | null;
    if (!yearSelect) return;
    
    const currentYear = new Date().getFullYear();
    
    for (let year = 1990; year <= 2050; year++) {
        const option = document.createElement('option');
        option.value = year.toString();
        option.textContent = year.toString();
        if (year === currentYear) {
            option.selected = true;
        }
        yearSelect.appendChild(option);
    }
}

// Initialize event listeners
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Populate year dropdown
        populateYearDropdown();
        
        // Populate file selects from imported mappings
        populateFileSelect();
        populateFactoryResetSelect();
        
        // Connect button
        document.getElementById('connectBtn')?.addEventListener('click', connect);
        
        // File selection
        document.getElementById('loadFileBtn')?.addEventListener('click', loadSelectedFile);
        
        // Custom XC file button
        document.getElementById('loadCustomXcBtn')?.addEventListener('click', loadCustomXcFile);
        
        // Custom loader buttons
        document.getElementById('loadCustomLoaderBtn')?.addEventListener('click', loadCustomLoaderFile);
        document.getElementById('resetLoaderBtn')?.addEventListener('click', resetLoader);
        
        // Factory reset buttons
        document.getElementById('loadFactoryResetBtn')?.addEventListener('click', loadFactoryResetFile);
        document.getElementById('loadCustomFactoryBtn')?.addEventListener('click', loadCustomFactoryFile);
        document.getElementById('uploadFactoryBtn')?.addEventListener('click', uploadFactory);
        
        // Action buttons
        document.getElementById('uploadLoaderBtn')?.addEventListener('click', uploadLoader);
        document.getElementById('setTimeBtn')?.addEventListener('click', setTimeFromDOM);
        document.getElementById('uploadXcBtn')?.addEventListener('click', uploadXc);
        document.getElementById('fullFlashBtn')?.addEventListener('click', fullFlash);
        document.getElementById('killBtn')?.addEventListener('click', sendKillCommand);
        
        // Abort button
        document.getElementById('abortBtn')?.addEventListener('click', () => {
            stopUpload = true;
        });
        
        // Size radio buttons - update file dropdown when size changes
        document.querySelectorAll('input[name="size"]').forEach(radio => {
            radio.addEventListener('change', () => {
                populateFileSelect();
                // Clear file info when size changes
                updateFileInfo('');
            });
        });
    });
}

export {};

