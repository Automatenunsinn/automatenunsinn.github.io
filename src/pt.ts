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
    const reqCode = document.getElementById('requestCode') as HTMLInputElement;
    let volNum = parseInt(volSer.value.replace("-",""), 16);
    if(abCheck()) { volNum = volNum + 0x0F9DEE1; };
    const hexCode = (volNum & 0x7FFFFFFF);
    reqCode.value = hexCode.toString();
}

export default function calculateCode() {
    const reqCode = document.getElementById('requestCode') as HTMLInputElement;
    const outLabel = document.getElementById('out') as HTMLInputElement;
    const dlbtn = document.getElementById('downloadButton') as HTMLInputElement;

    try {
        const lvar_4 = reqCode.value;
        let EBX = parseInt(lvar_4, 10);
        
        if (isNaN(EBX)) {
            throw new Error('falscher Abruf Code!');
        }

        reqCode.className = "success";

        EBX &= 2147483647; // EBX And $7FFFFFFF{2147483647}
        const ECX = EBX & 15; // EBX And 15

        const EAX = 1549933522; // $5C621BD2{1549933522}
        if(abCheck()) EBX ^= (EAX << ECX); // EBX Xor ($5C621BD2{1549933522} Shl (EBX And 15))
        EBX &= 2147483647; // (EBX) And $7FFFFFFF{2147483647}

        outLabel.value = (EBX & 2147483647).toString(); // (EBX) And $7FFFFFFF{2147483647}{EAX}
        outLabel.style.animation = "shine 1s ease-in infinite";
        dlbtn.disabled = false;

    } catch (error: unknown) {
        reqCode.className = "failure";
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

window.calcRequestCode = calcRequestCode;
window.calculateCode = calculateCode;
window.downloadCode = downloadCode;
