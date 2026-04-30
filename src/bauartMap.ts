import Papa from 'papaparse';

export const bauartMap: Record<string, string> = {};

export async function loadBauartMap(): Promise<void> {
  const res = await fetch('ptb.csv');
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, delimiter: ';' });
  for (const row of (parsed.data as Record<string, string>[])) {
    const num = (row['Bauartnummer'] ?? '').trim();
    const name = (row['Bauartname'] ?? '').trim();
    if (num && name) {
      bauartMap[num.padStart(4, '0')] = name;
    }
  }
}
