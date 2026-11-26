import { delay } from './utils/async.js';
import abCheck from './abCheck.js';
import { dumpXcInfo } from './xcfunctions.js';
import { assembleChunks, readWithTimeout } from './utils/serial.js';
import { downloadUint8Array, setButtonState, setValidationState, setElementText } from './utils/ui.js';
const sizeRadios = document.getElementsByName('size');
const speedRadios = document.getElementsByName('speed');
const speedOrder = ['GETPGM', 'GETPGF', 'GETPGU', 'GETPGH'];
const sizeToMaxSpeedIndex = {
    524288: 0,
    1048576: 1,
    2097152: 2,
    4194304: 3
};
function updateSpeedButtons() {
    const selectedSize = parseInt(document.querySelector('input[name="size"]:checked').value);
    const maxSpeedIndex = sizeToMaxSpeedIndex[selectedSize] ?? 0;
    // enable/disable speed radios and update their label appearance (btn outline class + disabled state)
    speedRadios.forEach(radio => {
        const r = radio;
        const speedIndex = speedOrder.indexOf(r.value);
        const shouldDisable = speedIndex > maxSpeedIndex;
        r.disabled = shouldDisable;
        // Update the label associated with this radio (Bootstrap btn-check + label pattern)
        if (r.id) {
            const lbl = document.querySelector(`label[for="${r.id}"]`);
            if (lbl instanceof HTMLElement) {
                // remove both outline classes and set correct one
                lbl.classList.remove('btn-outline-light', 'btn-outline-secondary', 'disabled');
                if (shouldDisable) {
                    lbl.classList.add('btn-outline-secondary', 'disabled');
                }
                else {
                    lbl.classList.add('btn-outline-light');
                }
            }
        }
    });
    // If the currently selected speed is now disabled, pick the first enabled speed
    const current = document.querySelector('input[name="speed"]:checked');
    if (current && current.disabled) {
        for (let i = 0; i < speedRadios.length; i++) {
            const r = speedRadios[i];
            if (!r.disabled) {
                r.checked = true;
                break;
            }
        }
    }
}
sizeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const selectedSize = parseInt(radio.value);
        document.getElementById('progressBar').max = selectedSize;
        updateSpeedButtons();
    });
});
updateSpeedButtons();
// add emoji indicators to the size labels (keeps UI hint similar to previous design)
try {
    const sizeEmojiMap = {
        'size512': '🟥 512KB',
        'size1m': '🟨 1MB',
        'size2m': '🟦 2MB',
        'size4m': '🔲 4MB'
    };
    Object.keys(sizeEmojiMap).forEach(id => {
        const lbl = document.querySelector(`label[for="${id}"]`);
        if (lbl)
            lbl.textContent = sizeEmojiMap[id];
    });
}
catch (e) {
    // ignore failures on older browsers
}
function fillFields(receivedData, calculateHashes = true) {
    const xcInfo = dumpXcInfo(receivedData, calculateHashes);
    if (xcInfo) {
        setElementText('copyrightField', xcInfo.copyright);
        setElementText('nameField', xcInfo.name);
        setElementText('versionField', xcInfo.version);
        setElementText('dateField', xcInfo.date);
        setElementText('gameTypeField', xcInfo.gameType);
        if (calculateHashes) {
            setElementText('md5Field', xcInfo.md5);
            setElementText('crc32Field', xcInfo.crc32);
        }
        const sizeEl = document.getElementById('expectedSizeField');
        if (sizeEl) {
            sizeEl.textContent = xcInfo.expectedSize.toString() + " Bytes";
            if (xcInfo.size == xcInfo.expectedSize) {
                setValidationState(sizeEl, true);
            }
            else {
                setValidationState(sizeEl, false);
                console.log("Size mismatch: " + xcInfo.size + " vs " + xcInfo.expectedSize);
            }
        }
    }
}
if (typeof window !== 'undefined') {
    let receivedData = new Uint8Array();
    let fillFieldsCalled = false;
    let port = null;
    const readData = async () => {
        if (!port || !port.readable)
            return;
        const reader = port.readable.getReader();
        let stop = !abCheck();
        const chunks = [];
        let totalLength = 0;
        let consecutiveCount = 0;
        let lastByte = 0;
        let readoutProtected = false;
        let protectedByte = 0;
        try {
            while (!stop) {
                const result = await readWithTimeout(reader);
                if (result.done)
                    break;
                const chunk = result.value;
                chunks.push(chunk);
                for (let i = 0; i < chunk.length; i++) {
                    if (totalLength + i >= 0x100) {
                        if (chunk[i] === lastByte) {
                            consecutiveCount++;
                        }
                        else {
                            consecutiveCount = 1;
                            lastByte = chunk[i];
                        }
                        if (consecutiveCount > 0x100) {
                            readoutProtected = true;
                            protectedByte = lastByte;
                            break;
                        }
                    }
                }
                if (readoutProtected)
                    break;
                totalLength += chunk.length;
                document.getElementById('progressBar').value = totalLength;
                if (!fillFieldsCalled && totalLength > 0x100) {
                    const initialData = assembleChunks(chunks, totalLength);
                    fillFields(initialData, false);
                    fillFieldsCalled = true;
                }
            }
            if (!readoutProtected) {
                receivedData = assembleChunks(chunks, totalLength);
                fillFields(receivedData, true);
            }
            else {
                console.warn("Readout protection detected: module returns >0x100 consecutive 0x" + protectedByte.toString(16).toUpperCase().padStart(2, "0") + " bytes after header.");
                setButtonState(document.getElementById('sendBtn'), 'failure');
                document.getElementById('downloadBtn').disabled = true;
            }
        }
        catch (error) {
            setButtonState(document.getElementById('sendBtn'), 'failure');
        }
        finally {
            reader.releaseLock();
        }
        document.getElementById('sendBtn').disabled = false;
        if (!readoutProtected) {
            setButtonState(document.getElementById('sendBtn'), 'success');
            document.getElementById('downloadBtn').disabled = false;
        }
    };
    document.getElementById('connectBtn').addEventListener('click', async () => {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            document.getElementById('connectBtn').disabled = true;
            setButtonState(document.getElementById('connectBtn'), 'success');
            document.getElementById('sendBtn').disabled = !abCheck();
        }
        catch (error) {
            setButtonState(document.getElementById('connectBtn'), 'failure');
        }
    });
    document.getElementById('sendBtn').addEventListener('click', async () => {
        if (!port || !port.writable)
            return;
        document.getElementById('sendBtn').disabled = true;
        const speed = document.querySelector('input[name="speed"]:checked').value;
        const writer = port.writable.getWriter();
        await writer.write(new Uint8Array([0x1B]));
        await delay(25);
        const command = 'X' + speed + '\n';
        await writer.write(new TextEncoder().encode(command));
        writer.releaseLock();
        await port.close();
        await port.open({ baudRate: 19200 });
        readData();
    });
    document.getElementById('downloadBtn').addEventListener('click', () => {
        downloadUint8Array(receivedData, 'data.Xc');
    });
    document.getElementById('loadFileBtn').addEventListener('click', () => {
        document.getElementById('fileInput').click();
    });
    document.getElementById('fileInput').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            fillFields(new Uint8Array(arrayBuffer), true);
        }
    });
}
