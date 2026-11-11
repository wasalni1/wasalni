// Service Worker بسيط: يمرّر كل الطلبات للشبكة (التطبيق يحتاج اتصالاً دائماً)
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(clients.claim()));
self.addEventListener('fetch',e=>{});
