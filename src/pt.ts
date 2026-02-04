import abCheck from './abCheck';

declare global {
    interface Window {
        calcRequestCode: () => void;
        calculateCode: () => void;
        downloadCode: () => void;
    }
}

export function calcRequestCode() {
    const volSer = document.getElementById('volumeSerial') as HTMLInputElement;
    const reqField = document.getElementById('requestCode') as HTMLInputElement;
    let volNum = parseInt(volSer.value.replace("-",""), 16);
    if(abCheck()) { volNum = volNum + 0x0F9DEE1; };
    const hexCode = (volNum & 0x7FFFFFFF);
    reqField.value = hexCode.toString();
}

export function calculateResponseCode(reqCode: number): number {
    reqCode &= 0x7FFFFFFF;
    reqCode ^= (0x5C621BD2 << (reqCode & 15));
    reqCode &= 0x7FFFFFFF;

    return reqCode;
}

export default function calculateCode() {
    const reqField = document.getElementById('requestCode') as HTMLInputElement;
    const outLabel = document.getElementById('out') as HTMLInputElement;
    const dlbtn = document.getElementById('downloadButton') as HTMLInputElement;

    try {
        let reqCode = parseInt(reqField.value, 10);
        
        if (isNaN(reqCode)) {
            throw new Error('falscher Abruf Code!');
        }

        reqField.className = "success";

        const resultCode = calculateResponseCode(reqCode);
        outLabel.value = resultCode.toString();
        outLabel.style.animation = "shine 1s ease-in infinite";
        dlbtn.disabled = false;

    } catch (error: unknown) {
        reqField.className = "failure";
        dlbtn.disabled = true;
    }
}

export function downloadCode() {
    const outLabel = document.getElementById('out') as HTMLInputElement;
    const lvar_8 = outLabel.textContent;

    const regContent = `Windows Registry Editor Version 5.00

[HKEY_LOCAL_MACHINE\\Software\\Wow6432Node\\adp GmbH\\Power Tool]
"Reg3"="${lvar_8}"`;

    const blob = new Blob([regContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'PowerTool.reg';
    document.body.appendChild(a);

    a.click();

    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

if (typeof window !== 'undefined') {
    window.calcRequestCode = calcRequestCode;
    window.calculateCode = calculateCode;
    window.downloadCode = downloadCode;
}
