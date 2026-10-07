import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v2';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const shot = async (n, full = false) => { await p.waitForTimeout(1600); await p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full }); };
// migração de dados antigos
await p.goto(U); await p.evaluate(() => localStorage.setItem('jmfinance:data', JSON.stringify({ incomes: [{ id: 'a', name: 'Salário', amount: 3000 }], expenses: [], debts: [], reserve: 500 })));
await p.goto(U); await p.waitForTimeout(700); await p.screenshot({ path: `${OUT}/00-splash.png` });
await p.waitForSelector('.splash', { state: 'detached' });
for (const t of ['Objetivos', 'Diagnóstico', 'Plano', 'Meus dados']) { await p.click(`nav >> text=${t}`); await p.waitForTimeout(500); }
console.log('migração ok:', await p.isVisible('text=Patrimônio (bens e aplicações)'));
await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForSelector('.splash', { state: 'detached' }).catch(() => {});
await p.click('text=Carregar dados de EXEMPLO'); await p.click('nav >> text=Início'); await shot('01-inicio');
await p.screenshot({ path: `${OUT}/01-inicio-full.png`, fullPage: true });
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(500);
await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(x => x.textContent.includes('Patrimônio')); window.scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); });
await shot('02-meus-dados-patrimonio');
await p.click('nav >> text=Diagnóstico'); await p.evaluate(() => scrollTo(0, 0)); await shot('03-diagnostico');
await p.screenshot({ path: `${OUT}/03-diagnostico-full.png`, fullPage: true });
await p.click('nav >> text=Plano'); await shot('04-plano');
await p.click('nav >> text=Objetivos'); await p.evaluate(() => scrollTo(0, 0)); await shot('05-objetivos');
await p.evaluate(() => scrollTo(0, 420)); await shot('05-objetivos-metas');
await p.click('.fab'); await p.waitForTimeout(400);
for (const q of ['Qual dívida pagar primeiro?', 'Quero fazer uma viagem de R$ 6 mil']) { await p.click(`.chips >> text=${q}`); await p.waitForSelector('.typing'); await p.waitForSelector('.typing', { state: 'detached' }); }
await p.waitForTimeout(600);
await p.evaluate(() => { const m = [...document.querySelectorAll('.msg.me')].pop(); m.scrollIntoView({ block: 'start' }); m.parentElement.scrollTop -= 8; }); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/06-chat.png` });
const btn = p.locator('.msg-actions button').first(); console.log('ação:', await btn.textContent()); await btn.click(); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/07-chat-objetivo-criado.png` });
await p.click('text=Ver na aba Objetivos'); await p.waitForTimeout(600);
console.log('objetivos após criar:', await p.locator('.goal').count());
await p.click('.fab'); await p.click('.chips >> text=Como sair do vermelho?'); await p.waitForSelector('.typing'); await p.waitForTimeout(350); await p.screenshot({ path: `${OUT}/08-chat-digitando.png` });
await p.waitForSelector('.typing', { state: 'detached' });
console.log('discl. no chat:', await p.locator('.msg.bot .jm-disc').count(), '| badge:', await p.isVisible('text=MODO SIMULAÇÃO'));
// reduced motion: deve renderizar sem splash animada e sem erros
const p2 = await b.newPage({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }); p2.on('pageerror', e => errs.push('RM: ' + e.message));
await p2.goto(U); await p2.click('text=Carregar dados de EXEMPLO'); await p2.goto(U + '?tab=diagnostico'); await p2.waitForTimeout(800); console.log('reduced-motion gauge:', await p2.locator('.gauge-center b').first().textContent().catch(() => 'n/a'));
console.log('errors', errs); await b.close();
