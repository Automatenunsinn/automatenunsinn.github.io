"use strict";
// Keep sw.js at its original URL so existing registrations can update.
// Retire the old offline cache without intercepting any more requests.
self.addEventListener("install", (event) => {
    event.waitUntil(self.skipWaiting());
});
self.addEventListener("activate", (event) => {
    event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((name) => name.startsWith("automatenunsinn-"))
        .map((name) => caches.delete(name)))).then(() => {
        // Replace the old controller, but do not reload open tabs: a serial
        // read/write operation may be in progress. The next refresh is fresh.
        return self.clients.claim();
    }).then(() => self.registration.unregister()));
});
