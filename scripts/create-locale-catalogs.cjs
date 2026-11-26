const fs = require('node:fs');
const path = require('node:path');
const { readStrings } = require('./locale-catalog-utils.cjs');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'src/locales');
const pageFiles = fs.readdirSync(path.join(root, '_site'))
  .filter((fileName) => fileName.endsWith('.html'));
const strings = new Set();

function readTypeScriptStrings(source) {
  const pattern = /'([^'\\]*(?:\\.[^'\\]*)*)'|"([^"\\]*(?:\\.[^"\\]*)*)"|`([^`\\]*(?:\\.[^`\\]*)*)`/g;
  for (const match of source.matchAll(pattern)) {
    let value = match[1] || match[2] || match[3];
    if (!value || !/\s/.test(value) || value.length > 240) continue;
    if (match[3]) {
      let variableIndex = 0;
      value = value.replace(/\$\{[^}]+\}/g, () => `ZXVAR${String(variableIndex++).padStart(3, '0')}ZX`);
    }
    if (value.includes('${')) continue;
    if (/^(?:https?:|data:|application\/|text\/|\.[/\\]|[/\\]|#[\w-]+|[\w-]+\.(?:js|css|bin|hex|csv|tsv))/.test(value)) continue;
    strings.add(value);
  }
}

for (const fileName of pageFiles) {
  const html = fs.readFileSync(path.join(root, '_site', fileName), 'utf8');
  readStrings(html).forEach((value) => strings.add(value));
}

function readSourceFiles(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) readSourceFiles(filePath);
    else if (entry.isFile() && entry.name.endsWith('.ts')) {
      readTypeScriptStrings(fs.readFileSync(filePath, 'utf8'));
    }
  }
}

readSourceFiles(path.join(root, 'src'));

strings.add('Language');
const orderedStrings = [...strings].sort((left, right) => left.localeCompare(right, 'de'));
const languages = ['en', 'nl', 'pl'];
const overrides = require('../src/locales/overrides.json');
const protectedTerms = [
  'Automatenunsinn', 'Merkur', 'Bally-Wulff', 'Bally Wulff', 'NSM-Löwen',
  'ADP', 'ATmega48', 'ATmega', 'EPROM', 'EEPROM', 'NVRAM', 'PTB',
  'VDAI', 'WebSerial', 'Web Serial', 'Timekeeper'
];

function protectTerms(value) {
  const replacements = [];
  let protectedValue = value;
  protectedTerms.forEach((term, index) => {
    const token = `ZXT${String(index).padStart(3, '0')}XZT`;
    if (protectedValue.includes(term)) {
      protectedValue = protectedValue.split(term).join(token);
      replacements.push([token, term]);
    }
  });
  for (const match of protectedValue.matchAll(/ZXVAR\d{3}ZX/g)) {
    replacements.push([match[0], match[0]]);
  }
  return { value: protectedValue, replacements };
}

async function translate(language, values) {
  const translated = {};
  const chunks = [];
  let chunk = [];
  let length = 0;

  for (const value of values) {
    const encodedLength = value.length + 32;
    if (length + encodedLength > 2500 && chunk.length) {
      chunks.push(chunk);
      chunk = [];
      length = 0;
    }
    chunk.push(value);
    length += encodedLength;
  }
  if (chunk.length) chunks.push(chunk);

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const current = chunks[chunkIndex];
    const marker = (index) => `ZXQ${String(index).padStart(5, '0')}ZXQ`;
    const protectedStrings = current.map(protectTerms);
    const endMarker = (index) => `ZXR${String(index).padStart(5, '0')}ZXR`;
    const source = protectedStrings.map(({ value }, index) =>
      `${marker(index)}${value}${endMarker(index)}`
    ).join('\n');
    const params = new URLSearchParams({ client: 'gtx', sl: 'de', tl: language, dt: 't' });
    params.set('q', source);
    const response = await fetch(`https://translate.googleapis.com/translate_a/single?${params}`);
    if (!response.ok) throw new Error(`Translation request failed with ${response.status}`);
    const result = await response.json();
    const output = (result[0] || []).map((part) => part[0]).join('');
    current.forEach((value, index) => {
      const match = output.match(new RegExp(`${marker(index)}([\\s\\S]*?)${endMarker(index)}`));
      if (!match) {
        translated[value] = value;
        return;
      }
      let translatedValue = match[1].trim();
      for (const [token, term] of protectedStrings[index].replacements) {
        translatedValue = translatedValue.split(token).join(term);
      }
      translated[value] = translatedValue;
    });
    process.stdout.write(`${language} ${chunkIndex + 1}/${chunks.length}\n`);
  }

  return translated;
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  for (const language of languages) {
    const catalog = await translate(language, orderedStrings);
    Object.assign(catalog, overrides[language]);
    fs.writeFileSync(
      path.join(outputDir, `${language}.json`),
      `${JSON.stringify(catalog, null, 2)}\n`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
