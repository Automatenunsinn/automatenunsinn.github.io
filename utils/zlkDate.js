/** Cards store packed BCD month/year only; the day is not transmitted. */
export const DEFAULT_ZLK_END_DATE = '2085-12-31';
export function encodeZlkDate(value) {
    const match = /^(20[0-9]{2})-(0[1-9]|1[0-2])-([0-9]{2})$/.exec(value);
    if (!match)
        throw new Error('Bitte ein gültiges Enddatum zwischen 2000 und 2099 eingeben.');
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
        throw new Error('Bitte ein gültiges Enddatum eingeben.');
    }
    return [parseInt(month, 16), parseInt(year.slice(2), 16)];
}
