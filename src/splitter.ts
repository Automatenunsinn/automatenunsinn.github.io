function downloadFile(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: "application/octet-stream" });
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
    alert("Please select both high and low ROM files.");
    return;
  }

  const [highBuf, lowBuf] = await Promise.all([highFile.arrayBuffer(), lowFile.arrayBuffer()]);
  const high = new Uint8Array(highBuf);
  const low = new Uint8Array(lowBuf);

  if (high.length !== low.length) {
    alert("High and low ROMs must be the same size.");
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
    alert("Please select a 16-bit ROM file.");
    return;
  }

  const buf = await fullFile.arrayBuffer();
  const full = new Uint8Array(buf);

  if (full.length % 2 !== 0) {
    alert("16-bit ROM size must be even.");
    return;
  }

  const halfLen = full.length / 2;
  const high = new Uint8Array(halfLen);
  const low = new Uint8Array(halfLen);

  for (let i = 0; i < halfLen; i++) {
    high[i] = full[i * 2];
    low[i] = full[i * 2 + 1];
  }

  downloadFile(high, "high_byte_rom.bin");
  downloadFile(low, "low_byte_rom.bin");
}

(window as any).mergeROMs = mergeROMs;
(window as any).splitROM = splitROM;
