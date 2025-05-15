import { Fsc, parseCode, genCode } from '../src/bally';

describe('Fsc parseCode und genCode', () => {
  let bcrypto: Fsc;
  beforeEach(() => {
    bcrypto = new Fsc();
  });

  it('parseCode works with a valid code', () => {
    const code = 'NEGFX-R96P5-C2QNH-8K17X-RKU2H2'.replace(/-/g, '');
    const result = bcrypto.decrypt(code);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(bcrypto.Date).toEqual(new Date(2089, 10, 0)); // 2089-10-30
  });

  it('gencode result', () => {
    const code = 'NEGFX-R96P5-C2QNH-8K17X-RKU2H2'.replace(/-/g, '');
    bcrypto.decrypt(code);
    const date = new Date(2024, 4-1, 1);
    const generated = bcrypto.encryptFsc(date);
    expect(generated).toBe('BUXSE-D72C3-X2TYZ-Q8FYM-KPUGV2');
  });
});
