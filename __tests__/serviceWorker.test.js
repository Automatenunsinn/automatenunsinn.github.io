const fs = require('fs');
const path = require('path');
const vm = require('vm');

function loadWorker() {
  const handlers = {};
  const calls = [];
  const context = {
    self: {
      addEventListener: (type, handler) => { handlers[type] = handler; },
      skipWaiting: jest.fn(() => Promise.resolve()),
      clients: { claim: jest.fn(async () => { calls.push('claim'); }) },
      registration: { unregister: jest.fn(async () => { calls.push('unregister'); }) },
    },
    caches: {
      keys: jest.fn(async () => ['automatenunsinn-v2', 'automatenunsinn-v4',
        'automatenunsinn-3c61720', 'another-app']),
      delete: jest.fn(async (name) => { calls.push(name); return true; }),
    },
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../src/sw.js'), 'utf8'), context
  );
  return { handlers, calls, ...context };
}

test('retirement worker activates without waiting for old tabs to close', async () => {
  const { handlers, self } = loadWorker();
  let pending;
  handlers.install({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  expect(self.skipWaiting).toHaveBeenCalledTimes(1);
});

test('removes historical site caches, releases old controllers and unregisters', async () => {
  const { handlers, calls, caches } = loadWorker();
  let pending;
  handlers.activate({ waitUntil: (promise) => { pending = promise; } });
  await pending;
  expect(calls).toEqual(['automatenunsinn-v2', 'automatenunsinn-v4',
    'automatenunsinn-3c61720', 'claim', 'unregister']);
  expect(caches.delete).not.toHaveBeenCalledWith('another-app');
});

test('never intercepts requests or reloads tabs during serial operations', () => {
  const { handlers } = loadWorker();
  expect(Object.keys(handlers).sort()).toEqual(['activate', 'install']);
});
