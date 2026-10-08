// Capturas antes/depois (v11): mesmas telas nas duas versões. Uso: node shots-v11-ba.mjs URL OUT PREFIX [viewports]
import { chromium } from 'playwright';
const U = process.argv[2], OUT = process.argv[3], PRE = process.argv[4];
const VPS = (process.argv[5] || '360x740,390x844,1366x768').split(',').map(s => s.split('x').map(Number));
const b = await chromium.launch(); const errs = [];
for (const [w, h] of VPS) {
  const n = `${w}x${h}`; const desk = w >= 1000;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: desk ? 1 : 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: !desk && w < 700, hasTouch: !desk });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(`${n}: ${e.message}`));
  await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:nm', '1'); }); await p.reload(); await p.waitForTimeout(600);
  await p.click('.welcome .accept'); await p.locator('.welcome .btn').last().click(); await p.waitForTimeout(600);
  await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(900);
  const css = () => p.addStyleTag({ content: '.fab{display:none!important}' });
  const shot = async (name) => { await p.waitForTimeout(450); await p.screenshot({ path: `${OUT}/${PRE}-${n}-${name}.png` }); };
  const to = async (sel, off = 70) => { await p.evaluate(([s, o]) => { const el = typeof s === 'string' ? document.querySelector(s) : null; if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, off]); };
  const toText = async (sel, txt, off = 70) => { await p.evaluate(([s, t, o]) => { const el = [...document.querySelectorAll(s)].find(e => e.textContent.includes(t)); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, txt, off]); };
  await p.click('nav >> text=Meus dados'); await p.waitForTimeout(900); await css();
  await to('#gastos'); await shot('1-gastos');
  await toText('main .card', 'Cartão Banco X'); await p.evaluate(() => { const c = [...document.querySelectorAll('main .debt')].find(e => e.querySelector('input')?.value === 'Cartão Banco X'); if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await shot('2-divida-rotativo');
  await p.evaluate(() => { const c = [...document.querySelectorAll('main .debt')].find(e => e.querySelector('input')?.value === 'Empréstimo pessoal'); if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await shot('3-divida-emprestimo');
  await p.evaluate(() => { const c = [...document.querySelectorAll('main .debt')].find(e => e.querySelector('input')?.value?.startsWith('Previdência')); if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await shot('4-previdencia');
  await to('#receitas'); await shot('5-receitas-futuras');
  await to('#previsao'); await shot('6-previsao');
  await p.locator('#receitas .recv').nth(1).locator('.icon-btn').click(); await p.waitForTimeout(700); await shot('7-form-receita');
  await p.locator('.sheet').evaluate(el => el.scrollTo(0, 260)); await shot('7b-form-receita-meio');
  await p.keyboard.press('Escape'); await p.locator('.sheet .chat-back').click().catch(() => {}); await p.waitForTimeout(500);
  await p.click('nav >> text=Diagnóstico'); await p.waitForTimeout(2200); await toText('main .grid2', '', 70); await p.evaluate(() => { const g = document.querySelectorAll('main .grid2')[0]; if (g) scrollTo(0, g.getBoundingClientRect().top + scrollY - 70); }); await shot('8-diagnostico-numeros');
  await toText('main .card h3', 'Patrimônio'); await p.evaluate(() => { const c = [...document.querySelectorAll('main .card')].find(c => c.querySelector('h3')?.textContent.startsWith('Patrim') || c.querySelector('h3')?.textContent.startsWith('O que você tem')); if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(1500); await shot('9-diagnostico-patrimonio');
  await p.click('nav >> text=Plano'); await p.waitForTimeout(1200);
  await p.evaluate(() => { const c = [...document.querySelectorAll('main .card.step')].find(c => /quite as d[ií]vidas/i.test(c.textContent)); if (c) { c.scrollIntoView(); scrollBy(0, -70); } }); await p.waitForTimeout(700); await shot('10-plano-dividas');
  await p.evaluate(() => { const c = [...document.querySelectorAll('main .card')].find(c => /proje[cç][aã]o|quando suas d[ií]vidas acabam/i.test(c.querySelector('h3')?.textContent || '')); if (c) { c.scrollIntoView(); scrollBy(0, -70); } }); await p.waitForTimeout(1500); await shot('11-plano-grafico');
  await p.click('nav >> text=Objetivos'); await p.waitForTimeout(1000);
  await p.evaluate(() => { const c = [...document.querySelectorAll('.card.goal')].find(c => c.querySelector('.goal-name')?.textContent === 'Aposentadoria'); if (c) scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await shot('12-objetivo-aposentadoria');
  for (const [sim, nm] of [['quitar-investir', '13-sim-quitar-investir'], ['consolidar', '14-sim-consolidar'], ['financiar', '15-sim-financiar']]) {
    await p.goto(U + `?nosplash&tab=simulador&sim=${sim}`); await p.waitForTimeout(1200); await css(); await shot(nm);
  }
  if (PRE === 'depois') { // ajustes opcionais abertos
    await p.goto(U + '?nosplash'); await p.waitForTimeout(900); await p.click('nav >> text=Meus dados'); await p.waitForTimeout(900); await css();
    const row = p.locator('.exp', { has: p.locator('input.row-name[value="Mercado"]') }).first(); await row.locator('.kind-chip').click();
    await p.evaluate(() => { const r = [...document.querySelectorAll('.exp')].find(e => e.querySelector('input.row-name')?.value === 'Mercado'); scrollTo(0, r.getBoundingClientRect().top + scrollY - 120); }); await shot('16-gastos-ajuste-opcional');
    await p.locator('#receitas .recv').nth(1).locator('.icon-btn').click(); await p.waitForTimeout(700);
    await p.locator('.recv-form .adv-toggle').click(); await p.locator('.recv-form .adv').evaluate(el => el.scrollIntoView({ block: 'center' })); await shot('17-form-receita-ajustar-aberto');
    await p.keyboard.press('Escape'); await p.locator('.recv-form .modal-actions .btn.ghost').click().catch(() => {}); await p.waitForTimeout(500);
    await p.click('nav >> text=Objetivos'); await p.waitForTimeout(1000);
    const g = p.locator('.card.goal', { has: p.locator('.goal-name:text-is("Aposentadoria")') }); await g.locator('.adv-toggle').click();
    await g.locator('.adv').evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 160)); await shot('18-objetivo-ajustar-aberto');
    await p.goto(U + '?nosplash&tab=simulador&sim=financiar'); await p.waitForTimeout(1200); await css();
    await p.locator('main .adv-toggle').click(); await p.locator('main .adv').evaluate(el => scrollTo(0, el.getBoundingClientRect().top + scrollY - 160)); await shot('19-sim-financiar-ajustar-aberto');
  }
  await ctx.close();
}
await b.close(); console.log('erros:', errs.length ? errs.join('\n') : 'nenhum');
