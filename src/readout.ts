import abCheck from './abCheck';
import { dumpXcInfo } from './xcfunctions';
import { SerialPort } from './types/webserial';
import { assembleChunks, readWithTimeout } from './utils/serial';
import { downloadUint8Array, setButtonState, setValidationState, setElementText } from './utils/ui';

const sizeRadios = document.getElementsByName('size') as NodeListOf<HTMLInputElement>;
const speedRadios = document.getElementsByName('speed') as NodeListOf<HTMLInputElement>;

const speedOrder = ['GETPGM', 'GETPGF', 'GETPGU', 'GETPGH'];

const sizeToMaxSpeedIndex: Record<number, number> = {
    524288: 0,
    1048576: 1,
    2097152: 2,
    4194304: 3
};

function updateSpeedButtons(): void {
    const selectedSize = parseInt((document.querySelector('input[name="size"]:checked') as HTMLInputElement).value);
    const maxSpeedIndex = sizeToMaxSpeedIndex[selectedSize] ?? 0;

    // enable/disable speed radios and update their label appearance (btn outline class + disabled state)
    speedRadios.forEach(radio => {
        const r = radio as HTMLInputElement;
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
                } else {
                    lbl.classList.add('btn-outline-light');
                }
            }
        }
    });

    // If the currently selected speed is now disabled, pick the first enabled speed
    const current = document.querySelector('input[name="speed"]:checked') as HTMLInputElement | null;
    if (current && current.disabled) {
        for (let i = 0; i < speedRadios.length; i++) {
            const r = speedRadios[i] as HTMLInputElement;
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
        (document.getElementById('progressBar') as HTMLProgressElement).max = selectedSize;
        updateSpeedButtons();
    });
});

updateSpeedButtons();

// add emoji indicators to the size labels (keeps UI hint similar to previous design)
try {
    const sizeEmojiMap: Record<string, string> = {
        'size512': '🟥 512KB',
        'size1m': '🟨 1MB',
        'size2m': '🟦 2MB',
        'size4m': '🔲 4MB'
    };
    Object.keys(sizeEmojiMap).forEach(id => {
        const lbl = document.querySelector(`label[for="${id}"]`);
        if (lbl) lbl.textContent = sizeEmojiMap[id];
    });
} catch (e) {
    // ignore failures on older browsers
}

function fillFields(receivedData: Uint8Array, calculateHashes: boolean = true): void {
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
            } else {
                setValidationState(sizeEl, false);
                console.log("Size mismatch: " + xcInfo.size + " vs " + xcInfo.expectedSize);
            }
        }
    }
}

if (typeof window !== 'undefined') {
    let receivedData: Uint8Array = new Uint8Array();
    let fillFieldsCalled: boolean = false;
    let port: SerialPort | null = null;

    const readData = async (): Promise<void> => {
        if (!port || !port.readable) return;
        const reader = port.readable.getReader();
        let stop = !abCheck();

        const chunks: Uint8Array[] = [];
        let totalLength = 0;
        let consecutiveCount = 0;
        let lastByte: number = 0;
        let readoutProtected = false;
        let protectedByte: number = 0;

        try {
            while (!stop) {
                const result = await readWithTimeout(reader);
                if (result.done) break;

                const chunk = result.value!;
                chunks.push(chunk);

                for (let i = 0; i < chunk.length; i++) {
                    if (totalLength + i >= 0x100) {
                        if (chunk[i] === lastByte) {
                            consecutiveCount++;
                        } else {
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
                if (readoutProtected) break;

                totalLength += chunk.length;

                (document.getElementById('progressBar') as HTMLProgressElement).value = totalLength;

                if (!fillFieldsCalled && totalLength > 0x100) {
                    const initialData = assembleChunks(chunks, totalLength);
                    fillFields(initialData, false);
                    fillFieldsCalled = true;
                }
            }

            if (!readoutProtected) {
                receivedData = assembleChunks(chunks, totalLength);
                fillFields(receivedData, true);
            } else {
                console.warn("Readout protection detected: module returns >0x100 consecutive 0x" + protectedByte.toString(16).toUpperCase().padStart(2, "0") + " bytes after header.");
                setButtonState(document.getElementById('sendBtn') as HTMLButtonElement | null, 'failure');
                (document.getElementById('downloadBtn') as HTMLButtonElement).disabled = true;
            }
        } catch (error) {
            setButtonState(document.getElementById('sendBtn') as HTMLButtonElement | null, 'failure');
        } finally {
            reader.releaseLock();
        }
        (document.getElementById('sendBtn') as HTMLButtonElement).disabled = false;
        if (!readoutProtected) {
            setButtonState(document.getElementById('sendBtn') as HTMLButtonElement | null, 'success');
            (document.getElementById('downloadBtn') as HTMLButtonElement).disabled = false;
        }
    };

    document.getElementById('connectBtn')!.addEventListener('click', async () => {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            (document.getElementById('connectBtn') as HTMLButtonElement).disabled = true;
            setButtonState(document.getElementById('connectBtn') as HTMLButtonElement | null, 'success');
            (document.getElementById('sendBtn') as HTMLButtonElement).disabled = !abCheck();
        } catch (error: any) {
            setButtonState(document.getElementById('connectBtn') as HTMLButtonElement | null, 'failure');
        }
    });

    document.getElementById('sendBtn')!.addEventListener('click', async () => {
        if (!port || !port.writable) return;
        (document.getElementById('sendBtn') as HTMLButtonElement).disabled = true;
        const speed = (document.querySelector('input[name="speed"]:checked') as HTMLInputElement).value;
        const writer = port.writable.getWriter();
        await writer.write(new Uint8Array([0x1B]));
        await new Promise(resolve => setTimeout(resolve, 25));
        const command = 'X'+speed+'\n';
        await writer.write(new TextEncoder().encode(command));
        writer.releaseLock();
        await port.close();
        await port.open({ baudRate: 19200 });
        readData();
    });

    document.getElementById('downloadBtn')!.addEventListener('click', () => {
        downloadUint8Array(receivedData, 'data.Xc');
    });

    document.getElementById('loadFileBtn')!.addEventListener('click', () => {
        (document.getElementById('fileInput') as HTMLInputElement).click();
    });

    document.getElementById('fileInput')!.addEventListener('change', async (event: any) => {
        const file = event.target.files[0];
        if (file) {
            const arrayBuffer = await file.arrayBuffer();
            fillFields(new Uint8Array(arrayBuffer), true);
        }
    });
}
