/** @jest-environment jsdom */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { TextEncoder } from 'util';

test('editing either plate synchronizes the number, machine name and ATU details', async () => {
    Object.assign(global, { TextEncoder });
    document.body.innerHTML = readFileSync(resolve(__dirname, '../src/pages/bpatcher.html'), 'utf8');
    const csv = readFileSync(resolve(__dirname, '../src/ptb.csv'), 'utf8');
    global.fetch = jest.fn().mockResolvedValue({ text: async () => csv });
    await import('../src/bpatcher');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 0));

    const bally = document.getElementById('zlInput') as HTMLInputElement;
    const atu = document.getElementById('atuZlInput') as HTMLInputElement;
    const ballyName = document.getElementById('machinename') as HTMLInputElement;
    const atuName = document.getElementById('atuMachinename') as HTMLInputElement;
    const fileIds = ['singleRom', 'oddRom', 'evenRom'];
    const expectNoFileGlow = () => fileIds.forEach(id => expect(document.getElementById(id)?.classList.contains('glow-green')).toBe(false));
    expectNoFileGlow();
    for (const invalid of ['2955', '29551234', '29551234x', '000012345']) {
        bally.value = invalid;
        bally.dispatchEvent(new Event('input'));
        expectNoFileGlow();
    }

    bally.value = '295612345';
    bally.dispatchEvent(new Event('input'));
    expect(document.getElementById('plateManufacturer')?.textContent).toContain('Spiel Tech');
    expect(document.getElementById('plateManufacturer')?.classList.contains('glow-red')).toBe(true);
    expectNoFileGlow();
    expect(document.getElementById('loadSingleButton')?.classList.contains('glow-green')).toBe(false);
    expect(document.getElementById('loadDualButton')?.classList.contains('glow-green')).toBe(false);

    bally.value = '295512345';
    bally.dispatchEvent(new Event('input'));
    expect(atu.value).toBe(bally.value);
    expect(ballyName.value).toBe('BW3190');
    expect(atuName.value).toBe(ballyName.value);
    expect(document.getElementById('plateManufacturer')?.textContent).toContain('Bally Wulff');
    expect(document.getElementById('plateManufacturer')?.classList.contains('glow-red')).toBe(false);
    expect(document.getElementById('plateApprovalDate')?.textContent).toBe('05.08.2014');
    expect(document.getElementById('oddRom')?.classList.contains('glow-green')).toBe(true);
    expect(document.getElementById('evenRom')?.classList.contains('glow-green')).toBe(true);
    expect(document.getElementById('singleRom')?.classList.contains('glow-green')).toBe(false);

    atu.value = '295412345';
    atu.dispatchEvent(new Event('input'));
    expect(bally.value).toBe(atu.value);
    expect(ballyName.value).toBe('BW3189');
    expect(atuName.value).toBe(ballyName.value);
    expect(document.getElementById('plateApprovalDate')?.textContent).toBe('04.08.2014');

    atu.value = '';
    atu.dispatchEvent(new Event('input'));
    expect(bally.value).toBe('');
    expect(ballyName.value).toBe('');
    expect(atuName.value).toBe('');
    expect(document.getElementById('plateManufacturer')?.textContent).toBe('—');
    expect(document.getElementById('plateApprovalDate')?.textContent).toBe('—');
    expect(document.getElementById('plateManufacturer')?.classList.contains('glow-red')).toBe(false);
    expectNoFileGlow();
});

test('guides single and dual file loading, patching and explicit downloads', async () => {
    const patcher = await import('../src/bpatcher');
    const { bauartDetailsMap } = await import('../src/bauartMap');
    const ui = await import('../src/utils/ui');
    const download = jest.spyOn(ui, 'downloadBlob').mockImplementation(() => {});
    const actions = window as unknown as {
        loadSingleFile(): Promise<boolean>;
        loadDualFiles(): Promise<boolean>;
        patchEPROM(): Promise<boolean>;
        downloadPatched(): Promise<void>;
    };
    const number = document.getElementById('zlInput') as HTMLInputElement;
    bauartDetailsMap['1234'] = { manufacturer: 'Bally Wulff', date: '2001' };
    number.value = '123412345';
    number.dispatchEvent(new Event('input'));
    expect(document.getElementById('singleRom')?.classList.contains('glow-green')).toBe(true);
    expect(document.getElementById('oddRom')?.classList.contains('glow-green')).toBe(false);

    const source = new Uint8Array(64);
    source.set(patcher.PATCH_DATA_CHECKSUM_PATTERN, 16);
    const selectFile = (id: string, name: string, bytes: Uint8Array) => {
        const input = document.getElementById(id) as HTMLInputElement;
        Object.defineProperty(input, 'files', { configurable: true, value: [{ name, arrayBuffer: async () => bytes.buffer }] });
        input.dispatchEvent(new Event('change'));
    };
    selectFile('singleRom', 'single.bin', source);
    expect(document.getElementById('loadSingleButton')?.classList.contains('glow-green')).toBe(true);
    expect(document.getElementById('singleRom')?.classList.contains('glow-green')).toBe(false);
    expect(await actions.loadSingleFile()).toBe(true);
    expect(document.getElementById('patchButton')?.classList.contains('glow-green')).toBe(true);
    document.querySelectorAll<HTMLInputElement>('#patchOptions input').forEach(input => { input.checked = input.id === 'patchChecksum'; });
    expect(await actions.patchEPROM()).toBe(true);
    expect(download).not.toHaveBeenCalled();
    expect(document.getElementById('downloadButton')?.classList.contains('glow-green')).toBe(true);
    await actions.downloadPatched();
    expect(download).toHaveBeenLastCalledWith(expect.any(Blob), 'single_patched.bin');

    const date = document.getElementById('dateInput') as HTMLInputElement;
    date.dispatchEvent(new Event('input'));
    expect((document.getElementById('downloadButton') as HTMLButtonElement).disabled).toBe(true);
    expect(document.getElementById('patchButton')?.classList.contains('glow-green')).toBe(true);

    const odd = source.filter((_, index) => index % 2 === 0);
    const even = source.filter((_, index) => index % 2 === 1);
    selectFile('oddRom', 'odd.ic15', odd);
    expect(document.getElementById('evenRom')?.classList.contains('glow-green')).toBe(true);
    expect((document.getElementById('patchButton') as HTMLButtonElement).disabled).toBe(true);
    selectFile('evenRom', 'even.ic10', even);
    expect(document.getElementById('loadDualButton')?.classList.contains('glow-green')).toBe(true);
    expect(await actions.loadDualFiles()).toBe(true);
    expect(await actions.patchEPROM()).toBe(true);
    expect(download).toHaveBeenCalledTimes(1);
    await actions.downloadPatched();
    expect(download).toHaveBeenCalledTimes(3);
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'odd_odd_patched.ic15');
    expect(download).toHaveBeenCalledWith(expect.any(Blob), 'even_even_patched.ic10');
    download.mockRestore();
});
