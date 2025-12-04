import { convertZlDataToArray, generateZlCodeV2, generateZlCodeV3, rotateZlStr } from '../src/zl';

test('array conversion', () => {
    const zlData = { zlNr: 400112345, code: 10240000 };
    const zlnr = new Array(13).fill(0);
    const code = [0];
    convertZlDataToArray(zlData, zlnr, code);

    expect(zlnr).toEqual([
        4, 0, 0, 1, 1, 2, 3, 4, 5, 1, 0, 2, 4
    ]);
});

test('rotation', () => {
    const zlStr = [4, 0, 0, 1, 1, 2, 3, 4, 5, 1, 0, 2, 4];
    const firstPart = new Array(5).fill('0');
    const expectedZlStr = [0, 0, 1, 1, 2, 3, 4, 5, 1, 0, 2, 4, 4];
    const expectedFirstPart = [
        String.fromCharCode(1 + 0x30),
        String.fromCharCode(0 + 0x30),
        String.fromCharCode(2 + 0x30),
        String.fromCharCode(4 + 0x30),
        '0'
    ];
    rotateZlStr(zlStr, firstPart);
    expect(zlStr).toEqual(expectedZlStr);
    expect(firstPart).toEqual(expectedFirstPart);
});

test('code v2', () => {
    const data = [0, 0, 1, 1, 2, 3, 4, 5, 1, 0, 2, 4, 4];
    const result = generateZlCodeV2([...data]);
    expect(result).toBe(2050);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(10000);
});

test('code v3', () => {
    const data = [0, 0, 1, 1, 2, 3, 4, 5, 1, 0, 2, 4, 4];
    const result = generateZlCodeV3([...data]);
    expect(result).toBe(871);
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThan(10000);
});

