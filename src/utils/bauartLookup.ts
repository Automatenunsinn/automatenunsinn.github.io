import { bauartMap } from '../bauartMap';

export function lookupMachineName(value: string): string {
    if (value.length >= 4) {
        const prefix = value.slice(0, 4);
        return bauartMap[prefix] ?? '';
    }
    return '';
}
