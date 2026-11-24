import { swappedCopy } from './utils/binary';
import { downloadBlob } from './utils/ui';

function outputFilename(filename: string, change: string): string {
  const extensionIndex = filename.lastIndexOf('.');
  const hasExtension = extensionIndex > 0;
  const name = hasExtension ? filename.slice(0, extensionIndex) : filename;
  const extension = hasExtension ? filename.slice(extensionIndex) : '.bin';
  return `${name}_${change}${extension}`;
}

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

/** Return a copy with the bytes in each 16-bit word exchanged. */
export function swapBytes(data: Uint8Array): Uint8Array {
  if (data.length % 2 !== 0) {
    throw new Error("Die Dateigröße muss gerade sein.");
  }

  return swappedCopy(data);
}



function setFileError(id: string, message: string): void {
  const field = document.getElementById(id) as HTMLInputElement;
  const feedbackId = id + 'Feedback';
  const feedback = document.getElementById(feedbackId)!;
  field.classList.toggle('is-invalid', Boolean(message));
  field.setAttribute('aria-describedby', feedbackId);
  if (message) field.setAttribute('aria-invalid', 'true');
  else field.removeAttribute('aria-invalid');
  feedback.textContent = message;
}

async function mergeROMs() {
  setFileError('highRom', '');
  setFileError('lowRom', '');
  const highFile = (document.getElementById("highRom") as HTMLInputElement).files?.[0];
  const lowFile = (document.getElementById("lowRom") as HTMLInputElement).files?.[0];

  if (!highFile || !lowFile) {
    if (!highFile) setFileError('highRom', 'Bitte eine Odd ROM-Datei auswählen.');
    if (!lowFile) setFileError('lowRom', 'Bitte eine Even ROM-Datei auswählen.');
    return;
  }

  const [highBuf, lowBuf] = await Promise.all([highFile.arrayBuffer(), lowFile.arrayBuffer()]);
  const high = new Uint8Array(highBuf);
  const low = new Uint8Array(lowBuf);

  if (high.length !== low.length) {
    setFileError('highRom', 'Die Dateien müssen die gleiche Größe haben.');
    setFileError('lowRom', 'Die Dateien müssen die gleiche Größe haben.');
    return;
  }

  const merged = new Uint8Array(high.length * 2);
  for (let i = 0; i < high.length; i++) {
    merged[i * 2] = high[i];       // High byte
    merged[i * 2 + 1] = low[i];    // Low byte
  }

  downloadBlob(new Blob([merged.slice().buffer], { type: "application/octet-stream" }), outputFilename(highFile.name, "merged_16bit"));
}

async function splitROM() {
  setFileError('fullRom', '');
  const fullFile = (document.getElementById("fullRom") as HTMLInputElement).files?.[0];
  if (!fullFile) {
    setFileError('fullRom', 'Bitte eine 16-bit ROM Datei auswählen.');
    return;
  }

  const buf = await fullFile.arrayBuffer();
  const full = new Uint8Array(buf);

  if (full.length % 2 !== 0) {
    setFileError('fullRom', 'Die Dateigröße muss gerade sein.');
    return;
  }

  const halfLen = full.length / 2;
  const high = new Uint8Array(halfLen);
  const low = new Uint8Array(halfLen);

  for (let i = 0; i < halfLen; i++) {
    high[i] = full[i * 2];
    low[i] = full[i * 2 + 1];
  }

  downloadBlob(new Blob([high.slice().buffer], { type: "application/octet-stream" }), outputFilename(fullFile.name, "odd"));
  downloadBlob(new Blob([low.slice().buffer], { type: "application/octet-stream" }), outputFilename(fullFile.name, "even"));
}

async function byteSwapROM() {
  setFileError('byteswapRom', '');
  const input = (document.getElementById("byteswapRom") as HTMLInputElement).files?.[0];
  if (!input) {
    setFileError('byteswapRom', 'Bitte eine ROM-Datei auswählen.');
    return;
  }

  const data = new Uint8Array(await input.arrayBuffer());
  if (data.length % 2 !== 0) {
    setFileError('byteswapRom', 'Die Dateigröße muss gerade sein.');
    return;
  }

  const swapped = swapBytes(data);
  downloadBlob(
    new Blob([swapped.slice().buffer], { type: "application/octet-stream" }),
    outputFilename(input.name, "byteswapped")
  );
}

if (typeof document !== 'undefined') {
  document.addEventListener('change', event => {
    const field = event.target as HTMLInputElement;
    if (['highRom', 'lowRom'].includes(field.id)) {
      setFileError('highRom', '');
      setFileError('lowRom', '');
    } else if (['fullRom', 'byteswapRom'].includes(field.id)) {
      setFileError(field.id, '');
    }
  });
}

if (typeof window !== 'undefined') {
  (window as any).mergeROMs = mergeROMs;
  (window as any).splitROM = splitROM;
  (window as any).byteSwapROM = byteSwapROM;
}
