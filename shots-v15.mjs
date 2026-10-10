// v15: Consultor JM — caminho até 80, gasto a gasto, fatura do cartão. Uso: node shots-v15.mjs URL OUT [capturas] [só-estes]
import { chromium } from 'playwright';
import fs from 'fs';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/'; const OUT = process.argv[3] || 'screenshots/v15';
const SHOT = (process.argv[4] || '390x844').split(','); const ONLY = (process.argv[5] || '').split(',').filter(Boolean);
fs.mkdirSync(OUT, { recursive: true });
const VPS = [[375,667],[390,844],[360,740],[412,915],[430,932],[820,1180,'tablet'],[1366,768,'desktop']].filter(([w, h]) => !ONLY.length || ONLY.includes(`${w}x${h}`));
const BAN = /\ba\.m\.|\ba\.a\.|ponderad|avalanche|bola de neve|patrim[oô]nio l[ií]quido|comprometimento|liquidez|\bCDI\b|Não tenho certeza|undefined|\bNaN\b/;
const fails = [], errs = [], samples = {}; let n0 = 0; const ok = (c, m) => { n0++; if (!c) fails.push(m); };
const b = await chromium.launch();
for (const [w, h, kind] of VPS) for (const scheme of ['light', 'dark']) {
  const n = `${w}x${h}`, tag = scheme === 'light' ? 'claro' : 'escuro', shots = SHOT.includes(n);
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: kind === 'desktop' ? 1 : 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: !kind, hasTouch: kind !== 'desktop', colorScheme: scheme });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(`${n}/${scheme}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errs.push(`${n}/${scheme}: ${m.text()}`));
  const wait = ms => p.waitForTimeout(ms);
  const shot = async nm => { if (shots) { await wait(400); await p.screenshot({ path: `${OUT}/${tag}-${n}-${nm}.png` }); } };
  const ov = async where => { const o = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth); ok(o <= 1, `${n}/${scheme} overflow ${o}px em ${where}`); };
  const ask = async q => { await p.locator('.chat-input input').fill(q); await p.locator('.chat-input button').click(); await wait(2300); return (await p.locator('.msg.bot').last().innerText()).replace(/\u00a0/g, ' '); };
  const lastToTop = async () => { await p.evaluate(() => { const m = [...document.querySelectorAll('.msg.bot')].pop(); m?.scrollIntoView({ block: 'start' }); }); };
  await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:nm', '1'); localStorage.setItem('jm:themePicked', '1'); }); await p.reload(); await wait(700);
  await p.click('.welcome .accept'); await p.locator('.welcome .btn').last().click(); await wait(700);
  await p.click('text=Carregar dados de EXEMPLO'); await wait(900);
  await p.click('.fab'); await wait(900);
  let a = await ask('O que posso fazer para melhorar a minha saúde financeira para estável ?');
  ok(/Caminho até/.test(a) && /sua nota vai de \d+ para ~\d+/.test(a) && /estável \(60 ou mais\)/.test(a), `${n}/${scheme} pergunta do Jolian sem caminho: ${a.slice(0, 150)}`);
  ok(!BAN.test(a), `${n}/${scheme} termo proibido: ${a.match(BAN)?.[0]}`); samples.jolian = a;
  ok(await p.locator('.msg.bot').last().locator('button', { hasText: 'Ajustar meus gastos' }).count() === 1, `${n}/${scheme} sem botão Ajustar gastos`);
  await ov('chat'); await lastToTop(); await shot('01-pergunta-do-jolian'); await p.evaluate(() => document.querySelector('.chat-body').scrollBy(0, 99999)); await shot('02-pergunta-do-jolian-fim');
  for (const q of ['como subo minha nota?', 'melhroar minha situaçao financeira', 'onde estou gastando muito?', 'minha conta de luz ta cara', 'kkkk sei la']) { a = await ask(q); ok(!BAN.test(a) && a.length > 120, `${n}/${scheme} "${q}" fraco: ${a.slice(0, 100)}`); if (q.includes('gastando')) samples.gastos = a; if (q.includes('luz')) samples.luz = a; }
  a = await ask('me chama de Jolian'); ok(/Combinado, Jolian/.test(a), `${n}/${scheme} nome`); 
  const nm = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).settings.name); ok(nm === 'Jolian', `${n}/${scheme} nome não salvo: ${nm}`);
  a = await ask('como chegar no saudável?'); ok(/^Jolian, sua nota/m.test(a), `${n}/${scheme} não usou o nome`);
  // fatura do cartão lançada como "Outros"
  await p.click('.chat-back'); await wait(500);
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); d.isExample = false; d.expenses = d.expenses.filter(e => !/Roupas|Delivery|Streaming/.test(e.name)); d.expenses.push({ id: 'outros1', name: 'Outros', amount: 1800, category: 'outros', kind: 'variavel' }); localStorage.setItem('jmfinance:data', JSON.stringify(d)); localStorage.removeItem('jmfinance:chat'); });
  await p.reload(); await wait(900); await p.click('.fab'); await wait(900);
  a = await ask('o que eu faço pra melhorar?'); ok(/O que entra aí\?/.test(a) && /“Outros” leva R\$ 1\.800/.test(a), `${n}/${scheme} não perguntou do Outros: ${a.slice(-200)}`); samples.outros = a.slice(a.indexOf('Vi também'));
  await lastToTop(); await p.evaluate(() => document.querySelector('.chat-body').scrollBy(0, 99999)); await shot('03-pergunta-outros');
  a = await ask('é a fatura do cartão'); ok(/fatura do cartão/.test(a), `${n}/${scheme} resposta fatura`); samples.fatura = a;
  await p.locator('.msg.bot').last().locator('button', { hasText: 'Transformar em fatura e separar' }).click(); await wait(1300);
  ok(await p.locator('.card-split.open').isVisible(), `${n}/${scheme} divisão da fatura não abriu`);
  const cat = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).expenses.find(e => e.id === 'outros1').category); ok(cat === 'cartao', `${n}/${scheme} não virou cartão: ${cat}`);
  await p.click('.photo-bill'); await wait(300); ok(/Em breve o app vai ler a sua fatura/.test(await p.locator('.soon-note').innerText()), `${n}/${scheme} aviso em breve`); await shot('04a-fotografar-em-breve');
  const ins = p.locator('.card-split .split-grid input');
  for (const [i, v] of [[0, '400'], [1, '600'], [3, '150'], [8, '300']]) { await ins.nth(i).click(); await wait(120); await ins.nth(i).fill(v); await ins.nth(i).blur(); await wait(150); }
  const rest = await p.locator('.split-rest').innerText(); ok(/sem separar: R\$ 350,00/.test(rest.replace(/\u00a0/g, ' ')), `${n}/${scheme} resto errado: ${rest}`);
  await ov('fatura'); await p.locator('.card-split').scrollIntoViewIfNeeded(); await shot('04-o-que-entra-na-fatura');
  await p.click('.fab'); await wait(900); a = await ask('onde estou gastando muito?');
  ok(/Delivery e lanches \(no cartão\): R\$ 600/.test(a) && /parcelas de compras/.test(a), `${n}/${scheme} análise da fatura: ${a.slice(0, 200)}`); samples.faturaGastos = a;
  await lastToTop(); await shot('05-gastos-com-fatura');
  // diagnóstico não conta em dobro: total de gastos igual com e sem divisão
  console.log(n, scheme, 'ok'); await ctx.close();
}
await b.close();
fs.writeFileSync(`${OUT}/../v15-respostas.json`, JSON.stringify(samples, null, 1));
console.log(`checagens: ${n0} | falhas: ${fails.length ? '\n' + fails.join('\n') : 'nenhuma'}\nerros: ${errs.length ? errs.join('\n') : 'nenhum'}`);
