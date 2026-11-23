import Papa from 'papaparse';

export const bauartMap: Record<string, string> = {};
export const bauartZlkMap: Record<string, string> = {};

export async function loadBauartMap(): Promise<void> {
  const res = await fetch('ptb.csv');
  const text = await res.text();
  const parsed = Papa.parse(text, {
    header: true,
    delimiter: ',',
    skipEmptyLines: true,
  });
  for (const row of (parsed.data as Record<string, string>[])) {
    const num = (row['Bauartnummer'] ?? '').trim();
    const spielname = (row['Spielname'] ?? '').trim();
    const bauartname = (row['Bauartname'] ?? '').trim();
    const name = spielname || bauartname;
    if (num && name) {
      bauartMap[num.padStart(3, '0')] = name;
      const id = (row['ZL-Daten'] ?? '').trim();
      if (/^0x[0-9a-f]{4}$/i.test(id)) bauartZlkMap[num.padStart(3, '0')] = id.slice(2).toUpperCase();
    }
  }
}
