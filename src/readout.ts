import abCheck from './abCheck';
import { dumpXcInfo } from './xcfunctions';

// Size selector handling
const sizeRadios = document.getElementsByName('size') as NodeListOf<HTMLInputElement>;
const speedRadios = document.getElementsByName('speed') as NodeListOf<HTMLInputElement>;

// Speed order: GETPGM(1x) < GETPGF(3x) < GETPGU(6x) < GETPGH(12x)
const speedOrder = ['GETPGM', 'GETPGF', 'GETPGU', 'GETPGH'];

// Size to max speed index mapping
const sizeToMaxSpeedIndex: Record<number, number> = {
    524288: 0,    // 512KB 1x
    1048576: 1,   // 1MB   3x
    2097152: 2,   // 2MB   6x
    4194304: 3    // 4MB   12x
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

// Initialize speed button states
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
    }
}

if (typeof window !== 'undefined') {
    let receivedData: Uint8Array = new Uint8Array();
    let fillFieldsCalled: boolean = false;
    let port: any = null;

    const readData = async (): Promise<void> => {
        if (!port) return;
        const reader = port.readable!.getReader();
        let stop = !abCheck();
        
        // Helper function to read with timeout
        const readWithTimeout = async (): Promise<{ value?: Uint8Array; done?: boolean }> => {
            return Promise.race([
                reader.read(),
                new Promise<{ done: true }>((_, reject) => {
                    setTimeout(() => reject(new Error('Timeout')), 5000);
                })
            ]);
        };
        try {
            while (!stop) {
                const result = await readWithTimeout();
                if (result.done) break;
                receivedData = new Uint8Array([...receivedData, ...result.value!]);
                (document.getElementById('progressBar') as HTMLProgressElement).value = receivedData.length;
                if (!fillFieldsCalled && receivedData.length > 0x100) {
                    fillFields(receivedData, false);
                    fillFieldsCalled = true;
                }
            }
            fillFields(receivedData, true);
        } catch (error) {
            (document.getElementById('sendBtn') as HTMLButtonElement).className = "failure";
        } finally {
            reader.releaseLock();
        }
        (document.getElementById('sendBtn') as HTMLButtonElement).disabled = false;
        (document.getElementById('sendBtn') as HTMLButtonElement).className = "success";
        (document.getElementById('downloadBtn') as HTMLButtonElement).disabled = false;
    };

    document.getElementById('connectBtn')!.addEventListener('click', async () => {
        try {
            port = await (navigator as any).serial.requestPort();
            await port.open({ baudRate: 9600 });
            (document.getElementById('connectBtn') as HTMLButtonElement).disabled = true;
            (document.getElementById('connectBtn') as HTMLButtonElement).className = "success";
            (document.getElementById('sendBtn') as HTMLButtonElement).disabled = !abCheck();
        } catch (error: any) {
            (document.getElementById('connectBtn') as HTMLButtonElement).className = "failure";
        }
    });

    document.getElementById('sendBtn')!.addEventListener('click', async () => {
        if (!port) return;
        (document.getElementById('sendBtn') as HTMLButtonElement).disabled = true;
        const speed = (document.querySelector('input[name="speed"]:checked') as HTMLInputElement).value;
        const writer = port.writable!.getWriter();
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
    const blob = new Blob([receivedData as any], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.Xc';
    a.click();
    URL.revokeObjectURL(url);
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