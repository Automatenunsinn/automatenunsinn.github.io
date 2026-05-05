import abCheck from './abCheck';
import { dumpXcInfo } from './xcfunctions';
import { SerialPort } from './types/webserial';
import { assembleChunks, readWithTimeout } from './utils/serial';
import { downloadUint8Array } from './utils/ui';

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

    speedRadios.forEach(radio => {
        const speedIndex = speedOrder.indexOf(radio.value);
        radio.disabled = speedIndex > maxSpeedIndex;
    });
}

sizeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const selectedSize = parseInt(radio.value);
        (document.getElementById('progressBar') as HTMLProgressElement).max = selectedSize;
        updateSpeedButtons();
    });
});

updateSpeedButtons();

function fillFields(receivedData: Uint8Array, calculateHashes: boolean = true): void {
    const xcInfo = dumpXcInfo(receivedData, calculateHashes);
    if (xcInfo) {
        (document.getElementById('copyrightField') as HTMLInputElement).value = xcInfo.copyright;
        (document.getElementById('nameField') as HTMLInputElement).value = xcInfo.name;
        (document.getElementById('versionField') as HTMLInputElement).value = xcInfo.version;
        (document.getElementById('dateField') as HTMLInputElement).value = xcInfo.date;
        (document.getElementById('gameTypeField') as HTMLInputElement).value = xcInfo.gameType;

        if (calculateHashes) {
            (document.getElementById('md5Field') as HTMLInputElement).value = xcInfo.md5;
            (document.getElementById('crc32Field') as HTMLInputElement).value = xcInfo.crc32;
        }

        const sizeCheckField = document.getElementById('expectedSizeField') as HTMLInputElement;
        sizeCheckField.value = xcInfo.expectedSize.toString() + " Bytes";
        if (xcInfo.size == xcInfo.expectedSize) {
            sizeCheckField.className = "success";
        } else {
            sizeCheckField.className = "failure";
            console.log("Size mismatch: " + xcInfo.size + " vs " + xcInfo.expectedSize);
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
                (document.getElementById('sendBtn') as HTMLButtonElement).className = "failure";
                (document.getElementById('downloadBtn') as HTMLButtonElement).disabled = true;
            }
        } catch (error) {
            (document.getElementById('sendBtn') as HTMLButtonElement).className = "failure";
        } finally {
            reader.releaseLock();
        }
        (document.getElementById('sendBtn') as HTMLButtonElement).disabled = false;
        if (!readoutProtected) {
            (document.getElementById('sendBtn') as HTMLButtonElement).className = "success";
            (document.getElementById('downloadBtn') as HTMLButtonElement).disabled = false;
        }
    };

    document.getElementById('connectBtn')!.addEventListener('click', async () => {
        try {
            port = await navigator.serial.requestPort();
            await port.open({ baudRate: 9600 });
            (document.getElementById('connectBtn') as HTMLButtonElement).disabled = true;
            (document.getElementById('connectBtn') as HTMLButtonElement).className = "success";
            (document.getElementById('sendBtn') as HTMLButtonElement).disabled = !abCheck();
        } catch (error: any) {
            (document.getElementById('connectBtn') as HTMLButtonElement).className = "failure";
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
