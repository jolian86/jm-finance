const C='jmfinance-v5';
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(C).then(c=>c.addAll(['./','./index.html','./manifest.webmanifest','./icons/icon-192.png'])))});
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==C&&k!=='jm-reminders').map(k=>caches.delete(k)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET'||new URL(e.request.url).pathname.includes('/api/'))return;e.respondWith(fetch(e.request).then(r=>{const cp=r.clone();caches.open(C).then(c=>c.put(e.request,cp));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))))});

// Clique na notificação: foca o app (ou abre) na tela do alerta
self.addEventListener('notificationclick',e=>{e.notification.close();const url=(e.notification.data&&e.notification.data.url)||'./';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{for(const w of ws){if('focus' in w){w.navigate(url);return w.focus()}}return clients.openWindow(url)}))});

// Periodic Background Sync (Chrome/Android com app instalado): lembra vencimentos sem abrir o app.
// Sem servidor: o app grava no Cache Storage os lembretes já calculados (3 dias antes e 1 dia útil antes,
// considerando feriados nacionais). A frequência das verificações é decidida pelo sistema.
self.addEventListener('periodicsync',e=>{if(e.tag!=='jm-reminders')return;e.waitUntil((async()=>{
  const c=await caches.open('jm-reminders');const r=await c.match('reminders.json');if(!r)return;const j=await r.json();if(!j.enabled)return;
  const sR=await c.match('shown.json');const shown=sR?await sR.json():{};
  const d=new Date();const p=n=>String(n).padStart(2,'0');const today=d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());
  // respeita o horário preferido do usuário (não notifica antes dele)
  const [hh,mm]=(j.alertTime||'09:00').split(':').map(Number);if(d.getHours()*60+d.getMinutes()<hh*60+mm)return;
  for(const it of j.reminders||[]){if(it.show>today||it.due<today||shown[it.key])continue;
    await self.registration.showNotification('JM Finance · '+it.title,{body:it.body,tag:it.key,icon:'icons/icon-192.png',data:{url:it.url}});shown[it.key]=1}
  await c.put('shown.json',new Response(JSON.stringify(shown)));
})())});
