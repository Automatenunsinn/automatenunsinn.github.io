let port: any = null;
let receivedData: Uint8Array = new Uint8Array();

function fillFields(): void {
    if (receivedData.length >= 150) {
        const decoder = new TextDecoder();
        (document.getElementById('copyrightField') as HTMLInputElement).value = decoder.decode(receivedData.slice(0x19, 0x40));
        (document.getElementById('nameField') as HTMLInputElement).value = decoder.decode(receivedData.slice(0x60, 0x74));
        (document.getElementById('versionField') as HTMLInputElement).value = decoder.decode(receivedData.slice(0x75, 0x78));

        let dateStr = '';
        for (let i = 0x7d; i <= 0x99; i++) {
            const slice = receivedData.slice(i, i + 6);
            const str = decoder.decode(slice);
            if (/^\d{6}$/.test(str)) {
                dateStr = str;
                break;
            }
        }
        if (dateStr) {
            const yy = parseInt(dateStr.slice(0, 2));
            const mm = dateStr.slice(2, 4);
            const dd = dateStr.slice(4, 6);
            const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;
            (document.getElementById('dateField') as HTMLInputElement).value = `${yyyy}-${mm}-${dd}`;
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

        (document.getElementById('downloadBtn') as HTMLButtonElement).disabled = false;
    }
}

document.getElementById('connectBtn')!.addEventListener('click', async () => {
    try {
        port = await (navigator as any).serial.requestPort();
        await port.open({ baudRate: 9600 });
        (document.getElementById('sendBtn') as HTMLButtonElement).disabled = false;
        alert('Verbindung hergestellt');
    } catch (error: any) {
        alert('Fehler beim Verbinden: ' + error.message);
    }
});

document.getElementById('sendBtn')!.addEventListener('click', async () => {
    if (!port) return;
    const command = 'XGETPGM\n';
    const writer = port.writable!.getWriter();
    await writer.write(new TextEncoder().encode(command));
    writer.releaseLock();
    readData();
});

async function readData(): Promise<void> {
    if (!port) return;
    const reader = port.readable!.getReader();
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            receivedData = new Uint8Array([...receivedData, ...value]);
            if (receivedData.length >= 150) { // Genug Daten für alle Felder
                fillFields();
                break;
            }
        }
    } catch (error) {
        console.error('Fehler beim Lesen: ', error);
    } finally {
        reader.releaseLock();
    }
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