/** @jest-environment jsdom */
import { autoSelectMachine, populateMachines } from '../src/zlk';
import { bauartMap, bauartZlkMap } from '../src/bauartMap';
import { v2Machines } from '../src/zlkMappings';
import { readFileSync } from 'fs';
import Papa from 'papaparse';

beforeEach(() => {
    document.body.innerHTML = `<select id="cardTypeSelect"><option value="v2">V2</option></select>
        <input id="serialInput"><input id="machinename"><select id="machineSelect"></select>
        <input id="machinebyte"><input id="machinetype">`;
    for (const key of Object.keys(bauartMap)) delete bauartMap[key];
    for (const key of Object.keys(bauartZlkMap)) delete bauartZlkMap[key];
    const rows = Papa.parse<Record<string, string>>(readFileSync('src/ptb.csv', 'utf8'), {
        header: true, skipEmptyLines: true
    }).data;
    for (const row of rows) {
        const name = (row.Spielname || row.Bauartname || '').trim();
        if (row.Bauartnummer && name) bauartMap[row.Bauartnummer.padStart(3, '0')] = name;
        if (/^0x[0-9a-f]{4}$/i.test(row['ZL-Daten'])) bauartZlkMap[row.Bauartnummer.padStart(3, '0')] = row['ZL-Daten'].slice(2).toUpperCase();
    }
    populateMachines();
});

test.each([
    ['1152', 'ALSUNA', '00 89'],
    ['1171', 'MERKUR ALSUNA', '00 89'],
    ['1465', 'MERKUR WORLD CUP', '02 33'],
    ['2068', 'SIRIUS-JACKPOT', '81 12'],
    ['1066', 'PALACE EURO', '00 68'],
    ['2101', 'MEGA WINNER', '81 19'],
    ['2103', 'ADP 1017 (MULTI MULTI)', '02 91'],
    ['2124', 'MAGIE 1 ERGO', '03 15'],
    ['2347', 'ADP 1321 (CRUISER)', '92 69'],
    ['2100', 'ADP-1019 (TRIO)', '81 20'],
    ['2111', 'TRIO', '81 21'],
    ['2147', 'ADP-1040 (WINNER JACKPOT)', '81 39'],
    ['2150', 'ADP-1089 (WINNER JACKPOT)', '81 43'],
    ['2302', 'ADP 1023 (ROULETTE)', '03 80'],
    ['2500', 'ADP 1079 (ROULETTE)', '05 52'],
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

test('uses the PTB ID when different models share a game name', () => {
    (document.getElementById('serialInput') as HTMLInputElement).value = '208312345';
    autoSelectMachine();
    expect((document.getElementById('machinebyte') as HTMLInputElement).value).toBe('92 17');
    (document.getElementById('serialInput') as HTMLInputElement).value = '208112345';
    autoSelectMachine();
    expect((document.getElementById('machinebyte') as HTMLInputElement).value).toBe('02 65');
});
