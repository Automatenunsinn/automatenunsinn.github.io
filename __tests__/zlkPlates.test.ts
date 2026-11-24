/** @jest-environment jsdom */
import { readFileSync } from 'fs';

test('ZLK and ATU synchronize names, manufacturer and dates from either number', async () => {
    document.body.innerHTML = readFileSync('src/pages/zlk.html', 'utf8');
    global.fetch = jest.fn().mockResolvedValue({ text: async () => readFileSync('src/ptb.csv', 'utf8') });
    await import('../src/zlk');
    document.dispatchEvent(new Event('DOMContentLoaded'));
    await new Promise(resolve => setTimeout(resolve, 0));
    const serial = document.getElementById('serialInput') as HTMLInputElement;
    const atu = document.getElementById('atuZlInput') as HTMLInputElement;
    const end = document.getElementById('dateInput') as HTMLInputElement;
    expect(end.value).toBe('2085-12-31');
    for (const input of [serial, atu]) {
        input.value = '295512345';
        input.dispatchEvent(new Event('input'));
        expect(serial.value).toBe(input.value);
        expect(atu.value).toBe(input.value);
        expect((document.getElementById('machinename') as HTMLInputElement).value).toBe('BW3190');
        expect((document.getElementById('atuMachinename') as HTMLInputElement).value).toBe('BW3190');
        expect(document.getElementById('plateManufacturer')?.textContent).toContain('Bally Wulff');
        expect(document.getElementById('plateApprovalDate')?.textContent).toBe('05.08.2014');
        expect(end.value).toBe('2085-12-31');
        input.value = '';
        input.dispatchEvent(new Event('input'));
        expect(serial.value).toBe('');
        expect(atu.value).toBe('');
        expect((document.getElementById('atuMachinename') as HTMLInputElement).value).toBe('');
        expect(document.getElementById('plateManufacturer')?.textContent).toBe('—');
    }
    atu.value = '117112345';
    atu.dispatchEvent(new Event('input'));
    expect((document.getElementById('machineSelect') as HTMLSelectElement).value).toBe('MERKUR ALSUNA');
    expect((document.getElementById('machinebyte') as HTMLInputElement).value).toBe('00 89');
    expect(end.value).toBe('2085-12-31');
});
