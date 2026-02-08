function searchString(uint8Array: Uint8Array, searchString: string): number {
  const searchStringBytes = new TextEncoder().encode(searchString);
  
  if (searchStringBytes.length === 0) return -1;

  for (let i = 0; i <= uint8Array.length - searchStringBytes.length; i++) {
    let match = true;
    for (let j = 0; j < searchStringBytes.length; j++) {
      if (uint8Array[i + j] !== searchStringBytes[j]) {
        match = false;
        break;
      }
    }
    if (match) return i;
  }

  return -1;
}

function downloadFile(data: Uint8Array, filename: string) {
  const arrayBuffer = data.slice().buffer;
  const blob = new Blob([arrayBuffer], { type: "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function mergeROMs() {
  const highFile = (document.getElementById("highRom") as HTMLInputElement).files?.[0];
  const lowFile = (document.getElementById("lowRom") as HTMLInputElement).files?.[0];

  if (!highFile || !lowFile) {
    alert("Es werden 2 Dateien benötigt.");
    return;
  }

  const [highBuf, lowBuf] = await Promise.all([highFile.arrayBuffer(), lowFile.arrayBuffer()]);
  const high = new Uint8Array(highBuf);
  const low = new Uint8Array(lowBuf);

  if (high.length !== low.length) {
    alert("Die Dateien müssen die gleiche Größe haben.");
    return;
  }

  const merged = new Uint8Array(high.length * 2);
  for (let i = 0; i < high.length; i++) {
    merged[i * 2] = high[i];       // High byte
    merged[i * 2 + 1] = low[i];    // Low byte
  }

  downloadFile(merged, "merged_16bit_rom.bin");
}

async function splitROM() {
  const fullFile = (document.getElementById("fullRom") as HTMLInputElement).files?.[0];
  if (!fullFile) {
    alert("Bitte eine 16-bit ROM Datei auswählen.");
    return;
  }

  const buf = await fullFile.arrayBuffer();
  const full = new Uint8Array(buf);

  if (full.length % 2 !== 0) {
    alert("Die Dateigröße muss gerade sein.");
    return;
  }

  const halfLen = full.length / 2;
  const high = new Uint8Array(halfLen);
  const low = new Uint8Array(halfLen);

  for (let i = 0; i < halfLen; i++) {
    high[i] = full[i * 2];
    low[i] = full[i * 2 + 1];
  }

  downloadFile(high, "odd_rom.bin");
  downloadFile(low, "even_rom.bin");
}

(window as any).mergeROMs = mergeROMs;
(window as any).splitROM = splitROM;
