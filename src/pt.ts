declare global {
    interface Window {
        calculateCode: () => void;
    }
}

export default function calculateCode() {
    const maskEdit1 = document.getElementById('maskEditInput') as HTMLInputElement;
    const label1 = document.getElementById('resultLabel') as HTMLElement;

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
        EBX ^= (EAX << ECX); // EBX Xor ($5C621BD2{1549933522} Shl (EBX And 15))
        EBX &= 2147483647; // (EBX) And $7FFFFFFF{2147483647}

        lvar_8 = (EBX & 2147483647).toString(); // (EBX) And $7FFFFFFF{2147483647}{EAX}
        label1.textContent = lvar_8;

        // Create the .reg file content
        const regContent = `Windows Registry Editor Version 5.00
[HKEY_LOCAL_MACHINE\\Software\\Wow6432Node\\adp GmbH\\Power Tool]
"Reg3"="${lvar_8}"`;

        // Create a Blob from the .reg content
        const blob = new Blob([regContent], { type: 'text/plain;charset=utf-8' });

        // Create a download link for the Blob
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'PowerToolReg3.reg';
        document.body.appendChild(a);

        // Trigger the download
        a.click();

        // Clean up
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    } catch (error: unknown) {
        maskEdit1.style.backgroundColor = "#533";
    }
}

window.calculateCode = calculateCode;