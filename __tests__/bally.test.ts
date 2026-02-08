import { Fsc, parseCode, genCode, parseCodeString } from '../src/bally';

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

  it('parseCodeString works with underscores', () => {
    const input = 'd6bg7_6kkdz_7725g_e8gqf_v8cnl6';
    const result = parseCodeString(input);
    expect(result).toEqual(['D6BG7', '6KKDZ', '7725G', 'E8GQF', 'V8CNL6']);
  });

  it('parseCodeString works with dashes', () => {
    const input = 'd6bg7-6kkdz-7725g-e8gqf-v8cnl6';
    const result = parseCodeString(input);
    expect(result).toEqual(['D6BG7', '6KKDZ', '7725G', 'E8GQF', 'V8CNL6']);
  });

  it('parseCodeString works with mixed capitalisation', () => {
    const input = 'Rpfrt-7z4mg-skhw2-3r414-uk48r8';
    const result = parseCodeString(input);
    expect(result).toEqual(['RPFRT', '7Z4MG', 'SKHW2', '3R414', 'UK48R8']);
  })

  it('parseCodeString works with spaces', () => {
    const input = '5YDFA 8DFTE BSF41 RI6QZ 68TV46';
    const result = parseCodeString(input);
    expect(result).toEqual(['5YDFA', '8DFTE', 'BSF41', 'RI6QZ', '68TV46']);
  })

  it('parseCodeString works with stray characters', () => {
    const input = 'PD9G9- M9YIM-BZBQM-Z2VBD-F7QUG3 .';
    const result = parseCodeString(input);
    expect(result).toEqual(['PD9G9', 'M9YIM', 'BZBQM', 'Z2VBD', 'F7QUG3']);
  })

  it('parseCodeString works with spaces and dashes', () => {
    const input = '477GA - EZDNH - WFT1K - IXKHA - YUSVE2';
    const result = parseCodeString(input);
    expect(result).toEqual(['477GA', 'EZDNH', 'WFT1K', 'IXKHA', 'YUSVE2']);
  })

  it('parseCodeString works with single spaces and dashes', () => {
    const input = '4GG28- WWYFG- 8CEG7- 9R6ER- HN4Z88';
    const result = parseCodeString(input);
    expect(result).toEqual(['4GG28', 'WWYFG', '8CEG7', '9R6ER', 'HN4Z88']);
  })

  it('parseCodeString works with lowercase and no spaces or dashes', () => {
    const input = 't9uc5yirr2wgrsrag4dp98tqb2';
     const result = parseCodeString(input);
     expect(result).toEqual(['T9UC5', 'YIRR2', 'WGRSR', 'AG4DP', '98TQB2']);
  })

  it('parseCodeString works with no spaces or dashes', () => {
    const input = 'SQIC1C8MR43R2EFVXNK1TMPYD3';
     const result = parseCodeString(input);
     expect(result).toEqual(['SQIC1', 'C8MR4', '3R2EF', 'VXNK1', 'TMPYD3']);
  })

  it('parseCodeString works with a newline', () => {
    const input = '9Q8AZ -1T6MY - 9DTX3 - QTQH1 -\n978CC7';
     const result = parseCodeString(input);
     expect(result).toEqual(['9Q8AZ', '1T6MY', '9DTX3', 'QTQH1', '978CC7']);
  })

  it('parseCodeString works with only newlines', () => {
    const input = '4GPKS\nH5X9N\nWY5CG\nRUIZ7\nQD1VU2';
    const result = parseCodeString(input);
     expect(result).toEqual(['4GPKS', 'H5X9N', 'WY5CG', 'RUIZ7', 'QD1VU2']);
  })

});
