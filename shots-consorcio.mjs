// Objetivos: juntar × financiar × consórcio. node shots-consorcio.mjs URL [webkit]
import { chromium, webkit } from 'playwright';
const U=process.argv[2]||'http://localhost:4199/';const BT=process.argv[3]==='webkit'?webkit:chromium;
const sizes=[[375,667],[390,844],[360,740],[412,915],[430,932],[820,1180],[1366,768]];const fails=[];let n=0;const ok=(c,m)=>{n++;if(!c)fails.push(m)};const wait=t=>new Promise(r=>setTimeout(r,t));
const b=await BT.launch();
for(const [w,h] of sizes)for(const scheme of ['light','dark']){const tag=`${w}x${h} ${scheme}`;
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto(U+'?nosplash');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('jm:themePicked','1')});await p.reload();await wait(500);
 await p.click('.welcome .accept');await p.locator('.welcome .btn').last().click();await wait(500);
 await p.click('text=Carregar dados de EXEMPLO');await wait(700);
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('jmfinance:data'));d.isExample=false;d.goals=[{id:'car',name:'Carro',type:'compra',target:65000,saved:5000,date:'2030-01',priority:'media'},{id:'casa',name:'Casa própria',type:'outro',target:350000,saved:50000,date:'2040-01',priority:'baixa'},{id:'via',name:'Viagem',type:'viagem',target:6000,saved:0,date:'2027-06',priority:'baixa'}];localStorage.setItem('jmfinance:data',JSON.stringify(d))});
 await p.reload();await wait(500);await p.locator('nav button').nth(3).click();await wait(800);
 ok(await p.locator('.buy-ways').count()===2,`${tag}: deveria ter 2 comparações (carro, casa), tem ${await p.locator('.buy-ways').count()}`);
 const car=p.locator('.card.goal').nth(0).locator('.buy-ways');await car.locator('.adv-toggle').first().click();await wait(400);
 const t=(await car.innerText()).replace(/\u00a0/g,' ');
 ok(/Consórcio/.test(t)&&/Financiamento/.test(t)&&/Juntar e comprar à vista/.test(t),`${tag}: colunas`);
 ok(/R\$ 1\.170,00\/mês/.test(t)&&/de juros/.test(t)&&/contemplado/.test(t)&&/lance/.test(t)&&/Banco Central/.test(t),`${tag}: textos ${t.slice(0,300)}`);
 ok(!/\b(Porto|Embracon|Rodobens|Itaú|Bradesco|Caixa|Santander)\b/.test(t),`${tag}: cita empresa`);
 const ov=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);ok(!ov,`${tag}: estoura largura`);
 await car.locator('.adv .adv-toggle').click();await wait(300);const inp=car.locator('input[aria-label="Taxa de administração (total)"]');await inp.fill('20');await inp.blur();await wait(300);
 ok(/R\$ 73\.200,00/.test((await car.innerText()).replace(/\u00a0/g,' ')),`${tag}: ajuste de taxa não recalculou`);
 if(w===390||w===1366){await car.scrollIntoViewIfNeeded();await p.screenshot({path:`screenshots/v16/consorcio-${scheme}-${w}x${h}.png`,fullPage:false});await car.screenshot({path:`screenshots/v16/consorcio-card-${scheme}-${w}x${h}.png`})}
 ok(!errs.length,`${tag}: erros ${errs}`);await ctx.close();}
await b.close();console.log(fails.join('\n'));console.log(`${n-fails.length}/${n} ok`);
