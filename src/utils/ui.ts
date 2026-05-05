let logBuffer: string[] = [];

export function log(msg: string): void {
    const logArea = document.getElementById('logArea') as HTMLTextAreaElement | null;
    if (logArea) {
        logArea.value += msg + '\n';
        logArea.scrollTop = logArea.scrollHeight;
    }
    console.log(msg);
}

export function logWithBuffer(text: string): void {
    const line = `[${new Date().toISOString().substring(11, 19)}] ${text}`;
    logBuffer.push(line);
    const logArea = document.getElementById('logArea') as HTMLTextAreaElement | null;
    if (logArea) {
        logArea.value = logBuffer.join('\n');
        logArea.scrollTop = logArea.scrollHeight;
    }
}

export function clearLog(): void {
    logBuffer = [];
    const logArea = document.getElementById('logArea') as HTMLTextAreaElement | null;
    if (logArea) {
        logArea.value = '';
    }
}

export function setStatus(msg: string): void {
    console.log('Status:', msg);
}

export function updateProgress(value: number, max?: number): void {
    const progress = document.getElementById('progressBar') as HTMLProgressElement | null;
    if (progress) {
        if (max !== undefined) {
            progress.max = max;
        }
        if (value === 0 && progress.max === 100) {
            progress.value = 0;
        } else {
            progress.value = value;
        }
    }
}

export function updateFileInfo(info: string): void {
    const fileInfoEl = document.getElementById('fileInfo') as HTMLElement | null;
    if (fileInfoEl) {
        fileInfoEl.textContent = info;
    }
}

export function downloadBlob(data: Blob, filename: string): void {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

export function downloadUint8Array(data: Uint8Array, filename: string, type: string = 'application/octet-stream'): void {
    downloadBlob(new Blob([data.buffer as ArrayBuffer], { type }), filename);
}

export function getInputValue(id: string): string {
    return (document.getElementById(id) as HTMLInputElement)?.value?.trim() ?? '';
}

export function setInputValue(id: string, value: string): void {
    const el = document.getElementById(id) as HTMLInputElement | null;
    if (el) el.value = value;
}

export function setElementText(id: string, text: string): void {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
