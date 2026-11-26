const fs = require('node:fs');
const path = require('node:path');
const { renderTeileTable } = require('./scripts/render-teile-table.cjs');

const root = __dirname;
const footerHtml = fs.readFileSync(path.join(root, 'src/footer.html'), 'utf8');
const darkHtml = fs.readFileSync(path.join(root, 'src/dark.html'), 'utf8');
const teileTableHtml = renderTeileTable(
  fs.readFileSync(path.join(root, 'src/teile.tsv'), 'utf8')
);
const importMap = {
  imports: {
    crc: '/vendor/crc.js',
    'crypto-js/core': '/vendor/crypto-core.js',
    'crypto-js/md5': '/vendor/crypto-md5.js',
    events: '/vendor/events.js',
    'intel-hex': '/vendor/intel-hex.js',
    jquery: '/vendor/jquery.js',
    papaparse: '/vendor/papaparse.js',
    stk500: '/vendor/stk500.js',
    'stk500/lib/statics': '/vendor/stk500-statics.js',
    buffer: '/vendor/buffer.js'
  }
};

module.exports = function (eleventyConfig) {
  eleventyConfig.ignores.add('./src/pages/pages.11tydata.js');
  eleventyConfig.addCollection('htmlPages', (collectionApi) =>
    collectionApi.getFilteredByGlob('**/*.html')
  );
  eleventyConfig.addFilter('isoDate', (date) => date.toISOString());

  eleventyConfig.addPassthroughCopy({ 'public/img': 'img' });
  eleventyConfig.addPassthroughCopy({ 'public/hex': 'hex' });
  eleventyConfig.addPassthroughCopy({ 'public/favicon.ico': 'favicon.ico' });
  eleventyConfig.addPassthroughCopy({ 'public/favicon.png': 'favicon.png' });
  eleventyConfig.addPassthroughCopy({ 'public/manifest.json': 'manifest.json' });
  eleventyConfig.addPassthroughCopy({ 'src/sw.js': 'sw.js' });
  eleventyConfig.addPassthroughCopy({ 'src/listcrc.tsv': 'listcrc.tsv' });
  eleventyConfig.addPassthroughCopy({ 'src/ptb.csv': 'ptb.csv' });

  eleventyConfig.addTransform('site-shell', function (content) {
    if (!this.page.outputPath || !this.page.outputPath.endsWith('.html')) return content;

    content = content.replace(
      '<div id="table-container"></div>',
      `<div id="table-container">${teileTableHtml}</div>`
    );
    content = content.replace(
      /<script(?=[^>]*\bsrc=)(?![^>]*\btype=)/g,
      '<script type="module"'
    );
    if (/<script type="module"/.test(content)) {
      content = content.replace(
        /<head([^>]*)>/,
        `<head$1>\n<script type="importmap">${JSON.stringify(importMap)}</script>`
      );
    }
    return content.replace('</body>', `${footerHtml}${darkHtml}</body>`);
  });

  return {
    dir: {
      input: 'src/pages',
      output: '_site'
    },
    cleanOutputDir: true,
    templateFormats: ['html', 'njk'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk',
    dataTemplateEngine: 'njk'
  };
};
