import Papa from 'papaparse';
export const bauartMap = {};
export const bauartZlkMap = {};
export const bauartDetailsMap = {};
export async function loadBauartMap() {
    const res = await fetch('ptb.csv');
    const text = await res.text();
    const parsed = Papa.parse(text, {
        header: true,
        delimiter: ',',
        skipEmptyLines: true,
    });
    for (const row of parsed.data) {
        const num = (row['Bauartnummer'] ?? '').trim();
        const spielname = (row['Spielname'] ?? '').trim();
        const bauartname = (row['Bauartname'] ?? '').trim();
        const name = spielname || bauartname;
        if (num && name) {
            bauartMap[num.padStart(3, '0')] = name;
            bauartDetailsMap[num.padStart(3, '0')] = {
                manufacturer: (row['Zulassungsinhaber'] ?? '').trim(),
                date: (row['Datum'] ?? '').trim(),
            };
            const id = (row['ZL-Daten'] ?? '').trim();
            if (/^0x[0-9a-f]{4}$/i.test(id))
                bauartZlkMap[num.padStart(3, '0')] = id.slice(2).toUpperCase();
        }
    }
}
