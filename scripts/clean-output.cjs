const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.resolve(__dirname, '../_site');
fs.rmSync(outputDir, { recursive: true, force: true });
