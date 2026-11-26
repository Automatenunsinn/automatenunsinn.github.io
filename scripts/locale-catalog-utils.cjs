const parse5 = require('parse5');

const translatedAttributes = new Set([
  'alt',
  'aria-label',
  'content',
  'placeholder',
  'title',
  'value'
]);

function walk(node, visitor) {
  visitor(node);
  for (const child of node.childNodes || []) walk(child, visitor);
  if (node.content) walk(node.content, visitor);
}

function readStrings(html) {
  const strings = new Set();
  const document = parse5.parse(html);

  walk(document, (node) => {
    let insidePartsTable = false;
    for (let parent = node; parent; parent = parent.parentNode) {
      if (parent.tagName === 'tbody' && parent.parentNode?.tagName === 'table' && parent.parentNode.attrs?.some(
        (attribute) => attribute.name === 'id' && attribute.value === 'csv-table'
      )) {
        insidePartsTable = true;
        break;
      }
    }
    if (insidePartsTable) return;

    if (node.nodeName === '#text') {
      const text = node.value.trim();
      if (text && node.parentNode?.tagName !== 'script' && node.parentNode?.tagName !== 'style') {
        strings.add(text);
      }
      if (node.parentNode?.tagName === 'script' && node.parentNode.attrs?.some(
        (attribute) => attribute.name === 'type' && attribute.value === 'application/ld+json'
      )) {
        try {
          collectJsonStrings(JSON.parse(node.value), strings);
        } catch {
          // Invalid or partial structured data is left to the browser unchanged.
        }
      }
    }

    for (const attribute of node.attrs || []) {
      const isButtonValue = attribute.name === 'value' &&
        ['button', 'submit', 'reset'].includes(node.attrs?.find(
          (item) => item.name === 'type'
        )?.value);
      if ((translatedAttributes.has(attribute.name) && attribute.name !== 'value' || isButtonValue) && attribute.value.trim()) {
        strings.add(attribute.value.trim());
      }
    }
  });
  return strings;
}

function collectJsonStrings(value, strings) {
  if (typeof value === 'string') {
    if (value.trim()) strings.add(value.trim());
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectJsonStrings(item, strings));
    return;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectJsonStrings(item, strings));
  }
}

module.exports = { parse5, translatedAttributes, walk, readStrings };
