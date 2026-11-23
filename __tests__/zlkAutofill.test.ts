/** @jest-environment jsdom */
import { autoSelectMachine, populateMachines } from '../src/zlk';
import { bauartMap } from '../src/bauartMap';
import { v2Machines } from '../src/zlkMappings';
import { readFileSync } from 'fs';
import Papa from 'papaparse';

beforeEach(() => {
    document.body.innerHTML = `<select id="cardTypeSelect"><option value="v2">V2</option></select>
        <input id="serialInput"><input id="machinename"><select id="machineSelect"></select>
        <input id="machinebyte"><input id="machinetype">`;
    for (const key of Object.keys(bauartMap)) delete bauartMap[key];
    const rows = Papa.parse<Record<string, string>>(readFileSync('src/ptb.csv', 'utf8'), {
        header: true, skipEmptyLines: true
    }).data;
    for (const row of rows) {
        const name = (row.Spielname || row.Bauartname || '').trim();
        if (row.Bauartnummer && name) bauartMap[row.Bauartnummer.padStart(3, '0')] = name;
    }
    populateMachines();
});

test.each([
    ['1152', 'ALSUNA', '00 89'],
    ['1171', 'MERKUR ALSUNA', '00 89'],
    ['1465', 'MERKUR WORLD CUP', '02 33'],
    ['2068', 'SIRIUS-JACKPOT', '81 12'],
])('selects PTB name for ZL prefix %s', (prefix, name, bytes) => {
    (document.getElementById('serialInput') as HTMLInputElement).value = prefix + '12345';
    autoSelectMachine();
    expect((document.getElementById('machineSelect') as HTMLSelectElement).value).toBe(name);
    expect((document.getElementById('machinebyte') as HTMLInputElement).value).toBe(bytes);
});

test('removes redundant ALSUNA and LED aliases', () => {
    expect(Object.keys(v2Machines).filter(name => name.startsWith('MERKUR ALSUNA'))).toEqual(['MERKUR ALSUNA']);
    expect('MERKUR GOLD CUP LED' in v2Machines).toBe(false);
    expect('MERKUR STRATOS LED' in v2Machines).toBe(false);
});

test('selects mixed-case keys from PTB names', () => {
    bauartMap['1234'] = 'Ergoline M88';
    (document.getElementById('serialInput') as HTMLInputElement).value = '123412345';
    autoSelectMachine();
    expect((document.getElementById('machineSelect') as HTMLSelectElement).value).toBe('Ergoline M88');
});
