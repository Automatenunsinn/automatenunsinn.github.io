import { calculateResponseCode } from '../src/pt';

describe('calculateResponseCode', () => {
    it('should return 941518234 for input 1234567890', () => {
        const result = calculateResponseCode(1234567890);
        expect(result).toBe(941518234);
    });
    it('should return 1549933522 for input 0000000000', () => {
        const result = calculateResponseCode(0);
        expect(result).toBe(1549933522);
    });
    it('should return 674484851 for input 5555555555', () => {
        const result = calculateResponseCode(5555555555);
        expect(result).toBe(674484851);
    });
});
