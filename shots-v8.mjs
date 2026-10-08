import { chromium } from 'playwright';
import fs from 'node:fs';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v8';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: true, hasTouch: true, acceptDownloads: true });
const p = await ctx.newPage();
p.on('dialog', d => d.accept()); const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const D = () => p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')));
const shot = n => p.screenshot({ path: `${OUT}/${n}.png` });
const to = async (sel, off = 70) => { await p.evaluate(([s, o]) => { const e = document.querySelector(s); scrollTo(0, e.getBoundingClientRect().top + scrollY - o); }, [sel, off]); await p.waitForTimeout(900); };
const hideFab = () => p.addStyleTag({ content: '.fab{display:none!important}' });
// 0) migração: dados v7 (sem receivables / renda variável)
await p.goto(U + '?nosplash');
await p.evaluate(() => { localStorage.setItem('jmfinance:data', JSON.stringify({ incomes: [{ id: 'a', name: 'Salário', amount: 3000 }], expenses: [], debts: [], reserve: 0, assets: [], goals: [], month: '2026-10', actuals: {}, history: [], dismissedAlerts: [], settings: { alertTime: '09:00', terms: { version: '1.0', acceptedAt: new Date().toISOString() } } })); sessionStorage.setItem('jm:nm', '1'); });
await p.reload(); await p.waitForTimeout(600);
const mg = await D(); console.log('migração: receivables', JSON.stringify(mg.receivables), '| renda', mg.incomes[0].amount, '| welcome', await p.locator('.welcome').count());
// 1) exemplo
await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(700); await hideFab();
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(600);
await to('#receitas'); await shot('01-receitas-futuras-lista-atalhos');
await to('.recv-list .recv:nth-child(3)', 120); await shot('02-receitas-futuras-lista-continuacao');
// 2) formulário via atalho PLR
await to('#receitas'); await p.click('.presets >> text=+ PLR'); await p.waitForTimeout(700);
await shot('03-form-preset-plr');
await p.evaluate(() => document.querySelector('.recv-form').scrollTo(0, 99999)); await p.waitForTimeout(300);
await shot('04-form-preset-plr-parcelas');
await p.click('.recv-form .modal-actions >> text=Cancelar'); await p.waitForTimeout(400);
// 13º sugerido pelo salário
await p.click('.presets >> text=+ 13º salário'); await p.waitForTimeout(600);
console.log('13º nota:', await p.locator('.form-note').textContent());
console.log('13º valores:', await p.$$eval('.inst-grid input[aria-label="Valor bruto"], .inst-grid input[aria-label="Valor líquido (opcional)"]', es => es.map(e => e.value).join(' / ')));
await p.click('.recv-form .modal-actions >> text=Cancelar'); await p.waitForTimeout(300);
// adicionar honorários (advogado) com êxito incerto
await p.click('.presets >> text=+ Honorários'); await p.waitForTimeout(500);
await p.fill('.recv-form input[aria-label="Valor bruto"]', '5000'); await p.click('.recv-form .modal-actions >> text=Salvar'); await p.waitForTimeout(500);
console.log('após salvar honorários:', (await D()).receivables.length, 'recebíveis');
// 3) previsão + precisão
await to('#previsao'); await p.waitForTimeout(800); await shot('05-previsao-recebimentos-grafico');
await to('.precision', 90); await shot('06-previsao-precisao');
// 4) renda variável
await to('.var-box', 240); await shot('07-renda-variavel');
// 5) plano
await p.click('nav >> text=Plano'); await p.waitForTimeout(700);
await p.evaluate(() => { const h = [...document.querySelectorAll('.step h3')].find(x => x.textContent.startsWith('Use as receitas')); scrollTo(0, h.getBoundingClientRect().top + scrollY - 80); }); await p.waitForTimeout(1200);
await shot('08-plano-uso-da-plr');
const stepTxt = await p.locator('.step', { hasText: 'Use as receitas futuras' }).locator('li').allTextContents(); console.log('plano:', stepTxt.slice(0, 2).join(' || '));
const payoff1 = await p.evaluate(() => [...document.querySelectorAll('.step')].find(s => s.textContent.includes('Quite as dívidas'))?.querySelector('li')?.textContent);
await p.locator('.recv-step .seg >> text=Só garantido').click(); await p.waitForTimeout(500);
const payoff2 = await p.evaluate(() => [...document.querySelectorAll('.step')].find(s => s.textContent.includes('Quite as dívidas'))?.querySelector('li')?.textContent);
console.log('avalanche ponderado:', payoff1?.slice(0, 60), '| só garantido:', payoff2?.slice(0, 60), '| modo salvo:', (await D()).settings.recvMode);
await p.locator('.recv-step .seg >> text=Ponderado').click(); await p.waitForTimeout(300);
// 6) alertas
await p.click('.bell'); await p.waitForTimeout(600);
const ra = p.locator('.alert', { hasText: /não chegou|deve cair/ }); console.log('alertas recebíveis:', (await ra.locator('b').allTextContents()).join(' | '));
await ra.first().scrollIntoViewIfNeeded(); await shot('09-alertas-recebiveis');
await ra.first().locator('.btn').click(); await p.waitForTimeout(1200);
console.log('CTA levou a receitas:', await p.evaluate(() => { const r = document.getElementById('receitas').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
// 7) marcar como recebido (3ª parcela atrasada do freela)
const late = p.locator('.occ.atrasado').first(); await late.locator('text=Marcar como recebido').click(); await p.waitForTimeout(300);
await late.locator('input[type=number]').fill('1500'); await late.locator('text=Confirmar').click(); await p.waitForTimeout(500);
const pr = await p.locator('.prec-top p').textContent(); console.log('precisão após receber:', pr);
console.log('atrasados restantes:', await p.locator('.occ.atrasado').count());
// 8) consultor
await p.goto(U + '?nosplash&tab=inicio'); await p.waitForTimeout(800);
await p.click('.fab'); await p.waitForTimeout(500); await p.click('.chips >> text=Como usar minha PLR?'); await p.waitForTimeout(2600);
await p.evaluate(() => { const b = document.querySelector('.chat-body'); const m = [...b.querySelectorAll('.msg.bot')].pop(); b.scrollTo(0, m.offsetTop - 70); }); await p.waitForTimeout(300);
await shot('10-consultor-como-usar-plr');
console.log('chat PLR:', (await p.locator('.msg.bot p').nth(-2).textContent()).slice(0, 220).replace(/\n/g, ' '));
await p.fill('.chat-input input', 'e o 13º?'); await p.click('.chat-input button'); await p.waitForTimeout(2600);
console.log('chat 13º:', (await p.locator('.msg.bot p').nth(-2).textContent()).slice(0, 160).replace(/\n/g, ' '));
await p.click('.chat-back'); await p.waitForTimeout(400);
// 9) backup inclui recebíveis + PDF tem a seção
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(400);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.backup >> text=Exportar backup')]);
const f = '/tmp/jm-v8.json'; await dl.saveAs(f); const j = JSON.parse(fs.readFileSync(f, 'utf8'));
console.log('backup: schema', j.schemaVersion, '| recebíveis', j.data.receivables.length, '| renda variável', j.data.incomes.filter(i => i.variable).length);
await p.click('nav >> text=Início'); await p.waitForTimeout(400);
const [pdf] = await Promise.all([p.waitForEvent('download'), p.click('text=Exportar relatório (PDF)')]);
await pdf.saveAs('/tmp/jm-v8.pdf'); console.log('pdf ok');
console.log('erros:', errs.length ? errs : 'nenhum');
await b.close();
