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
    const progress = document.getElementById('progressBar') as HTMLElement | null;
    if (progress) {
        if (progress instanceof HTMLProgressElement) {
            if (max !== undefined) {
                progress.max = max;
            } else if (!progress.hasAttribute('max')) {
                progress.max = 100;
            }
            progress.value = value;
        } else {
            // Assume Bootstrap progress bar
            let currentMax = parseFloat(progress.getAttribute('aria-valuemax') || '100');
            if (max !== undefined) {
                currentMax = max;
                progress.setAttribute('aria-valuemax', max.toString());
            }
            
            const percentage = currentMax > 0 ? Math.round((value / currentMax) * 100) : 0;
            progress.style.width = `${percentage}%`;
            progress.setAttribute('aria-valuenow', value.toString());
            progress.textContent = `${percentage}%`;
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

export function setValidationState(el: HTMLElement | null, valid: boolean): void {
    if (!el) return;
    
    // Ensure the element has the form-control class required by Bootstrap 5
    if (!el.classList.contains('form-control')) {
        el.classList.add('form-control');
    }
    
    el.classList.remove('is-valid', 'is-invalid');
    el.classList.add(valid ? 'is-valid' : 'is-invalid');
}

export function clearValidationState(el: HTMLElement | null): void {
    if (!el) return;
    el.classList.remove('is-valid', 'is-invalid');
}

export function setButtonState(button: HTMLElement | null, state: 'default' | 'success' | 'failure'): void {
    if (!button) return;
    button.classList.remove('btn-primary', 'btn-success', 'btn-danger');
    button.classList.add('btn');
    if (state === 'success') {
        button.classList.add('btn-success');
    } else if (state === 'failure') {
        button.classList.add('btn-danger');
    } else {
        button.classList.add('btn-primary');
    }
}

export function setProgressState(progress: HTMLElement | null, error: boolean): void {
    if (!progress) return;
    progress.classList.remove('bg-success', 'bg-danger');
    progress.classList.add(error ? 'bg-danger' : 'bg-success');
}
