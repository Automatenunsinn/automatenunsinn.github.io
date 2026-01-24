import CryptoJS from 'crypto-js';
import MD5 from 'crypto-js/md5';
import * as CRC32 from 'crc-32';

let port: any = null;
let receivedData: Uint8Array = new Uint8Array();

function parseDate(str: string): Date | null {
    if (!/^\d{6}$/.test(str)) return null;
    const yy = parseInt(str.slice(0, 2));
    const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;

    // Versuche YYMMDD
    let mm = parseInt(str.slice(2, 4));
    let dd = parseInt(str.slice(4, 6));
    let date = new Date(yyyy, mm - 1, dd);
    if (date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd) {
        return date;
    }

    // Versuche YYDDMM
    mm = parseInt(str.slice(4, 6));
    dd = parseInt(str.slice(2, 4));
    date = new Date(yyyy, mm - 1, dd);
    if (date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd) {
        return date;
    }

    return null;
}

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
        const crc32 = CRC32.buf(receivedData);
        (document.getElementById('crc32Field') as HTMLInputElement).value = (crc32 >>> 0).toString(16).padStart(8, '0');
    }
}

document.getElementById('connectBtn')!.addEventListener('click', async () => {
    try {
        port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 9600 });
        (document.getElementById('connectBtn') as HTMLButtonElement).disabled = true;
        (document.getElementById('connectBtn') as HTMLButtonElement).className = "success";
        (document.getElementById('sendBtn') as HTMLButtonElement).disabled = false;
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

async function readData(): Promise<void> {
    if (!port) return;
    const reader = port.readable!.getReader();
    let stop = false;
    const timeout = () => {
        stop = true;
    };
    let timeoutId = setTimeout(timeout, 1000);
    try {
        while (!stop) {
            const { value, done } = await reader.read();
            if (done) break;
            receivedData = new Uint8Array([...receivedData, ...value]);
            (document.getElementById('progressBar') as HTMLProgressElement).value = receivedData.length;
            clearTimeout(timeoutId);
            timeoutId = setTimeout(timeout, 1000);
        }
        fillFields();
    } catch (error) {
        (document.getElementById('sendBtn') as HTMLButtonElement).className = "failure";
    } finally {
        clearTimeout(timeoutId);
        reader.releaseLock();
    }
    (document.getElementById('sendBtn') as HTMLButtonElement).disabled = false;
    (document.getElementById('sendBtn') as HTMLButtonElement).className = "success";
    (document.getElementById('downloadBtn') as HTMLButtonElement).disabled = false;
}

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