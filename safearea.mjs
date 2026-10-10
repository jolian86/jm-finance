import { webkit, chromium, devices } from 'playwright';
const U=process.argv[2]||'http://localhost:4199/';const sizes=[[375,667],[390,844],[360,740],[412,915],[430,932],[820,1180],[1366,768]];const fails=[];let n=0;const ok=(c,m)=>{n++;if(!c)fails.push(m)};const wait=t=>new Promise(r=>setTimeout(r,t));
for(const [bn,bt] of (process.env.B==='c'?[['chromium',chromium]]:process.env.B==='w'?[['webkit',webkit]]:[['webkit',webkit],['chromium',chromium]])){const b=await bt.launch();
for(const [w,h] of sizes)for(const scheme of ['light','dark']){const tag=`${bn} ${w}x${h} ${scheme}`;const mob=w<800;
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,serviceWorkers:'block',hasTouch:mob,userAgent:mob?devices['iPhone 13'].userAgent:undefined});const p=await ctx.newPage();
 await p.route('**/api/chat',r=>r.fulfill({status:503,contentType:'application/json',body:'{"error":"not_configured"}'}));
 await p.addInitScript(()=>{localStorage.setItem('jm:themePicked','1');sessionStorage.setItem('jm:splash','1')});
 await p.goto(U);await p.click('.welcome .accept');await p.locator('.welcome .btn').last().click();await wait(400);
 // simula área segura do iPhone (34px embaixo, 47px em cima)
 await p.addStyleTag({content:'nav{padding-bottom:calc(6px + 34px)!important}.chat-head{padding-top:calc(10px + 47px)!important}'});await wait(1300);
 await p.locator('.fab').click();await wait(500);
 for(const q of ['oi','como melhorar minha nota?','onde estou gastando muito?']){await p.locator('.chat-input input').fill(q);await p.locator('.chat-input button').click();await wait(700)}
 for(const kb of [true,false]){ if(kb)await p.locator('.chat-input input').focus();else await p.locator('.chat-input input').blur();await wait(1200);
  const ib=await p.locator('.chat-input').boundingBox(),nb=await p.locator('nav').boundingBox();
  ok(ib&&nb&&ib.y+ib.height<=nb.y+1,`${tag} kb=${kb}: input ${ib&&Math.round(ib.y+ib.height)} > barra ${nb&&Math.round(nb.y)}`);
  const vis=await p.evaluate(()=>[...document.querySelectorAll('nav button')].every(bt=>{const r=bt.getBoundingClientRect();const el=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return el&&bt.contains(el)}));ok(vis,`${tag} kb=${kb}: abas cobertas`);
  const hb=await p.locator('.chat-back').boundingBox();ok(hb&&hb.y>=0,`${tag}: seta fora`);}
 if(w===390&&bn==='webkit')await p.screenshot({path:`screenshots/v16/chat-safearea-${scheme}-390x844.png`});
 await p.locator('nav button').nth(2).click();await wait(500);ok(await p.locator('.chat').count()===0,`${tag}: aba não fechou`);
 await ctx.close();}
await b.close();}
console.log(fails.join('\n'));console.log(`${n-fails.length}/${n} ok`);
