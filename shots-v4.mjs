import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v4';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', isMobile: true, hasTouch: true });
await ctx.grantPermissions(['notifications'], { origin: new URL(U).origin });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const hideFab = () => p.addStyleTag({ content: '.fab{display:none!important}' });
// 1) migração: formato v3 (sem month/history/actuals)
await p.goto(U + '?nosplash');
await p.evaluate(() => localStorage.setItem('jmfinance:data', JSON.stringify({ incomes: [{ id: 'a', name: 'Salário', amount: 3000 }], expenses: [{ id: 'e', name: 'Aluguel', amount: 1000, category: 'moradia', kind: 'fixa' }], debts: [], reserve: 500, assets: [], goals: [] })));
await p.reload(); for (const t of ['Meus dados', 'Diagnóstico', 'Plano', 'Objetivos', 'Início']) { await p.click(`nav >> text=${t}`); await p.waitForTimeout(400); }
const mig = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')));
console.log('migração:', mig.month, Array.isArray(mig.history), typeof mig.actuals);
// 2) exemplo
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:splash', '1'); }); await p.reload();
await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(600); await hideFab();
console.log('badge alertas:', await p.locator('.bell-badge').textContent());
await p.click('.seg >> text=Evolução'); await p.waitForTimeout(1800);
await p.screenshot({ path: `${OUT}/01-evolucao.png` });
await p.screenshot({ path: `${OUT}/02-evolucao-completa.png`, fullPage: true });
await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(x => x.textContent === 'Patrimônio líquido'); scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/03-evolucao-graficos.png` });
await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(x => x.textContent === 'Gastos por categoria'); scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); }); await p.mouse.move(5, 5); await p.waitForTimeout(1500);
await p.screenshot({ path: `${OUT}/04-evolucao-gastos-categoria.png` });
await p.click('nav >> text=Início'); await p.waitForTimeout(500);
await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(x => x.textContent === 'Sua evolução'); scrollTo(0, h.getBoundingClientRect().top + scrollY - 300); }); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/05-inicio-evolucao.png` });
// 3) alertas
await p.click('.bell'); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/06-alertas.png` });
console.log('alertas:', await p.locator('.alert').count(), '|', (await p.locator('.alert b').allTextContents()).join(' | '));
await p.click('text=Ativar notificações'); await p.waitForTimeout(1000);
console.log('notif msg:', await p.locator('.notif-box .hint').textContent().catch(() => '-'));
await p.evaluate(() => document.querySelector('.sheet').scrollTo(0, 9999)); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/07-alertas-notificacoes.png` });
await p.locator('.alert .link', { hasText: 'Dispensar' }).first().click(); await p.waitForTimeout(500);
console.log('badge após dispensar:', await p.locator('.bell-badge').textContent());
await p.locator('.alert .btn').first().click(); await p.waitForTimeout(700);
// 4) gasto real
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(500);
await p.evaluate(() => { const h = [...document.querySelectorAll('h3')].find(x => x.textContent.startsWith('Gasto real')); scrollTo(0, h.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/08-gasto-real-x-planejado.png` });
// 5) novo mês: simula dados no mês anterior -> prompt automático -> fechar
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); const [y, m] = d.month.split('-').map(Number); const dt = new Date(y, m - 2, 1); d.month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`; d.history = d.history.filter(h => h.month < d.month); localStorage.setItem('jmfinance:data', JSON.stringify(d)); sessionStorage.removeItem('jm:nm'); });
await p.reload(); await p.waitForTimeout(900); await hideFab();
await p.screenshot({ path: `${OUT}/09-novo-mes-fechar.png` });
const before = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).history.length);
await p.click('.modal >> text=Fechar mês'); await p.waitForTimeout(800);
const after = await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); return [d.history.length, d.month]; });
console.log('fechar mês: histórico', before, '->', after[0], '| mês atual', after[1]);
// 6) 2º aviso (1 dia útil antes): avança o relógio para sexta 09/10/2026
await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:splash', '1'); sessionStorage.setItem('jm:nm', '1'); });
await p.clock.setFixedTime(new Date('2026-10-07T10:00:00'));
await p.reload(); await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(500);
await p.clock.setFixedTime(new Date('2026-10-09T10:00:00')); await p.reload(); await p.waitForTimeout(600); await hideFab();
await p.click('.bell'); await p.waitForTimeout(700);
console.log('09/10:', (await p.locator('.alert b').allTextContents()).slice(0, 4).join(' | '));
const al = p.locator('.alert', { hasText: 'Aluguel' }); console.log('aluguel:', await al.locator('p').first().textContent());
await al.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/10-alertas-2o-aviso-dia-util.png` });
console.log('errors', errs); await b.close();
