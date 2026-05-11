import { bauartMap } from '../bauartMap';

export function lookupMachineName(value: string): string {
    if (value.length >= 4) {
        const firstDigit = parseInt(value[0], 10);
        const prefixLength = firstDigit > 4 ? 3 : 4;
        const prefix = value.slice(0, prefixLength);
        return bauartMap[prefix] ?? '';
    }
    return '';
}
