const Stk500 = require('stk500');
const intel_hex = require('intel-hex');
import abCheck from './abCheck';
import { log, setButtonState, updateProgress as setProgressValue } from './utils/ui';
import { 
    ATMEGA48_BOARD, 
    SerialPortWrapper, 
    uploadEeprom, 
    verifyEeprom,
    eraseChip
} from './stk500utils';

let port: any = null;
let eraser: boolean = true;
let hexData: Buffer | null = null;
let eepromData: Buffer | null = null;

function updateProgress(status: string, pct: number): void {
    setProgressValue(pct);
    log(`[${pct}%] ${status}`);
}

async function connect(): Promise<void> {
    try {
        port = await (navigator as any).serial.requestPort();
        log('Port ausgewählt.');
        const connectBtn = document.getElementById('connectBtn') as HTMLButtonElement | null;
        if (connectBtn) {
            connectBtn.textContent = 'Verbunden';
            setButtonState(connectBtn, 'success');
        }
        checkEnableFlash();
    } catch (err) {
        log('Fehler beim Verbinden: ' + err);
    }
}

function checkEnableFlash(): void {
    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn && (hexData || eepromData) && port && abCheck()) {
        flashBtn.disabled = false;
    } else if (flashBtn) {
        flashBtn.disabled = true;
    }
}

async function handleFileSelect(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        const buffer = await file.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        try {
            hexData = intel_hex.parse(text).data;
            log(`Flash-Datei geladen (HEX): ${file.name} (${hexData?.length} Bytes)`);
        } catch (e) {
            hexData = Buffer.from(buffer);
            log(`Flash-Datei geladen (Binär): ${file.name} (${hexData.length} Bytes)`);
        }
        checkEnableFlash();
    } catch (err) {
        log('Fehler beim Lesen der Flash-Datei: ' + err);
    }
}

async function handleEepromFileSelect(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
        const buffer = await file.arrayBuffer();
        const text = new TextDecoder().decode(buffer);
        try {
            eepromData = intel_hex.parse(text).data;
            log(`EEPROM-Datei geladen (HEX): ${file.name} (${eepromData?.length} Bytes)`);
        } catch (e) {
            eepromData = Buffer.from(buffer);
            log(`EEPROM-Datei geladen (Binär): ${file.name} (${eepromData.length} Bytes)`);
        }
        checkEnableFlash();
    } catch (err) {
        log('Fehler beim Lesen der EEPROM-Datei: ' + err);
    }
}

async function flash(): Promise<void> {
    if (!hexData && !eepromData) return;
    if (!port) return;

    const flashBtn = document.getElementById('flashBtn') as HTMLButtonElement | null;
    if (flashBtn) {
        flashBtn.disabled = true;
        setButtonState(flashBtn, 'default');
    }
    const wrapper = new SerialPortWrapper(port);
    try {
        log('Öffne Port und initialisiere...');
        await port.open({ baudRate: ATMEGA48_BOARD.baudRate });
        await new Promise(res => setTimeout(res, 2000));
        wrapper.startReading();

        const stk = new Stk500();
        stk.log = () => {};

        await new Promise<void>((res, rej) => stk.sync(wrapper, 3, 2000, (err: any) => err ? rej(err) : res()));

        const parameters = {
            devicecode: 0x41, parmode: 0x01, polling: 0x01, selftimed: 0x01,
            lockbytes: 1, fusebytes: 3, flashpollval1: 0xff, flashpollval2: 0xff,
            eeprompollval1: 0xff, eeprompollval2: 0xff,
            pagesizehigh: (ATMEGA48_BOARD.pageSize >> 8) & 0xff,
            pagesizelow: ATMEGA48_BOARD.pageSize & 0xff,
            eepromsizehigh: (ATMEGA48_BOARD.eepromSize >> 8) & 0xff,
            eepromsizelow: ATMEGA48_BOARD.eepromSize & 0xff,
            flashsize2: (ATMEGA48_BOARD.flashSize >> 8) & 0xff,
            flashsize1: ATMEGA48_BOARD.flashSize & 0xff
        };

        await new Promise<void>((res, rej) => stk.setOptions(wrapper, parameters, 2000, (err: any) => err ? rej(err) : res()));
        await new Promise<void>((res, rej) => stk.enterProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
        await new Promise<void>((res, rej) => stk.verifySignature(wrapper, ATMEGA48_BOARD.signature, 2000, (err: any) => err ? rej(err) : res()));

        if (eraser) {
            await eraseChip(wrapper);
        }

        if (hexData) {
            updateProgress('Flash wird beschrieben...', 10);
            await new Promise<void>((res, rej) => stk.upload(wrapper, hexData, ATMEGA48_BOARD.pageSize, 10000, (err: any) => err ? rej(err) : res()));
            updateProgress('Flash wird verifiziert...', 50);
            await new Promise<void>((res, rej) => stk.verify(wrapper, hexData, ATMEGA48_BOARD.pageSize, 10000, (err: any) => err ? rej(err) : res()));
        }

        if (eepromData) {
            updateProgress('EEPROM wird beschrieben...', 70);
            await uploadEeprom(wrapper, stk, eepromData, updateProgress);
            updateProgress('EEPROM wird verifiziert...', 90);
            await verifyEeprom(wrapper, stk, eepromData);
        }

        await new Promise<void>((res, rej) => stk.exitProgrammingMode(wrapper, 2000, (err: any) => err ? rej(err) : res()));
        updateProgress('Erfolgreich abgeschlossen!', 100);
        if (flashBtn) setButtonState(flashBtn, 'success');
    } catch (err: any) {
        log('FEHLER: ' + err.message);
        if (flashBtn) setButtonState(flashBtn, 'failure');
    } finally {
        await wrapper.close();
        if (flashBtn) flashBtn.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('connectBtn')?.addEventListener('click', connect);
    document.getElementById('hexFile')?.addEventListener('change', handleFileSelect);
    document.getElementById('eepromFile')?.addEventListener('change', handleEepromFileSelect);
    document.getElementById('flashBtn')?.addEventListener('click', flash);
    checkEnableFlash();
});
