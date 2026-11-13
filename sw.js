// Service Worker: إشعارات الدفع + تسريع التحميل (ذاكرة مؤقتة لهيكل التطبيق والمكتبات)
const V='wasalni-v5',SHELL=['/','/icon-192.png','/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).catch(()=>{}));self.skipWaiting()});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);
 if(u.origin===location.origin){if(u.pathname.startsWith('/api/')||u.pathname==='/health'||/^\/(admin|audit)\.html$/.test(u.pathname)||u.pathname==='/sw.js')return;
  // هيكل التطبيق: يُعرض فوراً من الذاكرة ثم يُحدَّث في الخلفية
  e.respondWith(caches.open(V).then(async c=>{const hit=await c.match(r,{ignoreSearch:true});const net=fetch(r).then(x=>{if(x.ok)c.put(r.mode==='navigate'?'/':r,x.clone());return x}).catch(()=>hit);return hit||net}));return}
 // مكتبات وخطوط خارجية: من الذاكرة أولاً
 if(/(unpkg\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(u.hostname))e.respondWith(caches.open(V).then(async c=>{const hit=await c.match(r);if(hit)return hit;const x=await fetch(r);if(x.ok||x.type==='opaque')c.put(r,x.clone());return x}))});
self.addEventListener('push',e=>{let d={};try{d=e.data.json()}catch{}e.waitUntil(self.registration.showNotification(d.title||'وصلني',{body:d.body||'',icon:'/icon-192.png',badge:'/icon-192.png',dir:'rtl',lang:'ar',vibrate:[200,100,200],data:{url:d.url||'/'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{for(const c of l)if('focus' in c)return c.focus();return clients.openWindow(e.notification.data.url||'/')}))});
