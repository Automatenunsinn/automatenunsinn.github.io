"use strict";
module.exports = {
    eleventyComputed: {
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
