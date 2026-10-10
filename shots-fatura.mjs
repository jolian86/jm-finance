// leitura da fatura (resposta da IA simulada): node shots-fatura.mjs URL [webkit]
import { chromium, webkit } from 'playwright';
const U=process.argv[2]||'http://localhost:4199/';const BT=process.argv[3]==='webkit'?webkit:chromium;
const sizes=[[375,667],[390,844],[360,740],[412,915],[430,932],[820,1180],[1366,768]];const fails=[];let n=0;const ok=(c,m)=>{n++;if(!c)fails.push(m)};const wait=t=>new Promise(r=>setTimeout(r,t));
const BILL={notABill:false,cardName:'Banco Roxo',dueDate:'15/11/2026',total:2043.44,charges:0,purchases:[['02/10','SUPERMERCADO BOM PRECO',412.37,'','mercado'],['03/10','IFOOD *RESTAURANTE',58.9,'','delivery'],['05/10','NETFLIX.COM',44.9,'','assinaturas'],['06/10','POSTO SHELL AV BRASIL',220,'','combustivel'],['08/10','DROGASIL 1234',87.45,'','saude'],['09/10','MAGAZINE LUIZA PARC 03/10',149.9,'03/10','compras'],['11/10','SPOTIFY',21.9,'','assinaturas'],['12/10','UBER *TRIP',32.5,'','combustivel'],['14/10','ATACADAO',356.2,'','mercado'],['15/10','RAPPI*LANCHES',41,'','delivery'],['18/10','CINEMARK',64,'','lazer'],['20/10','RENNER LOJA 22',189.99,'','compras'],['21/10','CASAS BAHIA PARC 07/12',233.33,'07/12','compras'],['22/10','IFOOD *PIZZARIA',72.5,'','delivery'],['25/10','AMAZON PRIME',19.9,'','assinaturas'],['27/10','PADARIA PAO QUENTE',38.6,'','mercado']].map(([date,description,amount,installment,category])=>({date,description,amount,installment,category}))};
const b=await BT.launch();
for(const [w,h] of sizes)for(const scheme of ['light','dark']){const tag=`${w}x${h} ${scheme}`;
 const ctx=await b.newContext({viewport:{width:w,height:h},colorScheme:scheme,serviceWorkers:'block'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 let mode='ok';let sent=0;
 await p.route('**/api/fatura',async r=>{sent=r.request().postData().length;await wait(400);mode==='ok'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({bill:BILL,remaining:2})}):r.fulfill({status:429,contentType:'application/json',body:'{"error":"daily_limit","limit":3}'})});
 await p.goto(U+'?nosplash');await p.evaluate(()=>{localStorage.clear();localStorage.setItem('jm:themePicked','1')});await p.reload();await wait(500);
 await p.click('.welcome .accept');await p.locator('.welcome .btn').last().click();await wait(500);
 await p.click('text=Carregar dados de EXEMPLO');await wait(700);
 await p.evaluate(()=>{const d=JSON.parse(localStorage.getItem('jmfinance:data'));d.isExample=false;d.expenses.push({id:'card1',name:'Fatura Nubank',amount:1800,category:'cartao',kind:'variavel'});localStorage.setItem('jmfinance:data',JSON.stringify(d));sessionStorage.setItem('jm:openCard','card1')});
 await p.reload();await wait(500);await p.locator('nav button').nth(1).click();await wait(900);
 const btn=p.locator('.fat-read .photo-bill');ok(await btn.count()===1,`${tag}: sem botão`);
 if(!await btn.count()){await ctx.close();continue}
 await p.locator('.fat-read input[type=file]').setInputFiles(['/workspace/fat/nubank-1.png']);await wait(1500);
 const sh=p.locator('.fat-sheet');ok(await sh.isVisible(),`${tag}: revisão não abriu`);ok(sent>1000&&sent<2_000_000,`${tag}: envio ${sent}`);
 ok(await p.locator('.fat-list li').count()===16,`${tag}: itens`);ok(/2 parcelamentos e 3 assinaturas/.test(await sh.innerText()),`${tag}: flags`);
 const ov=await p.evaluate(()=>{const s=document.querySelector('.fat-sheet');return s.scrollWidth>s.clientWidth+1});ok(!ov,`${tag}: revisão estoura na largura`);
 if(w===390)await p.screenshot({path:`screenshots/v16/fatura-revisao-${scheme}-390x844.png`});
 await p.locator('.fat-list li').nth(0).locator('select').selectOption('compras');
 const ab=await p.locator('.fat-sheet .modal-actions .btn:not(.ghost)').boundingBox();ok(ab&&ab.y+ab.height<=h+1,`${tag}: botão usar fora da tela`);
 await p.locator('.fat-sheet .modal-actions .btn:not(.ghost)').click();await wait(600);
 const e=await p.evaluate(()=>JSON.parse(localStorage.getItem('jmfinance:data')).expenses.find(x=>x.id==='card1'));
 ok(e.amount===2043.44&&e.dueDay===15&&e.split.parcelas===383.23&&e.split.mercado===394.8&&e.split.compras===602.36&&e.bill.subs.length===3,`${tag}: salvo errado ${JSON.stringify(e)}`);
 ok(/Pronto! Fatura de/.test(await p.locator('.fat-ok').innerText()),`${tag}: sem confirmação`);
 if(w===390)await p.locator('.card-split').screenshot({path:`screenshots/v16/fatura-separada-${scheme}-390x844.png`});
 mode='429';await p.locator('.fat-read input[type=file]').setInputFiles(['/workspace/fat/itau.pdf']);await wait(1200);
 ok(/3 leituras de fatura de hoje/.test(await p.locator('.fat-err').innerText().catch(()=>'')),`${tag}: erro de limite`);
 ok(!errs.length,`${tag}: erros ${errs}`);await ctx.close();console.log(tag,fails.length)}
await b.close();console.log(fails.join('\n'));console.log(`${n-fails.length}/${n} ok`);
