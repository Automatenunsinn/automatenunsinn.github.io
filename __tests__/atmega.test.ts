/** @jest-environment jsdom */
import { TextDecoder, TextEncoder } from 'node:util';
import '../src/atmega';

test('a HEX file with a bad checksum blocks flashing even with a valid EEPROM selected', async () => {
    document.body.innerHTML = `
        <button id="connectBtn">Verbinden</button>
        <input id="hexFile" type="file">
        <input id="eepromFile" type="file">
        <button id="flashBtn" disabled>Flashen</button>
        <textarea id="logArea"></textarea>
    `;
    Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, configurable: true });
    Object.defineProperty(navigator, 'serial', {
        value: { requestPort: jest.fn().mockResolvedValue({}) },
        configurable: true
    });
    document.dispatchEvent(new Event('DOMContentLoaded'));
    document.querySelector<HTMLButtonElement>('#connectBtn')!.click();
    await Promise.resolve();

    async function selectFile(inputId: string, name: string, contents: string): Promise<void> {
        const input = document.querySelector<HTMLInputElement>(inputId)!;
        const file = new File([contents], name);
        Object.defineProperty(file, 'arrayBuffer', {
            value: async () => new TextEncoder().encode(contents).buffer
        });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        input.dispatchEvent(new Event('change'));
        await Promise.resolve();
    }

    const flashButton = document.querySelector<HTMLButtonElement>('#flashBtn')!;
    await selectFile('#eepromFile', 'eeprom.bin', 'data');
    expect(flashButton.disabled).toBe(false);

    await selectFile('#hexFile', 'invalid.hex', ':010000002AD4\n:00000001FF\n');

    expect(document.querySelector<HTMLTextAreaElement>('#logArea')!.value).toMatch(/invalid\.hex.*Invalid checksum/);
    expect(flashButton.disabled).toBe(true);
});
