export function parseDate(str: string): Date | null {
    if (!/^\d{6}$/.test(str)) return null;
    const yy = parseInt(str.slice(0, 2));
    const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;

    // Versuche YYMMDD
    let mm = parseInt(str.slice(2, 4));
    let dd = parseInt(str.slice(4, 6));
    let date = new Date(yyyy, mm - 1, dd);
    if (date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd) {
        return date;
    }

    // Versuche YYDDMM
    mm = parseInt(str.slice(4, 6));
    dd = parseInt(str.slice(2, 4));
    date = new Date(yyyy, mm - 1, dd);
    if (date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd) {
        return date;
    }

    return null;
}