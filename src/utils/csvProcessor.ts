import { parse } from 'papaparse';

export interface CSVRow {
    Bezeichnung: string;
    'Bestell-Nr': string;
    'Teile-Nr': string;
}

export async function processCSV(csvString: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
        parse(csvString, {
            header: true,
            complete: (results) => {
                const data = results.data.map(row => {
                        const { Bezeichnung, 'Bestell-Nr': bestellNr, 'Teile-Nr': teileNr } = <CSVRow>row;

                        const [bestellSerie, bestellNummer] = splitBestellNr(bestellNr);
                        const [teileSerie, teileNummer, erweiterung] = splitTeileNr(teileNr);

                    return {
                            Bezeichnung,
                            'Bestell-Serie': bestellSerie || '',
                            'Bestell-Nr': bestellNummer || '',
                            'Teile-Serie': teileSerie || '',
                            'Teile-Nr': teileNummer || '',
                            Erweiterung: erweiterung || ''
                    };
                });
                resolve(data);
            },
            error: (error: any) => {
                reject(error);
}
        });
    });
}

export function splitBestellNr(bestellNr: string): [string, string] | [null, null] {
    if (!bestellNr || bestellNr.length !== 8) {
        return [null, null];
    }
    const bestellSerie = bestellNr.slice(0, 4);
    const bestellNummer = bestellNr.slice(4);
    return [bestellSerie, bestellNummer];
}

export function splitTeileNr(teileNr: string): [string, string, string] | [null, null, null] {
    if (!teileNr) {
        return [null, null, null];
    }
    if (teileNr.includes('/')) {
        const parts = teileNr.split('/');
        if (parts.length !== 2) {
            return [null, null, null];
        }
        const [teileSerie, remaining] = parts;
        let teileNummer = '';
        let erweiterung = '';

        for (const char of remaining) {
            if (/\d/.test(char)) {
                teileNummer += char;
            } else if (/[a-zA-Z]/.test(char)) {
                erweiterung += char;
            }
        }

        if (erweiterung.length > 0) {
            erweiterung = erweiterung.trim();
        }

        return [teileSerie, teileNummer, erweiterung];
    } else {
        let teileSerie = '';
        let teileNummer = '';
        let erweiterung = '';
        let i = 0;
        // TeileSerie: erste 4 Ziffern
        while (i < teileNr.length && teileSerie.length < 4) {
            if (/\d/.test(teileNr[i])) {
                teileSerie += teileNr[i];
            }
            i++;
        }
        let rest = teileNr.slice(i);
        let j = rest.length - 1;
        while (j >= 0 && /[a-zA-Z]/.test(rest[j])) {
            erweiterung = rest[j] + erweiterung;
            j--;
        }
        teileNummer = rest.slice(0, j + 1).replace(/[^\d]/g, '');
        return [teileSerie, teileNummer, erweiterung];
    }
}
