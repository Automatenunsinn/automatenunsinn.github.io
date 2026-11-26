const fs = require('node:fs');
const path = require('node:path');
const { parse5, translatedAttributes, walk } = require('./locale-catalog-utils.cjs');

const root = path.resolve(__dirname, '..');
const siteDir = path.join(root, '_site');
const baseUrl = 'https://automatenunsinn.github.io';
const languages = ['en', 'nl', 'pl'];
const pageFiles = fs.readdirSync(siteDir).filter((fileName) => fileName.endsWith('.html'));

function replaceTranslation(value, translations) {
  const leading = value.match(/^\s*/)[0];
  const trailing = value.match(/\s*$/)[0];
  const text = value.trim();
  return translations[text] ? `${leading}${translations[text]}${trailing}` : value;
}

function translateStructuredData(value, translations, language, key = '') {
  if (Array.isArray(value)) {
    return value.map((item) => translateStructuredData(item, translations, language, key));
  }
  if (value && typeof value === 'object') {
    for (const [childKey, childValue] of Object.entries(value)) {
      value[childKey] = translateStructuredData(childValue, translations, language, childKey);
    }
    return value;
  }
  if (typeof value !== 'string') return value;
  if (key === 'inLanguage') return language;
  if (key === '@type' || key === '@context' || key === 'applicationCategory' ||
      key === 'operatingSystem' || key === 'priceCurrency' || key === 'browserRequirements' ||
      key === 'learningResourceType') return rewriteSiteUrl(value, language);
  return rewriteSiteUrl(translations[value] || value, language);
}

function rewriteSiteUrl(value, language) {
  if (!value.startsWith(baseUrl)) return value;
  const url = new URL(value);
  const pagePath = url.pathname === '/' ? '/index.html' : url.pathname;
  return `${baseUrl}/${language}${pagePath}${url.search}${url.hash}`;
}

function localizedPath(value, language) {
  if (/^(?:[a-z]+:|\/\/|#|data:)/i.test(value)) return value;
  const cleanPath = value.replace(/^\.\//, '').replace(/^\//, '');
  if (/\.html(?:[?#].*)?$/i.test(cleanPath)) {
    return `/${language}/${cleanPath}`;
  }
  return `/${cleanPath}`;
}

function isInLanguageMenu(node) {
  for (let parent = node; parent; parent = parent.parentNode) {
    if (parent.tagName === 'nav' && parent.attrs?.some(
      (attribute) => attribute.name === 'class' && attribute.value.includes('language-switcher')
    )) return true;
  }
  return false;
}

function localizePage(html, fileName, language, translations) {
  const document = parse5.parse(html);
  let languageMenu;

  walk(document, (node) => {
    if (node.tagName === 'nav' && node.attrs?.some(
      (attribute) => attribute.name === 'class' && attribute.value.includes('language-switcher')
    )) languageMenu = node;
  });

  walk(document, (node) => {
    if (node.tagName === 'html') {
      const lang = node.attrs.find((attribute) => attribute.name === 'lang');
      if (lang) lang.value = language;
      else node.attrs.push({ name: 'lang', value: language });
    }

    if (node.nodeName === '#text') {
      if (node.parentNode?.tagName === 'script' && node.parentNode.attrs?.some(
        (attribute) => attribute.name === 'type' && attribute.value === 'application/ld+json'
      )) {
        try {
          const data = JSON.parse(node.value);
          node.value = JSON.stringify(translateStructuredData(data, translations, language), null, 2);
        } catch {
          // Leave malformed structured data untouched.
        }
      } else if (node.parentNode?.tagName !== 'script' && node.parentNode?.tagName !== 'style') {
        node.value = replaceTranslation(node.value, translations);
      }
    }

    for (const attribute of node.attrs || []) {
      const isButtonValue = attribute.name === 'value' &&
        ['button', 'submit', 'reset'].includes(node.attrs.find((item) => item.name === 'type')?.value);
      const metaName = node.tagName === 'meta'
        ? node.attrs.find((item) => item.name === 'name')?.value
        : '';
      const metaProperty = node.tagName === 'meta'
        ? node.attrs.find((item) => item.name === 'property')?.value
        : '';
      const shouldTranslateMetaContent = attribute.name !== 'content' ||
        (metaName !== 'viewport' && metaProperty !== 'og:type');
      if ((translatedAttributes.has(attribute.name) && attribute.name !== 'value' && shouldTranslateMetaContent || isButtonValue) &&
          attribute.value.trim()) {
        attribute.value = replaceTranslation(attribute.value, translations);
      }

      if (attribute.name === 'href' && node.tagName === 'link') {
        const rel = node.attrs.find((item) => item.name === 'rel')?.value;
        if (rel === 'canonical') {
          attribute.value = `${baseUrl}/${language}/${fileName}`;
        } else if (rel === 'alternate') {
          const alternateLanguage = node.attrs.find((item) => item.name === 'hreflang')?.value;
          if (alternateLanguage === 'en' || alternateLanguage === 'nl' || alternateLanguage === 'pl') {
            attribute.value = `${baseUrl}/${alternateLanguage}/${fileName}`;
          } else {
            const germanPath = fileName === 'index.html' ? '/' : `/${fileName}`;
            attribute.value = `${baseUrl}${germanPath}`;
          }
        } else {
          attribute.value = localizedPath(attribute.value, language);
        }
      } else if (attribute.name === 'href' && node.tagName === 'a' && !isInLanguageMenu(node)) {
        attribute.value = localizedPath(attribute.value, language);
      } else if (attribute.name === 'src' && !isInLanguageMenu(node)) {
        attribute.value = localizedPath(attribute.value, language);
      }

      if (node.tagName === 'meta' && attribute.name === 'content' &&
          node.attrs.some((item) => item.name === 'property' && item.value === 'og:url')) {
        attribute.value = `${baseUrl}/${language}/${fileName}`;
      }
    }
  });

  if (languageMenu) {
    const currentPath = fileName;
    languageMenu.attrs = languageMenu.attrs.map((attribute) =>
      attribute.name === 'aria-label' ? { ...attribute, value: translations.Language || 'Language' } : attribute
    );
    walk(languageMenu, (node) => {
      for (const attribute of node.attrs || []) {
        if (attribute.name === 'href') {
          const targetLanguage = attribute.value.match(/^\/(en|nl|pl)\//)?.[1];
          attribute.value = targetLanguage ? `/${targetLanguage}/${currentPath}` : `/${currentPath}`;
        }
      }
    });
  }

  return parse5.serialize(document);
}

for (const language of languages) {
  const translations = JSON.parse(fs.readFileSync(path.join(root, `src/locales/${language}.json`), 'utf8'));
  const outputDir = path.join(siteDir, language);
  fs.mkdirSync(outputDir, { recursive: true });
  for (const fileName of pageFiles) {
    const source = fs.readFileSync(path.join(siteDir, fileName), 'utf8');
    const localized = localizePage(source, fileName, language, translations);
    fs.writeFileSync(path.join(outputDir, fileName), localized);
  }
}
