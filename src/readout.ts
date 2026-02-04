import CryptoJS from 'crypto-js';
import MD5 from 'crypto-js/md5';
import { crc32 } from 'crc';
import { Buffer } from 'buffer';
import abCheck from './abCheck';
import { parseDate } from './xcfunctions';

let port: any = null;
let receivedData: Uint8Array = new Uint8Array();

// Size selector handling
const sizeRadios = document.getElementsByName('size') as NodeListOf<HTMLInputElement>;
sizeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
        const selectedSize = parseInt(radio.value);
        (document.getElementById('progressBar') as HTMLProgressElement).max = selectedSize;
    });
});

function fillFields(): void {
    if (receivedData.length >= 150) {
        const decoder = new TextDecoder();
        (document.getElementById('copyrightField') as HTMLInputElement).value = decoder.decode(receivedData.slice(0x19, 0x40));
        (document.getElementById('nameField') as HTMLInputElement).value = decoder.decode(receivedData.slice(0x60, 0x74));
        (document.getElementById('versionField') as HTMLInputElement).value = decoder.decode(receivedData.slice(0x75, 0x78));

        let date: Date | null = null;
        for (let i = 0x7d; i <= 0x99; i++) {
            const slice = receivedData.slice(i, i + 6);
            const str = decoder.decode(slice);
            date = parseDate(str);
            if (date) break;
        }
        if (date) {
            (document.getElementById('dateField') as HTMLInputElement).value = date.toISOString().slice(0, 10);
        } else {
            (document.getElementById('dateField') as HTMLInputElement).value = '';
        }

        // Suche Spielart: "-Spiel" von 0x84 bis 0x96
        const gameTypeData = receivedData.slice(0x84, 0x96);
        const gameTypeStr = decoder.decode(gameTypeData);
        const spielIndex = gameTypeStr.indexOf('-Spiel');
        if (spielIndex !== -1 && spielIndex >= 4) {
            (document.getElementById('gameTypeField') as HTMLInputElement).value = gameTypeStr.substring(spielIndex - 4, spielIndex + 6);
        } else {
            (document.getElementById('gameTypeField') as HTMLInputElement).value = '';
        }

        const md5 = MD5(CryptoJS.lib.WordArray.create(receivedData)).toString();
        (document.getElementById('md5Field') as HTMLInputElement).value = md5;
        const hash = crc32(Buffer.from(receivedData));
        (document.getElementById('crc32Field') as HTMLInputElement).value = hash.toString(16).padStart(8, '0');
    }
}

if (typeof window !== 'undefined') {
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
            }
            fillFields();
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
        const writer = port.writable!.getWriter();
        await writer.write(new Uint8Array([0x1B]));
        await new Promise(resolve => setTimeout(resolve, 25));
        const command = 'XGETPGM\n';
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
            receivedData = new Uint8Array(arrayBuffer);
            fillFields();
        }
    });
}