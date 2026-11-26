const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('localizes text added by interactive tools, including interpolated messages', async () => {
  const dom = new JSDOM('<!doctype html><html lang="en"><body></body></html>', {
    runScripts: 'outside-only',
    url: 'https://automatenunsinn.github.io/en/index.html'
  });
  dom.window.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({
      'Zurück': 'Back',
      'Fehler beim Laden der ZXVAR000ZX-Datei: ZXVAR001ZX':
        'Could not load file ZXVAR000ZX: ZXVAR001ZX'
    })
  });

  const runtime = fs.readFileSync(
    path.join(__dirname, '../src/locale-runtime.js'),
    'utf8'
  );
  dom.window.eval(runtime);
  await new Promise((resolve) => setTimeout(resolve, 0));

  const button = dom.window.document.createElement('button');
  button.textContent = 'Zurück';
  dom.window.document.body.append(button);
  const status = dom.window.document.createElement('p');
  status.textContent = 'Fehler beim Laden der test.bin-Datei: Zugriff verweigert';
  dom.window.document.body.append(status);
  await new Promise((resolve) => setTimeout(resolve, 0));

  expect(button.textContent).toBe('Back');
  expect(status.textContent).toBe('Could not load file test.bin: Zugriff verweigert');
  dom.window.close();
});
