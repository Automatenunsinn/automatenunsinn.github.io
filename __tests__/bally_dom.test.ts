/** @jest-environment jsdom */

const RMC = 'NEGFXR96P5C2QNH8K17XRKU2H2';

type BallyModule = typeof import('../src/bally');

function loadBally(): BallyModule {
  jest.resetModules();
  return require('../src/bally');
}

function setupDom(): void {
  document.body.innerHTML = `
    <input id="code1"><input id="code2"><input id="code3"><input id="code4"><input id="code5">
    <input type="date" id="date">
    <input readonly id="out1"><input readonly id="out2"><input readonly id="out3">
    <input readonly id="out4"><input readonly id="out5">`;
}

function value(id: string): string {
  return (document.getElementById(id) as HTMLInputElement).value;
}

function fillRmc(code: string): void {
  const parts = [
    code.slice(0, 5), code.slice(5, 10), code.slice(10, 15),
    code.slice(15, 20), code.slice(20, 26),
  ];
  parts.forEach((part, i) => {
    (document.getElementById(`code${i + 1}`) as HTMLInputElement).value = part;
  });
}

function outputCode(): string {
  return ['out1', 'out2', 'out3', 'out4', 'out5'].map(value).join('');
}

function isFlaggedInvalid(id: string): boolean {
  return document.getElementById(id)!.classList.contains('is-invalid');
}

describe('genCode guard', () => {
  beforeEach(() => setupDom());

  it('does not emit a code when no Rückmeldecode is present', () => {
    const { genCode } = loadBally();
    (document.getElementById('date') as HTMLInputElement).value = '2024-04-01';

    genCode();

    // Previously this silently produced a valid-looking code with zeroed IDs.
    expect(outputCode()).toBe('');
    expect(isFlaggedInvalid('code1')).toBe(true);
  });

  it('flags the RMC fields when the entered code is garbage', () => {
    const { genCode } = loadBally();
    fillRmc('ZZZZZZZZZZZZZZZZZZZZZZZZZZ');
    (document.getElementById('date') as HTMLInputElement).value = '2024-04-01';

    genCode();

    expect(outputCode()).toBe('');
    expect(isFlaggedInvalid('code1')).toBe(true);
  });

  it('auto-decodes a valid RMC and then encodes', () => {
    const { genCode } = loadBally();
    fillRmc(RMC);
    (document.getElementById('date') as HTMLInputElement).value = '2024-04-01';

    genCode();

    const code = outputCode();
    expect(code).toHaveLength(26);
    expect(code).toMatch(/^[1-9A-Z]{26}$/);
    expect(isFlaggedInvalid('code1')).toBe(false);
    // out1..out5 are filled individually, 5/5/5/5/6
    expect([value('out1').length, value('out2').length, value('out3').length,
            value('out4').length, value('out5').length]).toEqual([5, 5, 5, 5, 6]);
  });
});
