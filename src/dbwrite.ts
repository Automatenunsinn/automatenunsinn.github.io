import { dumpXcInfo, XcInfo } from './xcfunctions';
import { BASE_URL, deviceConfig, fileMappings } from './fileMappings';
import { SerialPort } from './types/webserial';
import { writePort, readLoop, loadFileFromUrl } from './utils/serial';
import { log, clearLog, setStatus, updateProgress, updateFileInfo, setButtonState } from './utils/ui';

// Flash file types
interface FileMappingEntry {
    name?: string;
    bin: string;
    subdir?: string;
    config?: string;
    loader?: string;
}

// Constants
const KILL_COMMAND_HEX = "7c6b696c6cfdc4551b53594e4353594e4357414954474f0a";

// Response codes from device
const DEVICE_RESPONSES: Record<number, string> = {
    0x31: "Unbekannter Befehl",
    0x32: "Warte auf weitere Daten.",
    0x33: "Datei OK, wird gestartet.",
    0x34: "Initialisierung der Daten abgeschlossen."
};

// DB Type Groups (Group B = fast DB, Group A = slow DB)
export const DB_GROUP_A = new Set([0x31415926, 0x3141594A, 0x61646102, 0x61646103]);
export const DB_GROUP_B = new Set([0x31414102, 0x61644A03, 0x61644A04, 0x61644B04, 0x61644C04]);

// State variables
let commandBuffer: Uint8Array = convertHexStringToByteArray(KILL_COMMAND_HEX);
let loaderData: Uint8Array = new Uint8Array();
let xcData: Uint8Array = new Uint8Array();
let factoryData: Uint8Array = new Uint8Array();
let remainingLoaderBytes = 0;
let remainingXcBytes = 0;
let remainingFactoryBytes = 0;
let isFastDB = false;
let stopUpload = false;
let currentLoaderType = '31415900';
let currentFileInfo: FileMappingEntry | null = null;
let currentFactoryReset: FileMappingEntry | null = null;

// Serial port
let port: SerialPort | null = null;

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

function determineDeviceConfig(info: XcInfo) {
    return info.dbtype.toString(16).padStart(8, '0');
}

// Log XC info to the log area
function logXcInfo(info: XcInfo): void {
    log('');
    log('=== XC-Datei Info ===');
    log(`Name: ${info.name}`);
    log(`Copyright: ${info.copyright}`);
    log(`Version: ${info.version}`);
    log(`Datum: ${info.date}`);
    log(`Spielart: ${info.gameType}`);
    log(`Größe: ${info.size} Bytes`);
    log(`Erwartete Größe: ${info.expectedSize} Bytes`);
    log(`Größenprüfung: ${info.size === info.expectedSize ? 'OK' : 'FEHLER'}`);
    log(`Hersteller: ${info.manufacturer}`);
    log(`DB-Typ: 0x${info.dbtype.toString(16).toUpperCase().padStart(8, '0')}`);
    log(`MD5: ${info.md5}`);
    log(`CRC32: ${info.crc32}`);

    // Determine device config from XC info
    const determinedConfig = determineDeviceConfig(info);
    log(`Geeignete Konfiguration: ${determinedConfig || 'Unbekannt'}`);

    // Check if determined config matches selected config
    const selectedConfig = getSelectedSize();
    if (determinedConfig && selectedConfig && determinedConfig.slice(0, 6) !== selectedConfig.slice(0, 6)) {
        console.warn(`Warnung: Die ausgewählte Konfiguration (${selectedConfig}) stimmt nicht mit der empfohlenen Konfiguration (${determinedConfig}) überein!`);
        log(`Warnung: Die ausgewählte Konfiguration (${selectedConfig}) stimmt nicht mit der empfohlenen Konfiguration (${determinedConfig}) überein!`);
    }
}

// Get currently selected size
function getSelectedSize(): string {
    const checkedRadio = document.querySelector('input[name="size"]:checked') as HTMLInputElement | null;
    return checkedRadio?.value || '31415900';
}

// Populate file select dropdown based on selected size
function populateFileSelect(): void {
    const datalist = document.getElementById('fileList') as HTMLDataListElement | null;
    if (!datalist || !fileMappings) return;

    const selectedSize = getSelectedSize();
    const config = deviceConfig[selectedSize];

    datalist.innerHTML = '';

    if (!config) return;

    // Store file entries for lookup
    const fileEntries: Map<string, FileMappingEntry> = new Map();

    // Loader type is determined by the selected module size
    const loaderType = selectedSize;

    // Get compatible files for this device type
    for (const category of config.compatibleFiles) {
        const files = fileMappings[category];
        if (!files || files.length === 0) continue;

        for (const file of files) {
            const option = document.createElement('option');
            const entry: FileMappingEntry = {
                bin: file,
                loader: loaderType,
                subdir: category
            };
            option.value = file.replace('.bin', '');

            // Store the entry for lookup by display name
            fileEntries.set(option.value, entry);
            datalist.appendChild(option);
        }
    }

    // Store the file entries map on the window object for lookup
    (window as any).fileEntries = fileEntries;
}

// Load factory reset file based on selected size
async function loadFactoryResetFile(): Promise<void> {
    // Set progress bar to idle state
    updateProgress(0);
    
    const selectedSize = getSelectedSize();
    const config = deviceConfig[selectedSize];

    if (!config || !config.factoryFile) {
        log('Kein Factory Reset für diese Größe verfügbar!');
        return;
    }

    try {
        currentFactoryReset = {
            name: config.displayName,
            bin: config.factoryFile
        };

        log(`Lade Factory Reset für: ${currentFactoryReset.name}`);

        // Download factory reset file
        const factoryUrl = `${BASE_URL}/factory/${currentFactoryReset.bin}`;
        const loadedFactory = await loadFileFromUrl(factoryUrl);
        if (!loadedFactory) {
            log('Fehler beim Laden der Factory Reset Datei!');
            return;
        }
        factoryData = loadedFactory;
        remainingFactoryBytes = factoryData.length % 64;

        log(`Factory Reset geladen: ${factoryData.length} Bytes`);
        setStatus('Factory Reset geladen');

        // Update factory info display
        const factoryInfo = document.getElementById('factoryInfo') as HTMLElement | null;
        if (factoryInfo) {
            factoryInfo.textContent = `Automatisch basierend auf Größe: ${config.displayName}`;
        }

        // Enable factory upload button
        const uploadFactoryBtn = document.getElementById('uploadFactoryBtn') as HTMLButtonElement | null;
        if (uploadFactoryBtn) uploadFactoryBtn.disabled = false;
    } catch (e) {
        log('Fehler: ' + e);
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
            if (code in DEVICE_RESPONSES) {
                const msg = DEVICE_RESPONSES[code];
                log(msg);
                setStatus(msg);
            } else {
                setStatus(`${data[i].toString(16).padStart(2, '0').toUpperCase()} ${data[i + 1].toString(16).padStart(2, '0').toUpperCase()}`);
            }
        }
    }
    log('RX: ' + Array.from(data).map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' '));
}



// Load selected file from input (downloads both loader and XC file)
async function loadSelectedFile(): Promise<void> {
    // Set progress bar to idle state
    updateProgress(0);
    
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
        currentLoaderType = getSelectedSize();

        log(`Ausgewählte Datei: ${currentFileInfo.name || currentFileInfo.bin}`);
        log(`Loader-Typ: ${currentLoaderType}`);

        const config = deviceConfig[currentLoaderType];
        if (!config) {
            log(`Unbekannter Loader-Typ: ${currentLoaderType}`);
            return;
        }

        updateFileInfo(`Loader: ${currentLoaderType} | Datei: ${currentFileInfo.bin}`);

        // Download loader from example.com
        log('Lade Loader...');
        const loaderUrl = `${BASE_URL}/loader/${config.loaderFile}`;
        const loadedLoader = await loadFileFromUrl(loaderUrl);
        if (!loadedLoader) {
            log('Fehler beim Laden des Loaders!');
            return;
        }
        loaderData = loadedLoader;
        remainingLoaderBytes = loaderData.length % 64;
        log(`Loader geladen: ${loaderData.length} Bytes`);

        // Download factory reset file from BASE_URL if available
        if (config.factoryFile) {
            log('Lade Factory Reset...');
            currentFactoryReset = {
                name: config.displayName,
                bin: config.factoryFile
            };
            const factoryUrl = `${BASE_URL}/factory/${currentFactoryReset.bin}`;
            const loadedFactory = await loadFileFromUrl(factoryUrl);
            if (loadedFactory) {
                factoryData = loadedFactory;
                remainingFactoryBytes = factoryData.length % 64;
                log(`Factory Reset geladen: ${factoryData.length} Bytes`);

                // Update factory info display if it exists
                const factoryInfo = document.getElementById('factoryInfo') as HTMLElement | null;
                if (factoryInfo) {
                    factoryInfo.textContent = `Automatisch basierend auf Größe: ${config.displayName}`;
                }

                // Enable factory upload button
                const uploadFactoryBtn = document.getElementById('uploadFactoryBtn') as HTMLButtonElement | null;
                if (uploadFactoryBtn) uploadFactoryBtn.disabled = false;
            } else {
                log('Warnung: Factory Reset konnte nicht geladen werden.');
            }
        }

        // Download XC file from example.com
        log('Lade XC-Datei...');
        const category = currentFileInfo.subdir || config.compatibleFiles[0];
        const xcUrl = `${BASE_URL}/xc/${category}/${currentFileInfo.bin}`;
        const loadedXc = await loadFileFromUrl(xcUrl);
        if (!loadedXc) {
            log('Fehler beim Laden der XC-Datei!');
            return;
        }
        xcData = loadedXc;
        remainingXcBytes = xcData.length % 64;

        // Dump XC file info
        const xcInfo = dumpXcInfo(xcData);
        if (xcInfo) {
            // Set isFastDB based on dbtype (Group B types are fast, Group A are slow)
            const isGroupA = DB_GROUP_A.has(xcInfo.dbtype);
            const isGroupB = DB_GROUP_B.has(xcInfo.dbtype);

            if (isGroupB) {
                isFastDB = true;
            } else if (isGroupA) {
                isFastDB = false;
            } else {
                isFastDB = false;
                console.warn(`Unbekannter DB Typ: ${xcInfo.dbtype}`);
            }

            log(`XC-Datei geladen: ${xcData.length} Bytes`);
            logXcInfo(xcInfo);
            log(`Gruppe: ${isGroupA ? 'A (langsam)' : 'B (schnell)'}`);
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



// Reusable function to load a custom file from user's computer
async function loadCustomFile(accept: string, onLoad: (file: File, data: Uint8Array) => void): Promise<void> {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;

    input.onchange = async (event: Event) => {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (!file) return;

        try {
            const arrayBuffer = await file.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            onLoad(file, data);
        } catch (e) {
            log('Fehler beim Laden der Datei: ' + e);
        }
    };

    input.click();
}

// Load custom factory reset file from user's computer
async function loadCustomFactoryFile(): Promise<void> {
    // Set progress bar to idle state
    updateProgress(0);
    
    await loadCustomFile('.xc,.Xc,.XC,.bin', (file, data) => {
        log(`Lade Factory Reset Datei: ${file.name}`);
        factoryData = data;
        remainingFactoryBytes = factoryData.length % 64;

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
    });
}

// Upload factory reset file to device
async function uploadFactory(progressOffset: number = 0, totalMax?: number): Promise<boolean> {
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
        updateProgress(progressOffset, totalMax ?? factoryTotal);

        // Send upload header first
        const head = commandBuffer.slice(8, 24);
        const buffer = new Uint8Array(24);
        buffer.set(head, 0);
        await writePort(port, buffer, 2);

        // Upload first 256 bytes
        for (let i = 0; i < 256; i++) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writePort(port, new Uint8Array([factoryData[i]]), 0);
            updateProgress(progressOffset + i);
        }

        await new Promise(resolve => setTimeout(resolve, 25));

        let num = 256;
        while (num < factoryTotal - remainingFactoryBytes) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writePort(port, factoryData.slice(num, num + 64), 0);
            updateProgress(progressOffset + num);
            num += 64;
        }

        if (remainingFactoryBytes > 0) {
            await writePort(port, factoryData.slice(num, num + remainingFactoryBytes), 0);
        }
        updateProgress(progressOffset + num + remainingFactoryBytes);

        log('Factory Reset Upload fertig...!');
        setStatus('Factory Reset hochgeladen');

        return true;
    } catch (e) {
        log('Factory Reset Upload Fehler: ' + e);
        return false;
    }
}

// Upload loader to device
async function uploadLoader(progressOffset: number = 0, totalMax?: number): Promise<boolean> {
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
        updateProgress(progressOffset, totalMax ?? total);
        stopUpload = false;

        let num = 0;
        while (num < total - remainingLoaderBytes) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writePort(port, loaderData.slice(num, num + 64), 0);
            updateProgress(progressOffset + num);
            num += 64;
        }

        if (remainingLoaderBytes > 0) {
            await writePort(port, loaderData.slice(num, num + remainingLoaderBytes), 0);
        }
        updateProgress(progressOffset + num + remainingLoaderBytes);

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

// Get the selected date from DOM (year from number input, current date/time otherwise)
function getSelectedDate(): Date {
    const yearInput = document.getElementById('yearSelect') as HTMLInputElement | null;
    const selectedYear = yearInput ? parseInt(yearInput.value, 10) : new Date().getFullYear();

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

        await writePort(port, numArray, 2);

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
async function uploadXc(progressOffset: number = 0, totalMax?: number): Promise<boolean> {
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
        await writePort(port, buffer, 2);

        const total = xcData.length;
        updateProgress(progressOffset, totalMax ?? total);
        stopUpload = false;

        // Upload first 256 bytes
        for (let i = 0; i < 256; i++) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writePort(port, new Uint8Array([xcData[i]]), 0);
            updateProgress(progressOffset + i);
        }

        await new Promise(resolve => setTimeout(resolve, 25));

        // Switch to higher baud rate for fast DB
        if (isFastDB && port) {
            await port.close();
            await port.open({ baudRate: 115200 });
            readLoop(port, handleIncoming);
        }

        let num = 256;
        while (num < total - remainingXcBytes) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writePort(port, xcData.slice(num, num + 64), 0);
            updateProgress(progressOffset + num);
            num += 64;
        }

        if (remainingXcBytes > 0) {
            await writePort(port, xcData.slice(num, num + remainingXcBytes), 0);
        }
        updateProgress(progressOffset + num + remainingXcBytes);

        log('XC Upload fertig...!');
        setStatus('XC hochgeladen');

        // Restore baud rate if changed
        if (isFastDB && port) {
            await port.close();
            await port.open({ baudRate: 57600 });
            readLoop(port, handleIncoming);
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

    // Calculate total size for progress bar
    const totalSize = loaderData.length + (factoryData.length > 0 ? factoryData.length : 0) + xcData.length;
    let currentOffset = 0;

    // Step 1: Upload loader
    const loaderOk = await uploadLoader(currentOffset, totalSize);
    if (!loaderOk) {
        log('Flash-Vorgang abgebrochen: Loader fehlgeschlagen');
        return;
    }
    currentOffset += loaderData.length;

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
        const factoryOk = await uploadFactory(currentOffset, totalSize);
        if (!factoryOk) {
            log('Flash-Vorgang abgebrochen: Factory Reset fehlgeschlagen');
            return;
        }
        currentOffset += factoryData.length;
        // Wait for device to process factory reset
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Step 4: Upload XC file
    const xcOk = await uploadXc(currentOffset, totalSize);
    if (!xcOk) {
        log('Flash-Vorgang abgebrochen: XC Upload fehlgeschlagen');
        return;
    }

    log('Kompletter Flash-Vorgang abgeschlossen!');
    setStatus('Fertig!');
}

// Connect to serial port
async function connect(): Promise<void> {
    const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;

    try {
        if (port) {
            await port.close();
            port = null;

            if (connectBtn) {
                connectBtn.textContent = 'Verbinden';
                setButtonState(connectBtn, 'default');
            }

            // Disable kill button when disconnected
            const killBtn = document.getElementById('killBtn') as HTMLButtonElement | null;
            if (killBtn) killBtn.disabled = true;

            setStatus('Getrennt...');
            return;
        }

        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 57600 });

        readLoop(port, handleIncoming);

        if (connectBtn) {
            connectBtn.textContent = 'Trennen';
            setButtonState(connectBtn, 'success');
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
        if (connectBtn) setButtonState(connectBtn, 'failure');
    }
}



// Load custom XC file from user's computer
async function loadCustomXcFile(): Promise<void> {
    // Set progress bar to idle state
    updateProgress(0);
    
    await loadCustomFile('.xc,.Xc,.XC,.bin', async (file, data) => {
        log(`Lade Datei: ${file.name}`);

        // Check header
        if (data.length <= 0x100) {
            log('Datei zu klein für XC-Format!');
            return;
        }

        // Dump XC file info
        const xcInfo = dumpXcInfo(data);
        if (xcInfo) {
            // Set isFastDB based on dbtype (Group B types are fast, Group A are slow)
            const isGroupA = DB_GROUP_A.has(xcInfo.dbtype);
            const isGroupB = DB_GROUP_B.has(xcInfo.dbtype);

            if (isGroupB) {
                isFastDB = true;
            } else if (isGroupA) {
                isFastDB = false;
            } else {
                isFastDB = false;
                console.warn(`Unbekannter DB Typ: ${xcInfo.dbtype}`);
            }

            xcData = data;
            remainingXcBytes = xcData.length % 64;

            log(`XC-Datei geladen: ${xcData.length} Bytes`);
            logXcInfo(xcInfo);
            log(`Gruppe: ${isGroupA ? 'A (langsam)' : 'B (schnell)'}`);

            updateFileInfo(`Eigene Datei: ${file.name}`);
            setStatus('XC-Datei geladen');

            // Check if no loader or factory files have been loaded before
            if (loaderData.length === 0 || factoryData.length === 0) {
                const determinedConfig = determineDeviceConfig(xcInfo);
                if (determinedConfig && deviceConfig[determinedConfig]) {
                    log(`Bestimmte Gerätekonfiguration: ${determinedConfig}`);

                    const config = deviceConfig[determinedConfig];

                    // Load loader file if not already loaded
                    if (loaderData.length === 0) {
                        log('Lade passenden Loader...');
                        const loaderUrl = `${BASE_URL}/loader/${config.loaderFile}`;
                        const loadedLoader = await loadFileFromUrl(loaderUrl);
                        if (loadedLoader) {
                            loaderData = loadedLoader;
                            remainingLoaderBytes = loaderData.length % 64;
                            currentLoaderType = determinedConfig;
                            log(`Loader geladen: ${loaderData.length} Bytes`);

                            const loaderInfo = document.getElementById('loaderInfo') as HTMLElement | null;
                            if (loaderInfo) {
                                loaderInfo.textContent = `Automatisch basierend auf XC-Datei: ${config.displayName}`;
                            }
                        } else {
                            log('Fehler beim Laden des passenden Loaders!');
                        }
                    }

                    // Load factory reset file if not already loaded and available
                    if (factoryData.length === 0 && config.factoryFile) {
                        log('Lade passendes Factory Reset...');
                        const factoryUrl = `${BASE_URL}/factory/${config.factoryFile}`;
                        const loadedFactory = await loadFileFromUrl(factoryUrl);
                        if (loadedFactory) {
                            factoryData = loadedFactory;
                            remainingFactoryBytes = factoryData.length % 64;
                            currentFactoryReset = {
                                name: config.displayName,
                                bin: config.factoryFile
                            };
                            log(`Factory Reset geladen: ${factoryData.length} Bytes`);

                            const factoryInfo = document.getElementById('factoryInfo') as HTMLElement | null;
                            if (factoryInfo) {
                                factoryInfo.textContent = `Automatisch basierend auf XC-Datei: ${config.displayName}`;
                            }

                            // Enable factory upload button
                            const uploadFactoryBtn = document.getElementById('uploadFactoryBtn') as HTMLButtonElement | null;
                            if (uploadFactoryBtn) uploadFactoryBtn.disabled = false;
                        } else {
                            log('Fehler beim Laden des passenden Factory Resets!');
                        }
                    }

                    // Update the selected size radio button to match determined config
                    const radioBtn = document.querySelector(`input[name="size"][value="${determinedConfig}"]`) as HTMLInputElement | null;
                    if (radioBtn) {
                        radioBtn.checked = true;
                    // Also update the DB element class
                    const dbElement = document.getElementById('db');
                    if (dbElement) {
                        const sizeClasses = Object.keys(deviceConfig);
                        sizeClasses.forEach(cls => {
                            dbElement.classList.remove(`db-${cls}`);
                        });
                        dbElement.classList.add(`db-${determinedConfig}`);
                    }
                    }
                }
            }

            // Enable buttons
            const uploadLoaderBtn = document.getElementById('uploadLoaderBtn') as HTMLButtonElement | null;
            const fullFlashBtn = document.getElementById('fullFlashBtn') as HTMLButtonElement | null;

            if (uploadLoaderBtn) uploadLoaderBtn.disabled = false;
            if (fullFlashBtn) fullFlashBtn.disabled = false;
        } else {
            log('Header kaputt oder falscher Dateityp...!');
            // Still set xcData and try to dump info for analysis
            xcData = data;
            remainingXcBytes = xcData.length % 64;

            updateFileInfo(`Eigene Datei: ${file.name} (Header ungültig)`);
            setStatus('XC-Datei geladen (Warnung: Header ungültig)');

            // Enable buttons anyway - user may want to try uploading
            const uploadLoaderBtn = document.getElementById('uploadLoaderBtn') as HTMLButtonElement | null;
            const fullFlashBtn = document.getElementById('fullFlashBtn') as HTMLButtonElement | null;

            if (uploadLoaderBtn) uploadLoaderBtn.disabled = false;
            if (fullFlashBtn) fullFlashBtn.disabled = false;
        }
    });
}

// Load custom loader from user's computer
async function loadCustomLoaderFile(): Promise<void> {
    // Set progress bar to idle state
    updateProgress(0);
    
    await loadCustomFile('.xc,.Xc,.XC,.bin', (file, data) => {
        log(`Lade Loader: ${file.name}`);
        loaderData = data;
        remainingLoaderBytes = loaderData.length % 64;

        log(`Loader geladen: ${loaderData.length} Bytes`);
        setStatus('Loader geladen');

        const loaderInfo = document.getElementById('loaderInfo') as HTMLElement | null;
        if (loaderInfo) {
            loaderInfo.textContent = `Eigener Loader: ${file.name} (${loaderData.length} Bytes)`;
        }

        // Enable upload button
        const uploadLoaderBtn = document.getElementById('uploadLoaderBtn') as HTMLButtonElement | null;
        if (uploadLoaderBtn) uploadLoaderBtn.disabled = false;
    });
}

// Reset loader to default based on size selection
function resetLoader(): void {
    loaderData = new Uint8Array();
    remainingLoaderBytes = 0;

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

    commandBuffer = convertHexStringToByteArray(KILL_COMMAND_HEX);

    try {
        await writePort(port, commandBuffer, 2);
        log('Kill-Befehl gesendet.');
        setStatus('Kill-Befehl gesendet');
    } catch (e) {
        log('Fehler beim Senden des Kill-Befehls: ' + e);
    }
}

// Populate size selector from deviceConfig
function populateSizeSelector(): void {
    const sizeSelector = document.getElementById('sizeSelector') as HTMLDivElement | null;
    if (!sizeSelector) return;

    sizeSelector.innerHTML = '';

    Object.entries(deviceConfig).forEach(([deviceId, config]) => {
        const label = document.createElement('label');
        label.classList = 'btn btn-outline-light';
        label.htmlFor = `size${deviceId}`;
        const radio = document.createElement('input');
        radio.id = `size${deviceId}`;
        radio.type = 'radio';
        radio.classList = 'btn-check';
        radio.name = 'size';
        radio.value = deviceId;
        if (deviceId === '31415900') {
            radio.checked = true;
        }

        label.appendChild(document.createTextNode(config.displayName));
        sizeSelector.appendChild(radio);
        sizeSelector.appendChild(label);
    });
}

// Initialize year input with current year
function initializeYearInput(): void {
    const yearInput = document.getElementById('yearSelect') as HTMLInputElement | null;
    if (!yearInput) return;

    const currentYear = new Date().getFullYear();
    yearInput.value = currentYear.toString();
    yearInput.min = '1990';
    yearInput.max = '2050';
}

// Initialize event listeners
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Clear log area
        clearLog();

        // Populate size selector from deviceConfig
        populateSizeSelector();

        // Initialize year input
        initializeYearInput();

        // Populate file selects from imported mappings
        populateFileSelect();

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
        document.getElementById('resetFactoryBtn')?.addEventListener('click', loadFactoryResetFile);
        document.getElementById('loadCustomFactoryBtn')?.addEventListener('click', loadCustomFactoryFile);
        document.getElementById('uploadFactoryBtn')?.addEventListener('click', () => uploadFactory());

        // Action buttons
        document.getElementById('uploadLoaderBtn')?.addEventListener('click', () => uploadLoader());
        document.getElementById('setTimeBtn')?.addEventListener('click', setTimeFromDOM);
        document.getElementById('uploadXcBtn')?.addEventListener('click', () => uploadXc());
        document.getElementById('fullFlashBtn')?.addEventListener('click', fullFlash);
        document.getElementById('killBtn')?.addEventListener('click', sendKillCommand);



        // Function to change db element class to match selected size
        function changeDbSizeClass(selectedSize: string): void {
            const dbElement = document.getElementById('db');
            if (dbElement) {
                // Remove all existing size classes
                const sizeClasses = Object.keys(deviceConfig);
                sizeClasses.forEach(cls => {
                    dbElement.classList.remove(`db-${cls}`);
                });
                // Add new size class with "db-" prefix to make it valid CSS
                dbElement.classList.add(`db-${selectedSize}`);
            }
        }

        // Size radio buttons - update file dropdown when size changes
        const sizeSelector = document.getElementById('sizeSelector');
        if (sizeSelector) {
            sizeSelector.addEventListener('change', (e) => {
                if (e.target && (e.target as HTMLInputElement).name === 'size') {
                    const selectedSize = (e.target as HTMLInputElement).value;
                    populateFileSelect();
                    // Clear file info when size changes
                    updateFileInfo('_');
                    // Change db element class to match selected size
                    changeDbSizeClass(selectedSize);
                }
            });
        }
    });
}

export { };

