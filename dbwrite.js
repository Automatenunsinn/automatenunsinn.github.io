import { bytesToHex, toBcd } from './utils/binary.js';
import { delay } from './utils/async.js';
import { dumpXcInfo } from './xcfunctions.js';
import { BASE_URL, deviceConfig, fileMappings } from './fileMappings.js';
import { writePort, readLoop, loadFileFromUrl } from './utils/serial.js';
import { disableControls, log, clearLog, setStatus, updateProgress, updateFileInfo, setButtonState } from './utils/ui.js';
// Constants
const KILL_COMMAND_HEX = "7c6b696c6cfdc4551b53594e4353594e4357414954474f0a";
// Response codes from device
const DEVICE_RESPONSES = {
    0x31: "Zeit OK/Unbekannter Befehl",
    0x32: "Warte auf weitere Daten.",
    0x33: "Datei OK, wird gestartet.",
    0x34: "Initialisierung der Daten abgeschlossen."
};
// DB Type Groups (Group B = fast DB, Group A = slow DB)
export const DB_GROUP_A = new Set([0x31415902, 0x31415926, 0x61647002, 0x61647003]);
export const DB_GROUP_B = new Set([0x61640302, 0x61640403, 0x61640404, 0x61640504, 0x61640604]);
// State variables
let commandBuffer = convertHexStringToByteArray(KILL_COMMAND_HEX);
let loaderData = new Uint8Array();
let xcData = new Uint8Array();
let factoryData = new Uint8Array();
let remainingLoaderBytes = 0;
let remainingXcBytes = 0;
let remainingFactoryBytes = 0;
let isFastDB = false;
let stopUpload = false;
let currentLoaderType = '31415900';
let currentFileInfo = null;
let currentFactoryReset = null;
// Serial port
let port = null;
let flashing = false;
// Serial status replies can be split across reads (or arrive before the
// upload function starts waiting), so keep a small protocol buffer/queue.
let rxPending = new Uint8Array();
const responseQueue = [];
const responseWaiters = [];
function waitForDeviceResponse(expected, timeoutMs = 5000) {
    const queued = expected === null ? responseQueue.shift() : responseQueue.indexOf(expected);
    if (queued !== undefined && queued !== -1) {
        if (expected !== null)
            responseQueue.splice(queued, 1);
        return Promise.resolve(expected === null ? queued : expected);
    }
    return new Promise(resolve => {
        const timer = setTimeout(() => {
            const index = responseWaiters.findIndex(waiter => waiter.timer === timer);
            if (index >= 0)
                responseWaiters.splice(index, 1);
            resolve(null);
        }, timeoutMs);
        responseWaiters.push({ expected, resolve, timer });
    });
}
function notifyDeviceResponse(code) {
    const waiterIndex = responseWaiters.findIndex(waiter => waiter.expected === null || waiter.expected === code);
    if (waiterIndex >= 0) {
        const waiter = responseWaiters.splice(waiterIndex, 1)[0];
        clearTimeout(waiter.timer);
        waiter.resolve(code);
    }
    else {
        responseQueue.push(code);
        // Avoid retaining stale replies indefinitely.
        if (responseQueue.length > 16)
            responseQueue.shift();
    }
}
async function waitForStepResponse(expected, description) {
    // Ignore unrelated queued replies (for example the loader's 1B32) and
    // wait specifically for this step's response.
    const received = await waitForDeviceResponse(expected, 15000);
    if (received === null) {
        log(`${description}: keine Antwort innerhalb von 15 Sekunden.`);
        return false;
    }
    else {
        // The status byte is emitted before the board has finished applying
        // the image. Keep the port idle for the full processing window before
        // beginning another protocol step/transfer.
        await delay(5000);
        return received === expected;
    }
}
// WebSerial exposes baud rate only when opening a port.  Keep the reader
// running after each reopen and allow the USB UART/device a moment to settle.
async function changeBaudRate(baudRate) {
    if (!port)
        return;
    const signalPort = port;
    try {
        if (signalPort.setSignals) {
            await signalPort.setSignals({ dataTerminalReady: false, requestToSend: false });
        }
    }
    catch (_) { /* optional WebSerial feature */ }
    await port.close();
    await port.open({ baudRate });
    try {
        if (signalPort.setSignals) {
            await signalPort.setSignals({ dataTerminalReady: false, requestToSend: false });
        }
    }
    catch (_) { /* optional WebSerial feature */ }
    readLoop(port, handleIncoming);
    // Let the adapter settle before sending at the new rate.
    await delay(150);
}
function convertHexStringToByteArray(hexString) {
    if (hexString.length % 2 !== 0) {
        throw new Error(`Der Binärschlüssel muss gerade sein: ${hexString}`);
    }
    const bytes = new Uint8Array(hexString.length / 2);
    for (let i = 0; i < hexString.length; i += 2) {
        bytes[i / 2] = parseInt(hexString.substring(i, i + 2), 16);
    }
    return bytes;
}
function determineDeviceConfig(info) {
    return info.dbtype.toString(16).padStart(8, '0');
}
// Log XC info to the log area
function logXcInfo(info) {
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
function getSelectedSize() {
    const checkedRadio = document.querySelector('input[name="size"]:checked');
    return checkedRadio?.value || '31415900';
}
// Populate file select dropdown based on selected size
function populateFileSelect() {
    const datalist = document.getElementById('fileList');
    if (!datalist || !fileMappings)
        return;
    const selectedSize = getSelectedSize();
    const config = deviceConfig[selectedSize];
    datalist.innerHTML = '';
    if (!config)
        return;
    // Store file entries for lookup
    const fileEntries = new Map();
    // Loader type is determined by the selected module size
    const loaderType = selectedSize;
    // Get compatible files for this device type
    for (const category of config.compatibleFiles) {
        const files = fileMappings[category];
        if (!files || files.length === 0)
            continue;
        for (const file of files) {
            const option = document.createElement('option');
            const entry = {
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
    window.fileEntries = fileEntries;
}
// Load factory reset file based on selected size
async function loadFactoryResetFile() {
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
        if (flashing)
            return;
        if (!loadedFactory) {
            log('Fehler beim Laden der Factory Reset Datei!');
            return;
        }
        factoryData = loadedFactory;
        remainingFactoryBytes = factoryData.length % 64;
        log(`Factory Reset geladen: ${factoryData.length} Bytes`);
        setStatus('Factory Reset geladen');
        // Update factory info display
        const factoryInfo = document.getElementById('factoryInfo');
        if (factoryInfo) {
            factoryInfo.textContent = `Automatisch basierend auf Größe: ${config.displayName}`;
        }
        // Enable factory upload button
        const uploadFactoryBtn = document.getElementById('uploadFactoryBtn');
        if (uploadFactoryBtn)
            uploadFactoryBtn.disabled = false;
    }
    catch (e) {
        log('Fehler: ' + e);
    }
}
// Handle incoming data
function handleIncoming(data) {
    console.log('Incoming data:', data);
    // Ignore filler bytes, then parse status pairs across arbitrary read chunks.
    const filtered = data.filter(byte => byte !== 0xFF);
    if (filtered.length === 0)
        return;
    const combined = new Uint8Array(rxPending.length + filtered.length);
    combined.set(rxPending);
    combined.set(filtered, rxPending.length);
    rxPending = combined;
    let offset = 0;
    while (offset + 1 < rxPending.length) {
        if (rxPending[offset] !== 0x1B) {
            offset++;
            continue;
        }
        const code = rxPending[offset + 1];
        notifyDeviceResponse(code);
        if (code in DEVICE_RESPONSES) {
            const msg = "Datenbank meldet: " + DEVICE_RESPONSES[code];
            log(msg);
            setStatus(msg);
        }
        else {
            setStatus(`1B ${code.toString(16).padStart(2, '0').toUpperCase()}`);
        }
        offset += 2;
    }
    rxPending = rxPending.slice(offset);
    console.debug('RX: ' + bytesToHex(data, ' ').toUpperCase());
}
// Load selected file from input (downloads both loader and XC file)
async function loadSelectedFile() {
    // Set progress bar to idle state
    updateProgress(0);
    const input = document.getElementById('fileSelect');
    if (!input)
        return;
    const selectedName = input.value.trim();
    if (!selectedName)
        return;
    // Look up the file entry from the stored map
    const fileEntries = window.fileEntries;
    if (!fileEntries || !fileEntries.has(selectedName)) {
        log('Datei nicht in der Liste gefunden: ' + selectedName);
        return;
    }
    try {
        currentFileInfo = fileEntries.get(selectedName);
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
        if (flashing)
            return;
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
            if (flashing)
                return;
            if (loadedFactory) {
                factoryData = loadedFactory;
                remainingFactoryBytes = factoryData.length % 64;
                log(`Factory Reset geladen: ${factoryData.length} Bytes`);
                // Update factory info display if it exists
                const factoryInfo = document.getElementById('factoryInfo');
                if (factoryInfo) {
                    factoryInfo.textContent = `Automatisch basierend auf Größe: ${config.displayName}`;
                }
                // Enable factory upload button
                const uploadFactoryBtn = document.getElementById('uploadFactoryBtn');
                if (uploadFactoryBtn)
                    uploadFactoryBtn.disabled = false;
            }
            else {
                log('Warnung: Factory Reset konnte nicht geladen werden.');
            }
        }
        // Download XC file from example.com
        log('Lade XC-Datei...');
        const category = currentFileInfo.subdir || config.compatibleFiles[0];
        const xcUrl = `${BASE_URL}/xc/${category}/${currentFileInfo.bin}`;
        const loadedXc = await loadFileFromUrl(xcUrl);
        if (flashing)
            return;
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
            }
            else if (isGroupA) {
                isFastDB = false;
            }
            else {
                isFastDB = false;
                console.warn(`Unbekannter DB Typ: ${xcInfo.dbtype}`);
            }
            log(`XC-Datei geladen: ${xcData.length} Bytes`);
            logXcInfo(xcInfo);
            log(`Gruppe: ${isGroupA ? 'A (langsam)' : 'B (schnell)'}`);
            setStatus('Dateien geladen');
            // Enable buttons
            const uploadLoaderBtn = document.getElementById('uploadLoaderBtn');
            const setTimeBtn = document.getElementById('setTimeBtn');
            const uploadXcBtn = document.getElementById('uploadXcBtn');
            const fullFlashBtn = document.getElementById('fullFlashBtn');
            if (uploadLoaderBtn)
                uploadLoaderBtn.disabled = false;
            if (fullFlashBtn)
                fullFlashBtn.disabled = false;
        }
        else {
            log('Header kaputt oder falscher Dateityp...!');
        }
    }
    catch (e) {
        log('Fehler: ' + e);
    }
}
// Reusable function to load a custom file from user's computer
async function loadCustomFile(accept, onLoad) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async (event) => {
        const file = event.target.files?.[0];
        if (!file)
            return;
        try {
            const arrayBuffer = await file.arrayBuffer();
            if (flashing)
                return;
            const data = new Uint8Array(arrayBuffer);
            onLoad(file, data);
        }
        catch (e) {
            log('Fehler beim Laden der Datei: ' + e);
        }
    };
    input.click();
}
// Load custom factory reset file from user's computer
async function loadCustomFactoryFile() {
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
        const factoryInfo = document.getElementById('factoryInfo');
        if (factoryInfo) {
            factoryInfo.textContent = `Eigene Datei: ${file.name} (${factoryData.length} Bytes)`;
        }
        // Enable factory upload button
        const uploadFactoryBtn = document.getElementById('uploadFactoryBtn');
        if (uploadFactoryBtn)
            uploadFactoryBtn.disabled = false;
    });
}
// Upload factory reset file to device
async function uploadFactory(progressOffset = 0, totalMax) {
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
        // The reference loader waits 100 ms before changing baud, allowing
        // the board to finish consuming the preamble and emit its status.
        await delay(100);
        if (isFastDB)
            await changeBaudRate(115200);
        let num = 256;
        while (num < factoryTotal - remainingFactoryBytes) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writePort(port, factoryData.slice(num, num + 64), 0);
            await delay(5);
            updateProgress(progressOffset + num);
            num += 64;
        }
        if (remainingFactoryBytes > 0) {
            await writePort(port, factoryData.slice(num, num + remainingFactoryBytes), 0);
        }
        updateProgress(progressOffset + num + remainingFactoryBytes);
        // Return to the response baud rate immediately after the final byte.
        if (isFastDB)
            await changeBaudRate(57600);
        await waitForStepResponse(0x33, 'Factory Reset');
        log('Factory Reset Upload fertig...!');
        setStatus('Factory Reset hochgeladen');
        return true;
    }
    catch (e) {
        log('Factory Reset Upload Fehler: ' + e);
        return false;
    }
}
// Upload loader to device
async function uploadLoader(progressOffset = 0, totalMax) {
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
        const setTimeBtn = document.getElementById('setTimeBtn');
        if (setTimeBtn)
            setTimeBtn.disabled = false;
        return true;
    }
    catch (e) {
        log('Loader Upload Fehler: ' + e);
        return false;
    }
}
// Get the selected date from DOM (year from number input, current date/time otherwise)
function getSelectedDate() {
    const yearInput = document.getElementById('yearSelect');
    const selectedYear = yearInput ? parseInt(yearInput.value, 10) : new Date().getFullYear();
    const now = new Date();
    // Use selected year but keep current month, day, and time
    return new Date(selectedYear, now.getMonth(), now.getDate(), now.getHours(), now.getMinutes(), now.getSeconds());
}
// Enable UI elements after time is set
function enableUiAfterTimeSet() {
    const uploadXcBtn = document.getElementById('uploadXcBtn');
    if (uploadXcBtn)
        uploadXcBtn.disabled = false;
}
// Set time on device
async function setTime(date) {
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
        numArray[16] = toBcd(date.getHours()) & 0xFF;
        numArray[17] = toBcd(date.getMinutes()) & 0xFF;
        numArray[18] = header2;
        numArray[19] = toBcd(date.getDate()) & 0xFF;
        numArray[20] = toBcd(date.getMonth() + 1) & 0xFF;
        numArray[21] = toBcd(yyyy) & 0xFF;
        numArray[22] = weekday;
        let s = 0;
        for (let i = 16; i < numArray.length - 1; i++) {
            s = (s + numArray[i]) & 0xFF;
        }
        numArray[23] = s;
        await writePort(port, numArray, 2);
        log(`Zeit gesetzt: ${date.toLocaleDateString('de-DE')} ${date.toLocaleTimeString('de-DE')}`);
        setStatus('Zeit gesetzt');
        await waitForStepResponse(0x31, 'Zeit setzen');
        return true;
    }
    catch (e) {
        log('Fehler beim Setzen der Zeit: ' + e);
        return false;
    }
}
// Set time from DOM (wrapper that gets date from UI and calls setTime)
async function setTimeFromDOM() {
    const date = getSelectedDate();
    const result = await setTime(date);
    if (result) {
        enableUiAfterTimeSet();
    }
    return result;
}
// Upload XC file to device
async function uploadXc(progressOffset = 0, totalMax) {
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
        await delay(20);
        if (isFastDB)
            await changeBaudRate(115200);
        let num = 256;
        while (num < total - remainingXcBytes) {
            if (stopUpload) {
                log('Upload abgebrochen...!');
                return false;
            }
            await writePort(port, xcData.slice(num, num + 64), 0);
            // Keep a short inter-block gap so the loader's polling loop and
            // USB-UART FIFO cannot overrun during long XC images.
            await delay(5);
            updateProgress(progressOffset + num);
            num += 64;
        }
        if (remainingXcBytes > 0) {
            await writePort(port, xcData.slice(num, num + remainingXcBytes), 0);
        }
        updateProgress(progressOffset + num + remainingXcBytes);
        // Return before waiting for the device's status/error response.
        if (isFastDB)
            await changeBaudRate(57600);
        log('XC Upload fertig...!');
        setStatus('XC hochgeladen');
        const ok = await waitForStepResponse(0x33, 'XC Upload');
        if (!ok) {
            log('XC Upload fehlgeschlagen: DB hat kein OK gemeldet.');
        }
        return ok;
    }
    catch (e) {
        log('XC Upload Fehler: ' + e);
        return false;
    }
}
async function runFlash(transfer) {
    if (flashing)
        return;
    flashing = true;
    const restoreFileControls = disableControls('#fileSelect, #sizeSelector input, #loadFileBtn, #loadCustomXcBtn, ' +
        '#loadCustomLoaderBtn, #resetLoaderBtn, #resetFactoryBtn, #loadCustomFactoryBtn');
    try {
        await transfer();
    }
    finally {
        flashing = false;
        restoreFileControls();
    }
}
// Full flash workflow: loader -> time -> [factory reset] -> xc
async function fullFlash() {
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
    // Step 3: Upload factory reset if selected
    if (factoryData.length > 0) {
        log('Uploade Factory Reset vor XC-Datei...');
        const factoryOk = await uploadFactory(currentOffset, totalSize);
        if (!factoryOk) {
            log('Flash-Vorgang abgebrochen: Factory Reset fehlgeschlagen');
            return;
        }
        currentOffset += factoryData.length;
        // The loader may still be transitioning back from its application
        // receive loop after acknowledging the factory image. Give it a
        // quiet interval before issuing the next upload command.
        await delay(5000);
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
async function connect() {
    const connectBtn = document.getElementById('connectBtn');
    try {
        if (port) {
            await port.close();
            port = null;
            if (connectBtn) {
                connectBtn.textContent = 'Verbinden';
                setButtonState(connectBtn, 'default');
            }
            // Disable kill button when disconnected
            const killBtn = document.getElementById('killBtn');
            if (killBtn)
                killBtn.disabled = true;
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
        const killBtn = document.getElementById('killBtn');
        if (killBtn)
            killBtn.disabled = false;
    }
    catch (error) {
        if (error instanceof DOMException && error.name === 'NotFoundError') {
            log('Kein Gerät ausgewählt.');
        }
        else {
            log(String(error));
        }
        if (connectBtn)
            setButtonState(connectBtn, 'failure');
    }
}
// Load custom XC file from user's computer
async function loadCustomXcFile() {
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
            }
            else if (isGroupA) {
                isFastDB = false;
            }
            else {
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
                        if (flashing)
                            return;
                        if (loadedLoader) {
                            loaderData = loadedLoader;
                            remainingLoaderBytes = loaderData.length % 64;
                            currentLoaderType = determinedConfig;
                            log(`Loader geladen: ${loaderData.length} Bytes`);
                            const loaderInfo = document.getElementById('loaderInfo');
                            if (loaderInfo) {
                                loaderInfo.textContent = `Automatisch basierend auf XC-Datei: ${config.displayName}`;
                            }
                        }
                        else {
                            log('Fehler beim Laden des passenden Loaders!');
                        }
                    }
                    // Load factory reset file if not already loaded and available
                    if (factoryData.length === 0 && config.factoryFile) {
                        log('Lade passendes Factory Reset...');
                        const factoryUrl = `${BASE_URL}/factory/${config.factoryFile}`;
                        const loadedFactory = await loadFileFromUrl(factoryUrl);
                        if (flashing)
                            return;
                        if (loadedFactory) {
                            factoryData = loadedFactory;
                            remainingFactoryBytes = factoryData.length % 64;
                            currentFactoryReset = {
                                name: config.displayName,
                                bin: config.factoryFile
                            };
                            log(`Factory Reset geladen: ${factoryData.length} Bytes`);
                            const factoryInfo = document.getElementById('factoryInfo');
                            if (factoryInfo) {
                                factoryInfo.textContent = `Automatisch basierend auf XC-Datei: ${config.displayName}`;
                            }
                            // Enable factory upload button
                            const uploadFactoryBtn = document.getElementById('uploadFactoryBtn');
                            if (uploadFactoryBtn)
                                uploadFactoryBtn.disabled = false;
                        }
                        else {
                            log('Fehler beim Laden des passenden Factory Resets!');
                        }
                    }
                    // Update the selected size radio button to match determined config
                    const radioBtn = document.querySelector(`input[name="size"][value="${determinedConfig}"]`);
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
            const uploadLoaderBtn = document.getElementById('uploadLoaderBtn');
            const fullFlashBtn = document.getElementById('fullFlashBtn');
            if (uploadLoaderBtn)
                uploadLoaderBtn.disabled = false;
            if (fullFlashBtn)
                fullFlashBtn.disabled = false;
        }
        else {
            log('Header kaputt oder falscher Dateityp...!');
            // Still set xcData and try to dump info for analysis
            xcData = data;
            remainingXcBytes = xcData.length % 64;
            updateFileInfo(`Eigene Datei: ${file.name} (Header ungültig)`);
            setStatus('XC-Datei geladen (Warnung: Header ungültig)');
            // Enable buttons anyway - user may want to try uploading
            const uploadLoaderBtn = document.getElementById('uploadLoaderBtn');
            const fullFlashBtn = document.getElementById('fullFlashBtn');
            if (uploadLoaderBtn)
                uploadLoaderBtn.disabled = false;
            if (fullFlashBtn)
                fullFlashBtn.disabled = false;
        }
    });
}
// Load custom loader from user's computer
async function loadCustomLoaderFile() {
    // Set progress bar to idle state
    updateProgress(0);
    await loadCustomFile('.xc,.Xc,.XC,.bin', (file, data) => {
        log(`Lade Loader: ${file.name}`);
        loaderData = data;
        remainingLoaderBytes = loaderData.length % 64;
        log(`Loader geladen: ${loaderData.length} Bytes`);
        setStatus('Loader geladen');
        const loaderInfo = document.getElementById('loaderInfo');
        if (loaderInfo) {
            loaderInfo.textContent = `Eigener Loader: ${file.name} (${loaderData.length} Bytes)`;
        }
        // Enable upload button
        const uploadLoaderBtn = document.getElementById('uploadLoaderBtn');
        if (uploadLoaderBtn)
            uploadLoaderBtn.disabled = false;
    });
}
// Reset loader to default based on size selection
function resetLoader() {
    loaderData = new Uint8Array();
    remainingLoaderBytes = 0;
    const loaderInfo = document.getElementById('loaderInfo');
    if (loaderInfo) {
        loaderInfo.textContent = 'Automatisch basierend auf Größe';
    }
    log('Loader zurückgesetzt.');
    setStatus('Loader zurückgesetzt');
}
// Send kill command to erase database
async function sendKillCommand() {
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
    }
    catch (e) {
        log('Fehler beim Senden des Kill-Befehls: ' + e);
    }
}
// Populate size selector from deviceConfig
function populateSizeSelector() {
    const sizeSelector = document.getElementById('sizeSelector');
    if (!sizeSelector)
        return;
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
function initializeYearInput() {
    const yearInput = document.getElementById('yearSelect');
    if (!yearInput)
        return;
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
        document.getElementById('uploadFactoryBtn')?.addEventListener('click', () => runFlash(uploadFactory));
        // Action buttons
        document.getElementById('uploadLoaderBtn')?.addEventListener('click', () => runFlash(uploadLoader));
        document.getElementById('setTimeBtn')?.addEventListener('click', setTimeFromDOM);
        document.getElementById('uploadXcBtn')?.addEventListener('click', () => runFlash(uploadXc));
        document.getElementById('fullFlashBtn')?.addEventListener('click', () => runFlash(fullFlash));
        document.getElementById('killBtn')?.addEventListener('click', sendKillCommand);
        // Function to change db element class to match selected size
        function changeDbSizeClass(selectedSize) {
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
                if (e.target && e.target.name === 'size') {
                    const selectedSize = e.target.value;
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
