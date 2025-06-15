import abCheck from './abCheck';

declare global {
    interface Window {
        calculateCode: () => void;
        downloadCode: () => void;
    }
}

export default function calculateCode() {
    const maskEdit1 = document.getElementById('maskEditInput') as HTMLInputElement;
    const label1 = document.getElementById('out') as HTMLInputElement;
    const dlbtn = document.getElementById('downloadButton') as HTMLInputElement;

    let lvar_4: string;
    let lvar_8: string;

    try {
        lvar_4 = maskEdit1.value;
        let EBX = parseInt(lvar_4, 10);
        
        if (isNaN(EBX)) {
            throw new Error('falscher Abruf Code!');
        }

        maskEdit1.style.backgroundColor = "#353";

        EBX &= 2147483647; // EBX And $7FFFFFFF{2147483647}
        const ECX = EBX & 15; // EBX And 15

        const EAX = 1549933522; // $5C621BD2{1549933522}
        if(abCheck()) EBX ^= (EAX << ECX); // EBX Xor ($5C621BD2{1549933522} Shl (EBX And 15))
        EBX &= 2147483647; // (EBX) And $7FFFFFFF{2147483647}

        lvar_8 = (EBX & 2147483647).toString(); // (EBX) And $7FFFFFFF{2147483647}{EAX}
        label1.value = lvar_8;
        dlbtn.disabled = false;

    } catch (error: unknown) {
        maskEdit1.style.backgroundColor = "#533";
        dlbtn.disabled = true;
    }
}

export function downloadCode() {
    const label1 = document.getElementById('out') as HTMLInputElement;
    const lvar_8 = label1.textContent;

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

window.calculateCode = calculateCode;
window.downloadCode = downloadCode;
