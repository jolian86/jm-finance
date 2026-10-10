import { chromium, webkit, devices } from 'playwright';
const URL=process.argv[2]||'http://localhost:4199/';
const sizes0=[[375,667],[390,844],[360,740],[412,915],[430,932],[820,1180],[1366,768]];const sizes=process.env.S?sizes0.filter(s=>process.env.S.split(',').includes(String(s[0]))):sizes0;const fails=[];let n=0;
const ok=(c,m)=>{n++;if(!c)fails.push(m)};const wait=t=>new Promise(r=>setTimeout(r,t));
for(const [bn,bt] of [['webkit',webkit],['chromium',chromium]]){const b=await bt.launch();
for(const [w,h] of sizes){for(const scheme of (w===390||process.env.BOTH?['light','dark']:[w%2?'dark':'light'])){const mob=w<800;
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,hasTouch:mob,isMobile:mob&&bn==='chromium',userAgent:mob?devices['iPhone 13'].userAgent:undefined});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/api/chat',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:'{"configured":true}'}):r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({reply:'Resposta de teste da IA. '.repeat(40),remaining:3})}));
 await p.addInitScript(()=>{localStorage.setItem('jm:themePicked','1');sessionStorage.setItem('jm:splash','1')});
 await p.goto(URL);await p.click('.welcome .accept');await p.locator('.welcome .btn').last().click();await wait(500);
 await p.evaluate(()=>window.scrollTo(0,400));
 const tag=`${bn} ${w}x${h} ${scheme}`;const tap=async l=>mob?l.tap():l.click();
 const openSend=async(kb)=>{await tap(p.locator('.fab'));await wait(450);for(const q of ['oi','como melhorar minha nota?']){await p.locator('.chat-input input').fill(q);await tap(p.locator('.chat-input button'));await wait(900);}
  if(kb)await p.locator('.chat-input input').focus();else await p.locator('.chat-input input').blur();await wait(250);
  const hb=await p.locator('.chat-back').boundingBox();ok(hb&&hb.y>=0&&hb.y<h,`${tag}: seta fora da tela ${JSON.stringify(hb)}`)};
 for(const [i,lab] of [[1,'Meus dados'],[3,'Objetivos'],[4,'Plano'],[0,'Início'],[2,'Diagnóstico']]){await openSend(i%2===0);
  await p.locator('.chat-input input').blur();await wait(250);
  await tap(p.locator('nav button').nth(i));await wait(600);ok(await p.locator('.chat').count()===0,`${tag}: aba ${lab} não fechou o chat`);
  ok((await p.locator('nav button.on').innerText()).includes(lab),`${tag}: aba ${lab} não ativou`);}
 await openSend(false);await tap(p.locator('.chat-back'));await wait(600);ok(await p.locator('.chat').count()===0,`${tag}: seta não fechou`);
 await openSend(true);await p.goBack().catch(()=>{});await wait(600);ok(await p.locator('.chat').count()===0,`${tag}: voltar do navegador não fechou`);ok(p.url().startsWith(URL.replace(/\/$/,'')),`${tag}: saiu do app ${p.url()}`);
 await openSend(false);const ib=await p.locator('.chat-input').boundingBox(),nb=await p.locator('nav').boundingBox();ok(ib&&nb&&ib.y+ib.height<=nb.y+2,`${tag}: input sob a barra`);
 if(w===390&&bn==='webkit')await p.screenshot({path:`screenshots/v15/chat-nav-${scheme}-390x844.png`});
 ok(!errs.length,`${tag}: erros ${errs}`);console.log(tag,fails.length);await ctx.close();}}
await b.close();}
console.log(fails.slice(0,15).join('\n'));console.log(`${n-fails.length}/${n} ok`);
