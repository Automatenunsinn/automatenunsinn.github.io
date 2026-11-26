let logBuffer = [];
export function log(msg) {
    const logArea = document.getElementById('logArea');
    if (logArea) {
        logArea.value += msg + '\n';
        logArea.scrollTop = logArea.scrollHeight;
    }
    console.log(msg);
}
export function logWithBuffer(text) {
    const line = `[${new Date().toISOString().substring(11, 19)}] ${text}`;
    logBuffer.push(line);
    const logArea = document.getElementById('logArea');
    if (logArea) {
        logArea.value = logBuffer.join('\n');
        logArea.scrollTop = logArea.scrollHeight;
    }
}
export function clearLog() {
    logBuffer = [];
    const logArea = document.getElementById('logArea');
    if (logArea) {
        logArea.value = '';
    }
}
export function setStatus(msg) {
    console.log('Status:', msg);
}
export function updateProgress(value, max) {
    const progress = document.getElementById('progressBar');
    if (progress) {
        if (progress instanceof HTMLProgressElement) {
            if (max !== undefined) {
                progress.max = max;
            }
            else if (!progress.hasAttribute('max')) {
                progress.max = 100;
            }
            progress.value = value;
        }
        else {
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
export function updateFileInfo(info) {
    const fileInfoEl = document.getElementById('fileInfo');
    if (fileInfoEl) {
        fileInfoEl.textContent = info;
    }
}
export function downloadBlob(data, filename) {
    const url = URL.createObjectURL(data);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}
export function downloadUint8Array(data, filename, type = 'application/octet-stream') {
    downloadBlob(new Blob([data.buffer], { type }), filename);
}
export function getInputValue(id) {
    return document.getElementById(id)?.value?.trim() ?? '';
}
export function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (el)
        el.value = value;
}
export function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el)
        el.textContent = text;
}
export function setValidationState(el, valid) {
    if (!el)
        return;
    // Ensure the element has the form-control class required by Bootstrap 5
    if (!el.classList.contains('form-control')) {
        el.classList.add('form-control');
    }
    el.classList.remove('is-valid', 'is-invalid');
    el.classList.add(valid ? 'is-valid' : 'is-invalid');
}
export function clearValidationState(el) {
    if (!el)
        return;
    el.classList.remove('is-valid', 'is-invalid');
}
export function setButtonState(button, state) {
    if (!button)
        return;
    button.classList.remove('btn-primary', 'btn-success', 'btn-danger');
    button.classList.add('btn');
    if (state === 'success') {
        button.classList.add('btn-success');
    }
    else if (state === 'failure') {
        button.classList.add('btn-danger');
    }
    else {
        button.classList.add('btn-primary');
    }
}
export function setProgressState(progress, error) {
    if (!progress)
        return;
    progress.classList.remove('bg-success', 'bg-danger');
    progress.classList.add(error ? 'bg-danger' : 'bg-success');
}
export function disableControls(selector) {
    const controls = document.querySelectorAll(selector);
    const enabled = Array.from(controls).filter(control => !control.disabled);
    enabled.forEach(control => { control.disabled = true; });
    return () => {
        enabled.forEach(control => { control.disabled = false; });
    };
}
export function setupNvramEditor({ patch, suffix, validateSize, sizeError, populateFields, onLoadStart }) {
    let loadedImage = null;
    let loadedName = '';
    let loadVersion = 0;
    function loadTkFile() {
        const version = ++loadVersion;
        const input = document.getElementById('singleRom');
        const button = document.getElementById('downloadButton');
        loadedImage = null;
        button.disabled = true;
        onLoadStart?.();
        const file = input.files?.[0];
        if (!file || !validateSize(file.size)) {
            setElementText('statusText', sizeError);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            if (version !== loadVersion)
                return;
            loadedImage = new Uint8Array(reader.result);
            loadedName = file.name;
            button.disabled = false;
            const storedDate = populateFields(loadedImage);
            setElementText('statusText', `${file.name} geladen (${file.size} Bytes).${storedDate === null ? ' Das gespeicherte Datum ist ungültig. Bitte ein neues Datum eingeben.' : ''}`);
        };
        reader.onerror = () => {
            if (version === loadVersion)
                setElementText('statusText', 'Die Datei konnte nicht gelesen werden.');
        };
        reader.readAsArrayBuffer(file);
    }
    function downloadTk() {
        try {
            if (!loadedImage)
                throw new Error('Bitte zuerst eine NVRAM-Datei laden.');
            const patched = patch(loadedImage);
            downloadUint8Array(patched, loadedName.replace(/\.[^.]+$/, '') + suffix + '.bin');
            setElementText('statusText', 'Die geänderte NVRAM-Datei wurde erstellt.');
        }
        catch (error) {
            setElementText('statusText', error instanceof Error ? error.message : String(error));
        }
    }
    if (typeof window !== 'undefined') {
        window.loadTkFile = loadTkFile;
        window.downloadTk = downloadTk;
    }
}
