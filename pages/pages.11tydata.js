"use strict";
const stylesheets = { 'bw.html': 'bw.css', 'dbwrite.html': 'style.css' };
module.exports = {
    eleventyComputed: {
        description: (data) => data.description,
        title: (data) => data.title,
        stylesheet: (data) => stylesheets[data.page.inputPath.split('/').pop()] || 'style.css',
        image: (data) => data.image,
        mathSolver: (data) => data.mathSolver || ['zl.html', 'pt.html', 'roul.html'].includes(data.page.inputPath.split('/').pop()),
        script: (data) => {
            const file = data.page.inputPath.split('/').pop();
            const scripts = { atmega: 'atmega.js', bpatcher: 'bpatcher.js', bw: 'bally.js', dbwrite: 'dbwrite.js', game: 'game.js', isp: 'isp.js', pt: 'pt.js', readout: 'readout.js', roul: 'roul.js', sound: 'sound.js', splitter: 'splitter.js', st25: 'st25.js', teileliste: 'teileliste.js', tk: 'tk.js', vdai: 'vdai.js', zl: 'zl.js', zlk: 'zlk.js' };
            return scripts[file.replace('.html', '')];
        },
        defer: true,
        permalink: (data) => {
            const fileName = data.page.inputPath.split('/').pop();
            if (fileName === 'sitemap.xml.njk')
                return 'sitemap.xml';
            if (fileName === 'robots.txt.njk')
                return 'robots.txt';
            return fileName;
        }
    }
};
