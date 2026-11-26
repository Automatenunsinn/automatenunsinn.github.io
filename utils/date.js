export function parseCompactDate(value) {
    if (!/^\d{8}$/.test(value)) {
        throw new Error('Bitte das Datum als JJJJMMTT eingeben.');
    }
    const year = Number(value.slice(0, 4));
    const month = Number(value.slice(4, 6));
    const day = Number(value.slice(6, 8));
    const date = new Date(Date.UTC(year, month - 1, day));
    if (year < 1000 || date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new Error('Bitte ein gültiges Datum eingeben.');
    }
    return date;
}
