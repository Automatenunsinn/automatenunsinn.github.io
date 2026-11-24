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

    bally.value = '295512345';
    bally.dispatchEvent(new Event('input'));
    expect(atu.value).toBe(bally.value);
    expect(ballyName.value).toBe('BW3190');
    expect(atuName.value).toBe(ballyName.value);
    expect(document.getElementById('plateManufacturer')?.textContent).toContain('Bally Wulff');
    expect(document.getElementById('plateApprovalDate')?.textContent).toBe('05.08.2014');

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
});
