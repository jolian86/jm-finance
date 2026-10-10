import { chromium, webkit } from 'playwright';
const U=process.argv[2];const sizes=[[375,667],[390,844],[360,740],[412,915],[430,932],[820,1180],[1366,768]];const fails=[];let n=0;const ok=(c,m)=>{n++;if(!c)fails.push(m)};const w8=t=>new Promise(r=>setTimeout(r,t));
const BT=process.argv[3]==='webkit'?webkit:chromium;const b=await BT.launch();
for(const [w,h] of (process.argv[4]==='one'?[[390,844]]:sizes))for(const scheme of ['light','dark']){const tag=`${w}x${h} ${scheme}`;
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,acceptDownloads:true,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{localStorage.setItem('jm:themePicked','1')});await p.goto(U);await w8(1500);
 const m=p.locator('.moved-wrap');ok(await m.isVisible(),`${tag}: aviso não apareceu`);
 const t=await m.innerText().catch(()=>'');ok(/app\.jmfinance\.com\.br/.test(t)&&/Adicionar à Tela de Início/.test(t)&&/Instalar app/.test(t),`${tag}: texto`);
 const bb=await p.locator('.moved-card').boundingBox();ok(bb&&bb.x>=0&&bb.x+bb.width<=w+1,`${tag}: largura`);
 const [dl]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),m.locator('button',{hasText:'Exportar backup'}).click()]);ok(!!dl,`${tag}: sem download`);
 if(w===390)await p.screenshot({path:`screenshots/v16/moved-${scheme}-390x844.png`});
 await m.locator('button',{hasText:'Agora não'}).click();await w8(400);ok(await m.count()===0,`${tag}: não fechou`);
 ok(await p.locator('.moved').count()===1||await p.locator('.welcome').count()>0,`${tag}: sem faixa pequena`);
 ok(!errs.length,`${tag}: ${errs}`);await ctx.close();}
await b.close();console.log(fails.join('\n'));console.log(`${n-fails.length}/${n} ok`);
