(function () {
  var language = document.documentElement.lang;
  if (language !== 'en' && language !== 'nl' && language !== 'pl') return;

  fetch('/locales/' + language + '.json')
    .then(function (response) { return response.json(); })
    .then(function (translations) {
      var dynamicPatterns = Object.keys(translations)
        .filter(function (key) {
          return /ZXVAR\d{3}ZX/.test(key) &&
            key.replace(/ZXVAR\d{3}ZX/g, '').trim().length > 3 &&
            !key.includes('${');
        })
        .map(function (key) {
          var variables = key.match(/ZXVAR\d{3}ZX/g) || [];
          var parts = key.split(/ZXVAR\d{3}ZX/);
          var pattern = '^' + parts.map(function (part) {
            return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          }).join('([\\s\\S]*?)') + '$';
          return {
            expression: new RegExp(pattern),
            variables: variables,
            translation: translations[key]
          };
        });

      function translated(value) {
        var leading = value.match(/^\s*/)[0];
        var trailing = value.match(/\s*$/)[0];
        var key = value.trim();
        if (translations[key]) return leading + translations[key] + trailing;
        for (var index = 0; index < dynamicPatterns.length; index++) {
          var dynamicPattern = dynamicPatterns[index];
          var match = key.match(dynamicPattern.expression);
          if (!match) continue;
          var translatedParts = dynamicPattern.translation.split(/ZXVAR\d{3}ZX/);
          var output = translatedParts[0];
          for (var partIndex = 0; partIndex < dynamicPattern.variables.length; partIndex++) {
            output += match[partIndex + 1] + translatedParts[partIndex + 1];
          }
          return leading + output + trailing;
        }
        return value;
      }

      function translateLines(value) {
        return value.split('\n').map(translated).join('\n');
      }

      function translateNode(node) {
        if (node.nodeType === Node.TEXT_NODE) {
          var parentName = node.parentElement && node.parentElement.tagName;
          if (parentName !== 'SCRIPT' && parentName !== 'STYLE') {
            var value = translated(node.nodeValue);
            if (value !== node.nodeValue) node.nodeValue = value;
          }
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;

        ['alt', 'aria-label', 'placeholder', 'title'].forEach(function (name) {
          if (node.hasAttribute(name)) {
            var value = translated(node.getAttribute(name));
            if (value !== node.getAttribute(name)) node.setAttribute(name, value);
          }
        });
        Array.prototype.forEach.call(node.childNodes, translateNode);
      }

      translateNode(document.documentElement);
      [window.HTMLTextAreaElement, window.HTMLInputElement].forEach(function (ElementType) {
        if (!ElementType) return;
        var descriptor = Object.getOwnPropertyDescriptor(ElementType.prototype, 'value');
        if (!descriptor || !descriptor.get || !descriptor.set) return;
        Object.defineProperty(ElementType.prototype, 'value', {
          configurable: descriptor.configurable,
          enumerable: descriptor.enumerable,
          get: descriptor.get,
          set: function (value) {
            var type = this.getAttribute('type');
            if (this.tagName === 'TEXTAREA' || type === 'button' || type === 'submit' || type === 'reset') {
              value = translateLines(String(value));
            }
            descriptor.set.call(this, value);
          }
        });
      });
      var observer = new MutationObserver(function (records) {
        records.forEach(function (record) {
          if (record.type === 'characterData') translateNode(record.target);
          if (record.type === 'childList') {
            Array.prototype.forEach.call(record.addedNodes, translateNode);
          }
          if (record.type === 'attributes') translateNode(record.target);
        });
      });
      observer.observe(document.documentElement, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['alt', 'aria-label', 'placeholder', 'title']
      });
    })
    .catch(function (error) {
      console.error('Could not load the page translations.', error);
    });
})();
