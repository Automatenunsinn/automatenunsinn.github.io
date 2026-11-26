import { bauartDetailsMap } from '../bauartMap.js';
import { lookupMachineName } from './bauartLookup.js';

/** Synchronize a card/plate pair without changing either plate's end date. */
export function updateIdentificationPlate(
    value: string,
    primaryNumberId: string,
    options: { uppercase?: boolean; expectedManufacturer?: RegExp } = {}
): void {
    const serial = value.trim();
    for (const id of [primaryNumberId, 'atuZlInput']) {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (input && input.value !== serial) input.value = serial;
    }
    const name = lookupMachineName(serial);
    for (const id of ['machinename', 'atuMachinename']) {
        const input = document.getElementById(id) as HTMLInputElement | null;
        if (input) input.value = options.uppercase ? name.toUpperCase() : name;
    }
    const prefix = serial.slice(0, Number(serial[0]) > 4 ? 3 : 4);
    const details = serial.length >= 4 ? bauartDetailsMap[prefix] : undefined;
    const manufacturer = document.getElementById('plateManufacturer');
    if (manufacturer) {
        manufacturer.textContent = details?.manufacturer || '—';
        manufacturer.classList.toggle('glow-red', !!details?.manufacturer &&
            !!options.expectedManufacturer && !options.expectedManufacturer.test(details.manufacturer));
    }
    const approvalDate = document.getElementById('plateApprovalDate');
    if (approvalDate) approvalDate.textContent = details?.date || '—';
}
