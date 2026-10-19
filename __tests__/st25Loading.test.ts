/** @jest-environment jsdom */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import '../src/st25';

describe('loading the ST25 expiry example', () => {
    it.each([0x1FF8, 0x2000])('populates the date field from the literal bytes in a %i-byte file', async size => {
        document.documentElement.innerHTML = readFileSync(resolve(__dirname, '../src/pages/st25.html'), 'utf8');
        const image = new Uint8Array(size);
        image.set([0xF8, 0xA4, 0x1D, 0x10, 0x07, 0x5B, 0xE2, 0xEF], 0x1FDE);
        const input = document.getElementById('singleRom') as HTMLInputElement;
        Object.defineProperty(input, 'files', { value: [new File([image.buffer], 'expiry.bin')] });

        const status = document.getElementById('statusText')!;
        await new Promise<void>(resolveLoaded => {
            const observer = new MutationObserver(() => {
                observer.disconnect();
                resolveLoaded();
            });
            observer.observe(status, { childList: true });
            window.loadTkFile();
        });

        expect((document.getElementById('dateInput') as HTMLInputElement).value).toBe('2033-04-30');
        expect((document.getElementById('downloadButton') as HTMLInputElement).disabled).toBe(false);
        expect(status.textContent).not.toContain('ungültig');
    });
});
