import { delay } from './utils/async.js';
import Stk500 from 'stk500';
import intel_hex from 'intel-hex';
import buffer from 'buffer';
import abCheck from './abCheck.js';
import { disableControls, log, setButtonState, updateProgress as setProgressValue } from './utils/ui.js';
import { ATMEGA48_BOARD, SerialPortWrapper, uploadEeprom, verifyEeprom, eraseChip, verifyDeviceSignature } from './stk500utils.js';
const { Buffer } = buffer;
let port = null;
let eraser = true;
const images = {
    Flash: null,
    EEPROM: null
};
let flashing = false;
function updateProgress(status, pct) {
    setProgressValue(pct);
    log(`[${pct}%] ${status}`);
}
async function connect() {
    try {
        port = await navigator.serial.requestPort();
        log('Port ausgewählt.');
        const connectBtn = document.getElementById('connectBtn');
        if (connectBtn) {
            connectBtn.textContent = 'Verbunden';
            setButtonState(connectBtn, 'success');
        }
        checkEnableFlash();
    }
    catch (err) {
        log('Fehler beim Verbinden: ' + err);
    }
}
function canFlash() {
    return !flashing && Boolean(port) && abCheck()
        && images.Flash !== undefined && images.EEPROM !== undefined
        && Boolean(images.Flash || images.EEPROM);
}
function checkEnableFlash() {
    const flashBtn = document.getElementById('flashBtn');
    if (flashBtn)
        flashBtn.disabled = !canFlash();
}
async function loadImage(event, kind) {
    const input = event.target;
    const file = input.files?.[0];
    // A selected image must finish loading successfully before the chip can be erased.
    images[kind] = file ? undefined : null;
    checkEnableFlash();
    if (!file)
        return;
    const isHex = /\.hex$/i.test(file.name);
    try {
        const buffer = await file.arrayBuffer();
        if (input.files?.[0] !== file)
            return;
        const data = isHex
            ? intel_hex.parse(new TextDecoder().decode(buffer)).data
            : Buffer.from(buffer);
        images[kind] = data;
        log(`${kind}-Datei geladen (${isHex ? 'HEX' : 'Binär'}): ${file.name} (${data.length} Bytes)`);
    }
    catch (err) {
        if (input.files?.[0] === file) {
            log(`Fehler beim Laden der ${kind}-Datei ${file.name}: ${err}`);
        }
    }
    finally {
        checkEnableFlash();
    }
}
async function flash() {
    if (!canFlash())
        return;
    const { Flash: hexData, EEPROM: eepromData } = images;
    flashing = true;
    const restoreFileControls = disableControls('#hexFile, #eepromFile');
    checkEnableFlash();
    const flashBtn = document.getElementById('flashBtn');
    setButtonState(flashBtn, 'default');
    const wrapper = new SerialPortWrapper(port);
    try {
        log('Öffne Port und initialisiere...');
        await port.open({ baudRate: ATMEGA48_BOARD.baudRate });
        await delay(2000);
        wrapper.startReading();
        const stk = new Stk500();
        stk.log = () => { };
        await new Promise((res, rej) => stk.sync(wrapper, 3, 2000, (err) => err ? rej(err) : res()));
        const parameters = {
            devicecode: 0x59, parmode: 0x01, polling: 0x01, selftimed: 0x01,
            lockbytes: 1, fusebytes: 3, flashpollval1: 0xff, flashpollval2: 0xff,
            eeprompollval1: 0xff, eeprompollval2: 0xff,
            pagesizehigh: (ATMEGA48_BOARD.pageSize >> 8) & 0xff,
            pagesizelow: ATMEGA48_BOARD.pageSize & 0xff,
            eepromsizehigh: (ATMEGA48_BOARD.eepromSize >> 8) & 0xff,
            eepromsizelow: ATMEGA48_BOARD.eepromSize & 0xff,
            flashsize2: (ATMEGA48_BOARD.flashSize >> 8) & 0xff,
            flashsize1: ATMEGA48_BOARD.flashSize & 0xff
        };
        await new Promise((res, rej) => stk.setOptions(wrapper, parameters, 2000, (err) => err ? rej(err) : res()));
        await new Promise((res, rej) => stk.enterProgrammingMode(wrapper, 2000, (err) => err ? rej(err) : res()));
        await verifyDeviceSignature(wrapper, ATMEGA48_BOARD.signature);
        if (eraser) {
            await eraseChip(wrapper);
            await new Promise((res, rej) => stk.exitProgrammingMode(wrapper, 2000, (err) => err ? rej(err) : res()));
            await new Promise((res, rej) => stk.enterProgrammingMode(wrapper, 2000, (err) => err ? rej(err) : res()));
        }
        if (hexData) {
            updateProgress('Flash wird beschrieben...', 10);
            await new Promise((res, rej) => stk.upload(wrapper, hexData, ATMEGA48_BOARD.pageSize, 10000, (err) => err ? rej(err) : res()));
            updateProgress('Flash wird verifiziert...', 50);
            await new Promise((res, rej) => stk.verify(wrapper, hexData, ATMEGA48_BOARD.pageSize, 10000, (err) => err ? rej(err) : res()));
        }
        if (eepromData) {
            updateProgress('EEPROM wird beschrieben...', 70);
            await uploadEeprom(wrapper, stk, eepromData, updateProgress);
            updateProgress('EEPROM wird verifiziert...', 90);
            await verifyEeprom(wrapper, stk, eepromData);
        }
        await new Promise((res, rej) => stk.exitProgrammingMode(wrapper, 2000, (err) => err ? rej(err) : res()));
        updateProgress('Erfolgreich abgeschlossen!', 100);
        if (flashBtn)
            setButtonState(flashBtn, 'success');
    }
    catch (err) {
        log('FEHLER: ' + err.message);
        if (flashBtn)
            setButtonState(flashBtn, 'failure');
    }
    finally {
        try {
            await wrapper.close();
        }
        finally {
            restoreFileControls();
            flashing = false;
            checkEnableFlash();
        }
    }
}
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('connectBtn')?.addEventListener('click', connect);
    document.getElementById('hexFile')?.addEventListener('change', event => loadImage(event, 'Flash'));
    document.getElementById('eepromFile')?.addEventListener('change', event => loadImage(event, 'EEPROM'));
    document.getElementById('flashBtn')?.addEventListener('click', flash);
    checkEnableFlash();
});
