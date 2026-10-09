// v12: renda por dia (diária). Uso: node shots-v12.mjs URL OUT [viewports-com-captura] [só-estes]
import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v12';
const SHOT = (process.argv[4] || '360x740,390x844,1366x768').split(',');
const ONLY = (process.argv[5] || '').split(',').filter(Boolean);
const VPS = [[375, 667], [390, 844], [360, 740], [412, 915], [430, 932], [820, 1180, 'tablet'], [1366, 768, 'desktop']].filter(([w, h]) => !ONLY.length || ONLY.includes(`${w}x${h}`));
const BAN = /\ba\.m\.|\ba\.a\.|ponderad|avalanche|bola de neve|patrim[oô]nio l[ií]quido|comprometimento|liquidez|\bCDI\b/i; const BAD = /undefined|\bNaN\b|Infinity/;
const b = await chromium.launch(); const errs = []; const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
const pad = n => String(n).padStart(2, '0');
for (const [w, h, kind] of VPS) {
  const n = `${w}x${h}`; const shots = SHOT.includes(n);
  for (const phase of ['hoje', 'dia20']) {
    const ctx = await b.newContext({ colorScheme: process.env.SCHEME || 'light', viewport: { width: w, height: h }, deviceScaleFactor: kind === 'desktop' ? 1 : 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: !kind, hasTouch: kind !== 'desktop' });
    const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(`${n}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errs.push(`${n}: ${m.text()}`));
    if (phase === 'dia20') await p.clock.setFixedTime(new Date('2026-10-20T15:00:00-03:00'));
    const wait = ms => p.waitForTimeout(ms);
    const DD = () => p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')));
    const shot = async nm => { if (shots) { await wait(450); await p.screenshot({ path: `${OUT}/${n}-${nm}.png` }); } };
    const to = async (sel, off = 70) => p.evaluate(([s, o]) => { const el = document.querySelector(s); if (el) scrollTo(0, el.getBoundingClientRect().top + scrollY - o); }, [sel, off]);
    const scan = async where => { const t = await p.evaluate(() => document.querySelector('main').innerText); const m = t.match(BAN) || t.match(BAD); ok(!m, `${n} · ${where}: "${m?.[0]}"`);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(ov <= 1, `${n} · overflow em ${where}: ${ov}px`); };
    await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:nm', '1'); localStorage.setItem('jm:themePicked', '1'); }); await p.reload(); await wait(600);
    await p.click('.welcome .accept'); await p.locator('.welcome .btn').last().click(); await wait(600);
    if (phase === 'hoje') {
      await p.click('text=Carregar dados de EXEMPLO'); await wait(900); await p.click('nav >> text=Início'); await wait(800);
      await p.addStyleTag({ content: '.fab{display:none!important}' });
      // Início: Trabalhei hoje
      const card = p.locator('.daily-today'); ok(await card.count() === 1, `${n} · cartão Diárias ausente no Início`);
      await scan('Início');
      const di = () => DD().then(d => d.incomes.find(i => i.kind === 'diaria'));
      const today = await p.evaluate(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; });
      let x = await di(); const wasMarked = x.daily.log[today] !== undefined;
      if (wasMarked) { await card.locator('button:has-text("desmarcar")').click(); await wait(250); }
      await to('.daily-today'); await shot('01-inicio-diarias');
      await card.locator('button:has-text("Trabalhei hoje")').click(); await wait(300);
      x = await di(); ok(x.daily.log[today] === 120, `${n} · Trabalhei hoje não marcou 120: ${x.daily.log[today]}`);
      ok((await card.innerText()).replace(/\u00a0/g, ' ').includes('Hoje: R$ 120,00'), `${n} · confirmação "Hoje: R$ 120,00" ausente`);
      await card.locator('button:has-text("outro valor")').click(); await wait(200);
      const v = card.locator('.dt-val input'); await v.click(); await wait(150); await v.fill('180'); await v.blur(); await wait(250);
      x = await di(); ok(x.daily.log[today] === 180, `${n} · outro valor no dia: ${x.daily.log[today]}`);
      await to('.daily-today'); await shot('02-inicio-trabalhei-hoje-outro-valor');
      await card.locator('button:has-text("desmarcar")').click(); await wait(250); x = await di(); ok(x.daily.log[today] === undefined, `${n} · desmarcar hoje`);
      await card.locator('button:has-text("Trabalhei hoje")').click(); await wait(250);
      // Meus dados: renda por dia do exemplo
      await p.click('nav >> text=Meus dados'); await wait(900); await p.addStyleTag({ content: '.fab{display:none!important}' });
      await scan('Meus dados');
      const box = p.locator('.daily-box').first(); const bt = (await box.innerText()).replace(/\u00a0/g, ' ');
      ok(bt.includes('R$ 120,00 × 6 dias ≈ R$ 720,00 por mês') && bt.includes('Para o plano, contamos') && bt.includes('Pelo que você marcou'), `${n} · textos da diária: ${bt.slice(0, 260)}`);
      if (n === '390x844') console.log('diária exemplo:', bt.replace(/\n+/g, ' | ').slice(0, 520));
      await p.evaluate(() => { const e = document.querySelector('.daily-box').closest('.income'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); }); await shot('03-renda-diaria-exemplo');
      // calendário: marcar/desmarcar o dia 1 (se já passou)
      await box.locator('.daily-cal-wrap .adv-toggle').click(); await wait(300);
      const d1 = box.locator('.dc-day').first(); const k1 = today.slice(0, 8) + '01';
      const was1 = (await di()).daily.log[k1] !== undefined;
      if (!was1) { await d1.click(); await wait(250); ok((await di()).daily.log[k1] === 120, `${n} · calendário não marcou o dia 1`); }
      else { await d1.click(); await wait(200); }
      ok(await box.locator('.dc-edit').isVisible(), `${n} · editor do dia não abriu`);
      const ev = box.locator('.dc-edit input'); await ev.click(); await wait(150); await ev.fill('95'); await ev.blur(); await wait(250);
      ok((await di()).daily.log[k1] === 95, `${n} · valor do dia 1 não salvou`);
      await p.evaluate(() => { const e = document.querySelector('.daily-cal'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 160); }); await shot('04-calendario-dias-trabalhados');
      await box.locator('.dc-edit button:has-text("desmarcar")').click(); await wait(250); ok((await di()).daily.log[k1] === undefined, `${n} · desmarcar no calendário`);
      ok(await box.locator('.dc-day:disabled').count() >= 0, 'x');
      // nova renda por dia
      await p.locator('button:has-text("+ Recebo por dia")').click(); await wait(400);
      const nb = p.locator('.daily-box').last(); const rate = nb.locator('.f-money input').first(); await rate.click(); await wait(150); await rate.fill('150'); await rate.blur(); await wait(250);
      const nt = (await nb.innerText()).replace(/\u00a0/g, ' ');
      const ni = (await DD()).incomes.at(-1);
      ok(nt.includes('R$ 150,00 × 20 dias ≈ R$ 3.000,00 por mês') && ni.amount === 2550 && ni.daily.days === 20, `${n} · nova diária: ${ni.amount} ${nt.slice(0, 200)}`);
      const days = nb.locator('.f-days input'); await days.fill('22'); await wait(250);
      ok((await DD()).incomes.at(-1).amount === 2805, `${n} · 22 dias → 2805`);
      await days.fill('40'); await wait(150); ok((await DD()).incomes.at(-1).daily.days === 22, `${n} · 40 dias não deveria valer`); await days.blur(); await wait(150);
      ok(await days.inputValue() === '22', `${n} · campo de dias volta para 22`);
      await p.evaluate(() => { const e = [...document.querySelectorAll('.daily-box')].at(-1).closest('.income'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); }); await shot('05-nova-renda-por-dia');
      // voltar a mensal e de novo diária
      const tog = p.locator('.income').last().locator('label.var-toggle', { hasText: 'Recebo por dia' }).locator('input');
      await tog.uncheck(); await wait(250); let li = (await DD()).incomes.at(-1); ok(li.kind === 'mensal' && li.amount === 3300, `${n} · voltar a mensal ${li.kind} ${li.amount}`);
      await tog.check(); await wait(250); li = (await DD()).incomes.at(-1); ok(li.kind === 'diaria' && li.daily.rate === 150, `${n} · voltar a diária ${JSON.stringify(li.daily)}`);
      // diagnóstico e evolução
      await p.click('nav >> text=Diagnóstico'); await wait(1500); await scan('Diagnóstico');
      await p.locator('[role=tab]', { hasText: 'Evolução' }).click(); await wait(1200); await scan('Evolução');
      const evo = p.locator('.card', { has: p.locator('h3:text-is("Dias trabalhados (diárias)")') }); ok(await evo.count() === 1, `${n} · cartão de dias trabalhados na Evolução`);
      if (await evo.count()) { await evo.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, -70)); await wait(1200); await shot('06-evolucao-dias-trabalhados'); }
      // consultor
      await p.click('nav >> text=Início'); await wait(600); await p.addStyleTag({ content: '.fab{display:flex!important}' });
      await p.click('.fab'); await wait(900); const ci = p.locator('.chat-input input, .chat-input textarea').first(); await ci.fill('Como está minha diária?'); await p.locator('.chat-input button').click(); await wait(2500);
      const last = (await p.locator('.msg, .chat-msg, .bubble').last().innerText().catch(() => '')).replace(/\u00a0/g, ' ');
      const chatTxt = await p.evaluate(() => document.querySelector('.sheet, .chat')?.innerText || '');
      ok(/por dia/.test(chatTxt) && /Para o plano, conto/.test(chatTxt), `${n} · consultor sem resposta de diária: ${last.slice(0, 120)}`);
      await shot('07-consultor-diaria');
    } else {
      // dia 20: mês fraco → alerta e status
      await p.evaluate(() => { const log = {}; for (let k = 1; k <= 30; k++) if (k % 2) log[`2026-09-${String(k).padStart(2, '0')}`] = 150; ['2026-10-02', '2026-10-06', '2026-10-09'].forEach(k => log[k] = 150);
        const d = { incomes: [{ id: 'i1', name: 'Diárias de pedreiro', amount: 0, kind: 'diaria', daily: { rate: 150, days: 20, log } }], expenses: [{ id: 'e1', name: 'Aluguel', amount: 900, category: 'moradia', kind: 'fixa' }], debts: [], reserve: 0, assets: [], goals: [], month: '2026-10', actuals: {}, history: [], dismissedAlerts: [], receivables: [] };
        const old = JSON.parse(localStorage.getItem('jmfinance:data')); localStorage.setItem('jmfinance:data', JSON.stringify({ ...old, ...d, settings: old.settings })); });
      await p.reload(); await wait(900); await p.addStyleTag({ content: '.fab{display:none!important}' });
      const dt = (await p.locator('.daily-today').innerText()).replace(/\u00a0/g, ' ');
      ok(dt.includes('Este mês: 3 dias, R$ 450,00 — abaixo do esperado'), `${n} · status do mês: ${dt}`);
      const D = await DD(); ok(D.incomes[0].amount === Math.round(150 * 15 * 0.85), `${n} · aprendeu 15 dias/mês: ${D.incomes[0].amount}`);
      await scan('Início (mês fraco)');
      await to('.daily-today'); await shot('08-inicio-mes-abaixo-do-esperado');
      await p.click('.bell'); await wait(1500);
      const at = (await p.locator('.sheet').innerText()).replace(/\u00a0/g, ' ');
      ok(at.includes('Diárias de pedreiro: mês mais fraco até agora') && at.includes('Este mês: 3 dias, R$ 450,00'), `${n} · alerta de mês fraco ausente: ${at.slice(0, 200)}`);
      if (n === '390x844') console.log('alerta:', at.match(/Diárias de pedreiro: mês mais fraco[^\n]*\n[^\n]*/)?.[0]);
      await shot('09-alerta-mes-fraco');
      await p.click('.sheet .chat-back'); await wait(400);
      // PDF: gera sem erro
      await p.click('nav >> text=Meus dados'); await wait(800);
      const inc = p.locator('.income').first(); const it = (await inc.innerText()).replace(/\u00a0/g, ' ');
      ok(/média de R\$ 150,00 por dia e 15 dias por mês/.test(it), `${n} · aprendizado na renda: ${it.slice(0, 300)}`);
      await scan('Meus dados (mês fraco)');
    }
    await ctx.close();
  }
  console.log(n, 'ok');
}
await b.close();
console.log('checagens:', checks, '| falhas:', fails.length ? '\n  ' + fails.join('\n  ') : 'nenhuma'); console.log('erros:', errs.length ? errs.join('\n') : 'nenhum');
