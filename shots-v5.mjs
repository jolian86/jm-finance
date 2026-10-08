import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v5';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: true, hasTouch: true, acceptDownloads: true });
await ctx.grantPermissions(['notifications'], { origin: new URL(U).origin });
// Chromium headless não exibe notificações: registramos as chamadas para conferir o horário
await ctx.addInitScript(() => { window.__notes = []; const o = ServiceWorkerRegistration.prototype.showNotification; ServiceWorkerRegistration.prototype.showNotification = function (t, opt) { window.__notes.push(t); return Promise.resolve(); };
  Object.defineProperty(Notification, 'permission', { get: () => 'granted' }); Notification.requestPermission = async () => 'granted'; });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const hideFab = () => p.addStyleTag({ content: '.fab{display:none!important}' });
const scrollTo = (sel, txt, off = 70) => p.evaluate(([s, x, o]) => { const h = [...document.querySelectorAll(s)].find(e => e.textContent.trim().startsWith(x)); scrollTo(0, h.getBoundingClientRect().top + scrollY - o); }, [sel, txt, off]);
// 1) migração v4 -> v5 (sem settings)
await p.goto(U + '?nosplash');
await p.evaluate(() => localStorage.setItem('jmfinance:data', JSON.stringify({ incomes: [{ id: 'a', name: 'Salário', amount: 3000 }], expenses: [], debts: [], reserve: 0, assets: [], goals: [], month: '2026-10', actuals: {}, history: [], dismissedAlerts: [] })));
await p.reload(); await p.waitForTimeout(400);
console.log('migração settings:', JSON.stringify(await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).settings)));
// 2) exemplo às 08:00 -> horário 09:00 deve segurar notificações
await p.clock.setFixedTime(new Date('2026-10-07T08:00:00-03:00'));
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:splash', '1'); sessionStorage.setItem('jm:nm', '1'); }); await p.reload();
await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(600); await hideFab();
await p.click('.bell'); await p.waitForTimeout(600);
await p.click('text=Ativar notificações'); await p.waitForTimeout(1500);
const nCount = () => p.evaluate(() => window.__notes.length);
console.log('perm:', await p.evaluate(() => Notification.permission + ' ' + localStorage.getItem('jmfinance:notif')), '| msg:', await p.locator('.notif-box .hint').first().textContent().catch(() => '-'));
console.log('08:00 com horário 09:00 -> notificações:', await nCount());
await p.evaluate(() => document.querySelector('.notif-box').scrollIntoView({ block: 'center' })); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/01-alertas-horario-preferido.png` });
await p.fill('.time-row input', '07:30'); await p.waitForTimeout(1500);
console.log('horário 07:30 salvo:', await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).settings.alertTime), '-> notificações:', await nCount());
const rem = await p.evaluate(async () => { const c = await caches.open('jm-reminders'); const r = await c.match('reminders.json'); return r ? (await r.json()).alertTime : null; });
console.log('reminders.json alertTime:', rem);
await p.fill('.time-row input', '09:00'); await p.waitForTimeout(300);
await p.click('.sheet-head button').catch(() => p.keyboard.press('Escape')); await p.waitForTimeout(500);
// 3) Início: botão exportar
await p.click('nav >> text=Início'); await p.waitForTimeout(500);
await scrollTo('button', 'Ver meu plano de ação', 380); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/02-inicio-exportar-relatorio.png` });
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('text=Exportar relatório (PDF)')]);
console.log('download:', dl.suggestedFilename()); await dl.saveAs(`${OUT}/${dl.suggestedFilename()}`);
await p.waitForTimeout(400); console.log('estado botão:', await p.locator('.export-btn').textContent());
// Diagnóstico também tem o botão
await p.click('nav >> text=Diagnóstico'); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/03-diagnostico-exportar.png` });
// 4) Plano -> Simulador
await p.click('nav >> text=Plano'); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/04-plano-entrada-simulador.png` });
await p.click('text=Simulador de decisões'); await p.waitForTimeout(900);
await p.screenshot({ path: `${OUT}/05-simulador-lista.png` });
for (const t of ['Quitar dívida ou investir', 'Antecipar parcelas', 'Consolidar dívidas', 'Cortar um gasto']) {
  await p.locator('.sim-item', { hasText: t }).click(); await p.waitForTimeout(700);
  const err = await p.locator('.finding.warn b').first().textContent().catch(() => '');
  console.log(`[${t}]`, (await p.locator('.card:has(h3:text("Resumo")) p').first().textContent().catch(() => 'ERRO: ' + err)).slice(0, 260));
  await p.click('.sim-top .chat-back'); await p.waitForTimeout(500);
}
await p.locator('.sim-item', { hasText: 'Financiar' }).click(); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/06-simulador-financiar-form.png` });
await scrollTo('h3', 'Lado a lado'); await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/07-simulador-financiar-lado-a-lado.png` });
await scrollTo('h3', 'Resumo'); await p.waitForTimeout(1600);
await p.screenshot({ path: `${OUT}/08-simulador-financiar-resumo-grafico.png` });
await scrollTo('h3', 'Prós, contras'); await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/09-simulador-financiar-pros-contras.png` });
await p.screenshot({ path: `${OUT}/10-simulador-financiar-completo.png`, fullPage: true });
const g0 = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).goals.length);
const save = p.locator('text=Salvar como objetivo');
if (await save.count()) { await save.click(); await p.waitForTimeout(400); }
const g1 = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).goals.map(g => `${g.name} ${g.target} ${g.date}`));
console.log('salvar como objetivo:', g0, '->', g1.length, '|', g1[g1.length - 1]);
// cortar gasto: screenshot de outro cenário
await p.click('.sim-top .chat-back'); await p.waitForTimeout(400);
await p.locator('.sim-item', { hasText: 'Cortar um gasto' }).click(); await p.waitForTimeout(700);
await scrollTo('h3', 'Lado a lado'); await p.waitForTimeout(1200);
await p.screenshot({ path: `${OUT}/11-simulador-cortar-gasto.png` });
// 5) Consultor -> simulador
// novo contexto sem relógio fixo (o relógio fixo trava as animações após recarregar)
const saved = await p.evaluate(() => localStorage.getItem('jmfinance:data'));
const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: true, hasTouch: true });
const p2 = await ctx2.newPage(); p2.on('pageerror', e => errs.push(e.message));
await p2.goto(U + '?nosplash'); await p2.evaluate(v => { localStorage.setItem('jmfinance:data', v); sessionStorage.setItem('jm:nm', '1'); }, saved);
await p2.goto(U + '?nosplash&tab=inicio'); await p2.waitForTimeout(900);
{ const p = p2;
await p.click('.fab'); await p.waitForTimeout(500);
await p.click('.chips >> text=Qual dívida pagar primeiro?'); await p.waitForTimeout(2500);
await p.evaluate(() => { const b = document.querySelector('.chat-body'); b.scrollTo(0, b.scrollHeight); }); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/12-consultor-link-simulador.png` });
const links = await p.locator('.chat-body button', { hasText: 'Simular:' }).allTextContents(); console.log('links no chat:', links.join(' | '));
await p.locator('.chat-body button', { hasText: 'Simular:' }).last().click(); await p.waitForTimeout(900);
console.log('abriu:', await p.locator('.sim-head h3').textContent());
await p.screenshot({ path: `${OUT}/13-consultor-abriu-simulador.png` }); }
console.log('erros:', errs.length ? errs : 'nenhum');
await b.close();
