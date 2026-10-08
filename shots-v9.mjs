import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v9';
const SHOTS = process.argv[4] !== 'noshots';
const ALL = [
  { n: 'iphoneSE-375x667', w: 375, h: 667, kb: 260, shots: true },
  { n: 'iphone-390x844', w: 390, h: 844, kb: 336, shots: true, plr: true },
  { n: 'iphone-393x852', w: 393, h: 852, kb: 336 },
  { n: 'iphoneProMax-430x932', w: 430, h: 932, kb: 350 },
  { n: 'android-360x740', w: 360, h: 740, kb: 290, shots: true, plr: true },
  { n: 'android-412x915', w: 412, h: 915, kb: 320 },
  { n: 'tablet-820x1180', w: 820, h: 1180, kb: 400, tablet: true },
  { n: 'desktop-1366x768', w: 1366, h: 768, kb: 0, desktop: true, shots: true, plr: true },
];
const only = (process.argv[5] || '').split(',').filter(Boolean);
const VPS = only.length ? ALL.filter(v => only.includes(v.n)) : ALL;
const b = await chromium.launch();
const errs = []; const fails = []; let checks = 0;
for (const vp of VPS) {
  const ctx = await b.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: vp.desktop ? 1 : 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: !vp.desktop && !vp.tablet, hasTouch: !vp.desktop, acceptDownloads: true });
  const p = await ctx.newPage();
  p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(`${vp.n}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errs.push(`${vp.n}: ${m.text()}`));
  const shot = async (n, force) => { if (SHOTS && (vp.shots || force)) await p.screenshot({ path: `${OUT}/${vp.n}-${n}.png` }); };
  const wait = ms => p.waitForTimeout(ms);
  // botão inteiro dentro da área visível e sem nada por cima (barra de abas, FAB, safe area)
  const check = async (label, sel) => {
    checks++;
    const loc = p.locator(sel).first();
    await loc.waitFor({ state: 'attached', timeout: 4000 }).catch(() => {});
    const r = await loc.evaluate(el => {
      const vv = window.visualViewport; const H = vv ? vv.height : innerHeight;
      const q = el.getBoundingClientRect();
      const pts = [[q.left + q.width / 2, q.top + q.height / 2], [q.left + 4, q.top + 4], [q.right - 4, q.bottom - 4], [q.left + 4, q.bottom - 4], [q.right - 4, q.top + 4]];
      const covered = pts.map(([x, y]) => document.elementFromPoint(x, y)).filter(h => !h || !(el === h || el.contains(h))).map(h => h ? (h.className?.toString?.() || h.tagName) : 'null');
      return { top: Math.round(q.top), bottom: Math.round(q.bottom), H: Math.round(H), inside: q.top >= 0 && q.bottom <= H + 0.5 && q.left >= 0 && q.right <= innerWidth + 0.5 && q.height > 20, covered,
        fab: !!document.querySelector('.fab') && getComputedStyle(document.querySelector('.fab')).display !== 'none' };
    }).catch(e => ({ error: e.message }));
    const ok = r.inside && !r.covered?.length;
    if (!ok) fails.push(`${vp.n} · ${label}: ${JSON.stringify(r)}`);
    return r;
  };
  const kbOn = async (sel) => { if (!vp.kb) { await p.locator(sel).first().scrollIntoViewIfNeeded(); await p.focus(sel); await wait(200); return; } await p.focus(sel); await p.setViewportSize({ width: vp.w, height: vp.h - vp.kb }); await wait(500); await p.locator(sel).first().scrollIntoViewIfNeeded(); await wait(300); };
  const kbOff = async () => { await p.evaluate(() => document.activeElement?.blur()); await p.setViewportSize({ width: vp.w, height: vp.h }); await wait(400); };

  await p.goto(U + '?nosplash');
  await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:nm', '1'); });
  await p.reload(); await wait(700);
  // Termos (primeiro uso): botão Começar alcançável
  await p.locator('.welcome .accept').scrollIntoViewIfNeeded(); await p.click('.welcome .accept'); await wait(200);
  await p.locator('.welcome .btn:not(.ghost)').last().scrollIntoViewIfNeeded(); await wait(200);
  await check('Termos: Começar', '.welcome .btn >> nth=-1'); await shot('00-boas-vindas-comecar');
  await p.locator('.welcome .btn').last().click(); await wait(700);
  if (vp.plr) {
    // ===== Fluxo PLR: salário + cartão + objetivo, sem receitas futuras =====
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data'));
      Object.assign(d, { incomes: [{ id: 'i1', name: 'Salário', amount: 5000 }], expenses: [{ id: 'e1', name: 'Aluguel', amount: 1800, category: 'moradia', kind: 'fixa' }, { id: 'e2', name: 'Mercado', amount: 1200, category: 'alimentacao', kind: 'variavel' }],
        debts: [{ id: 'd1', name: 'Cartão Banco X', type: 'cartao_rotativo', balance: 4000, rate: 12, minPayment: 400 }], reserve: 6000, goals: [{ id: 'g1', name: 'Viagem', type: 'viagem', target: 8000, saved: 1000, date: '2027-07', priority: 'alta' }], receivables: [] });
      localStorage.setItem('jmfinance:data', JSON.stringify(d)); });
    await p.reload(); await wait(800);
    await p.click('nav >> text=Meus dados'); await wait(800);
    await p.locator('#receitas .presets button', { hasText: 'PLR' }).scrollIntoViewIfNeeded(); await p.locator('#receitas .presets button', { hasText: 'PLR' }).click(); await wait(800);
    const vals = p.locator('.recv-form input[data-val="liquido"]');
    const labels = await p.$$eval('.recv-form .inst-row', rs => rs.map(r => `${r.querySelector('.inst-label')?.value} ${r.querySelector('select')?.selectedOptions[0]?.text} liquido=${r.querySelector('input[data-val=liquido]')?.value}`));
    console.log(vp.n, 'PLR preset:', labels.join(' | '), '| campos Valor:', await vals.count());
    checks++; if (await vals.count() !== 2) fails.push(`${vp.n} · PLR sem 2 campos de valor`);
    await vals.nth(0).scrollIntoViewIfNeeded(); await check('PLR: Quanto cai na conta (out)', '.recv-form input[data-val="liquido"] >> nth=0');
    for (const [k, v] of [[0, '3500'], [1, '2200']]) { await vals.nth(k).click(); await wait(150); await vals.nth(k).fill(v); }
    await p.locator('.recv-form .inst-row').nth(0).scrollIntoViewIfNeeded(); await wait(300);
    await shot('20-plr-form-valores-out-fev', true);
    await p.evaluate(() => document.querySelector('.recv-form').scrollTo(0, 1e6)); await wait(300);
    console.log(vp.n, 'prévia:', await p.locator('.recv-form .form-preview').textContent());
    await shot('21-plr-form-previa-salvar', true);
    await check('PLR: Salvar', '.recv-form .modal-actions .btn:not(.ghost)');
    await p.locator('.recv-form .modal-actions .btn:not(.ghost)').click(); await wait(800);
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).receivables);
    console.log(vp.n, 'salvo:', JSON.stringify(saved.map(r => ({ name: r.name, inst: r.installments.map(i => `${i.date}:${i.gross}/${i.net ?? '-'}`) }))));
    checks++; if (!(saved.length === 1 && (saved[0].installments[0].net ?? saved[0].installments[0].gross) === 3500 && saved[0].installments[1].net === 2200)) fails.push(`${vp.n} · PLR não salvou os valores`);
    const item = p.locator('#receitas .recv').first(); await item.scrollIntoViewIfNeeded(); await wait(300);
    const itemTxt = (await item.textContent()).replace(/\u00a0/g, ' ');
    checks++; if (!(itemTxt.includes('R$ 3.500,00') && itemTxt.includes('R$ 2.200,00'))) fails.push(`${vp.n} · lista sem os valores: ${itemTxt}`);
    console.log(vp.n, 'lista:', itemTxt.replace(/\s+/g, ' ').slice(0, 220));
    await p.evaluate(() => { const e = document.querySelector('#receitas .recv'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 80); }); await wait(500);
    await shot('22-plr-lista', true);
    // previsão: tooltip de outubro e fevereiro
    await p.evaluate(() => { const e = document.querySelector('#previsao'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); }); await wait(900);
    const tots = await p.locator('#previsao .fc-tot').textContent(); console.log(vp.n, 'previsão totais:', tots.replace(/\s+/g, ' '));
    checks++; if (!tots.includes('5.700')) fails.push(`${vp.n} · previsão sem R$ 5.700 (3.500 + 2.200): ${tots}`);
    const bars = p.locator('#previsao .recharts-bar-rectangle');
    const box = await p.locator('#previsao .recharts-cartesian-grid').boundingBox();
    const tips = [];
    for (const k of [0, 4]) { await p.mouse.move(box.x + box.width * (k + 0.5) / 12, box.y + box.height / 2); await wait(400); tips.push((await p.locator('#previsao .recharts-tooltip-wrapper').textContent()).replace(/\s+/g, ' ')); }
    console.log(vp.n, 'tooltips:', tips.join(' || '));
    checks++; if (!(tips[0].includes('2.450') && tips[1].includes('1.540'))) fails.push(`${vp.n} · tooltip out/fev inesperado: ${tips.join(' || ')}`);
    await p.mouse.move(box.x + box.width * 0.5 / 12, box.y + box.height / 2); await wait(400);
    await shot('23-plr-previsao-outubro', true);
    // plano
    await p.click('nav >> text=Plano'); await wait(900);
    const stepTxt = (await p.evaluate(() => [...document.querySelectorAll('.card.step')].find(c => c.querySelector('.recv-step'))?.textContent || '')).replace(/\u00a0/g, ' ');
    console.log(vp.n, 'plano:', stepTxt.replace(/\s+/g, ' ').slice(0, 420));
    checks++; if (!(stepTxt.includes('R$ 3.500,00') && stepTxt.includes('R$ 2.200,00'))) fails.push(`${vp.n} · plano sem os valores da PLR`);
    await p.evaluate(() => { const c = [...document.querySelectorAll('.card.step')].find(c => c.querySelector('.recv-step')); scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await wait(900);
    await shot('24-plr-plano', true);
    // sem salário: campo de valor já focado
    await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); d.incomes = [{ id: 'i1', name: 'Freela', amount: 0 }]; localStorage.setItem('jmfinance:data', JSON.stringify(d)); });
    await p.reload(); await wait(800); await p.click('nav >> text=Meus dados'); await wait(800);
    await p.locator('#receitas .presets button', { hasText: 'PLR' }).scrollIntoViewIfNeeded(); await p.locator('#receitas .presets button', { hasText: 'PLR' }).click(); await wait(900);
    const foc = await p.evaluate(() => document.activeElement?.getAttribute('data-val') + ' ' + document.activeElement?.getAttribute('aria-label') + ' placeholder=' + document.activeElement?.getAttribute('placeholder'));
    console.log(vp.n, 'sem salário, foco:', foc); checks++; if (!foc.startsWith('liquido')) fails.push(`${vp.n} · valor não focado sem salário`);
    await p.locator('.recv-form .modal-actions .btn:not(.ghost)').click(); await wait(300);
    console.log(vp.n, 'erro sem valor:', await p.locator('.recv-form .backup-msg.err').textContent());
    await p.locator('.recv-form .inst-row').first().scrollIntoViewIfNeeded(); await wait(200);
    await shot('25-plr-sem-valor-erro', true);
    await p.locator('.recv-form .modal-actions .btn.ghost').click(); await wait(500);
    await p.click('nav >> text=Início'); await wait(700);
  }
  await p.click('text=Carregar dados de EXEMPLO'); await wait(800);
  await p.click('nav >> text=Meus dados'); await wait(700);

  // 1) Receitas futuras — novo (atalho PLR)
  await p.locator('#receitas .presets button').nth(2).scrollIntoViewIfNeeded(); await p.locator('#receitas .presets button', { hasText: 'PLR' }).click(); await wait(700);
  const r1 = await check('Receita futura nova: Salvar', '.recv-form .modal-actions .btn:not(.ghost)');
  await check('Receita futura nova: Cancelar', '.recv-form .modal-actions .btn.ghost');
  if (r1.fab) fails.push(`${vp.n} · FAB visível com formulário aberto`);
  await shot('01-receita-nova-salvar-fixo');
  // teclado (viewport reduzido) no valor bruto
  await kbOn('.recv-form input[data-val="liquido"]');
  await check('Receita futura + teclado: Salvar', '.recv-form .modal-actions .btn:not(.ghost)');
  const kbcls = await p.evaluate(() => document.body.className); if (vp.kb && !kbcls.includes('kb-open')) fails.push(`${vp.n} · kb-open não detectado (${kbcls})`);
  await shot('02-receita-nova-teclado'); await kbOff();
  // salvar de verdade com clique normal
  await p.fill('.recv-form input[data-val="liquido"] >> nth=0', '2800');
  await p.locator('.recv-form .modal-actions .btn:not(.ghost)').click({ timeout: 3000 }); await wait(600);
  const nRecv = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).receivables.length);
  if (nRecv !== 5 && !vp.plr) fails.push(`${vp.n} · salvar não funcionou (${nRecv})`);
  // 2) Editar (✎) — com Excluir
  await p.locator('#receitas button[aria-label^="Editar"]').first().click(); await wait(700);
  await check('Receita futura editar: Salvar', '.recv-form .modal-actions .btn:not(.ghost)');
  await check('Receita futura editar: Excluir', '.recv-form .modal-actions .danger-link');
  await p.evaluate(() => document.querySelector('.recv-form').scrollTo(0, 99999)); await wait(300);
  await check('Receita futura editar (rolado): Salvar', '.recv-form .modal-actions .btn:not(.ghost)');
  await shot('03-receita-editar-rolado');
  await p.locator('.recv-form .modal-actions .btn.ghost').click(); await wait(500);
  // 3) Marcar como recebido (inline)
  const mk = p.locator('#receitas .occ-actions .btn').first(); await mk.scrollIntoViewIfNeeded(); await mk.click(); await wait(400);
  await p.locator('.occ-form .btn').scrollIntoViewIfNeeded(); await wait(300);
  await check('Marcar como recebido: Confirmar', '.occ-form .btn');
  await kbOn('.occ-form input[type="number"]');
  await check('Marcar como recebido + teclado: Confirmar', '.occ-form .btn');
  await shot('04-marcar-recebido-teclado'); await kbOff();
  await p.locator('.occ-form .link').click(); await wait(300);
  // 4) Formulários em linha (rendas, gastos, dívidas, patrimônio) + teclado
  for (const [nm, h] of [['Rendas', 'Rendas mensais'], ['Gastos', 'Gastos mensais'], ['Dívidas', 'Dívidas'], ['Patrimônio', 'Patrimônio (bens e aplicações)']]) {
    const card = p.locator('.card', { has: p.locator(`h3:text-is("${h}")`) }).first();
    const add = card.locator('button.btn.ghost', { hasText: 'Adicionar' }).last();
    await add.scrollIntoViewIfNeeded(); await wait(200);
    await check(`${nm}: + Adicionar`, `.card:has(h3:text-is("${h}")) button.btn.ghost:has-text("Adicionar") >> nth=-1`);
    const lastInput = `.card:has(h3:text-is("${h}")) input:not([type=checkbox]) >> nth=-1`;
    await kbOn(lastInput); await check(`${nm} + teclado: último campo`, lastInput);
    if (nm === 'Dívidas') await shot('05-dividas-teclado');
    await kbOff();
  }
  // Renda variável: + mês anterior
  await p.locator('.var-actions .btn, .income .btn.ghost.sm').first().scrollIntoViewIfNeeded().catch(() => {});
  // 5) Backup: importar → modal de confirmação
  const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('button', { hasText: 'Exportar backup' }).click()]);
  await dl.saveAs('/tmp/v9-backup.json');
  await p.setInputFiles('input[type=file]', '/tmp/v9-backup.json'); await wait(800);
  await check('Backup importar: Substituir', '.modal .modal-actions .btn:not(.ghost)');
  await check('Backup importar: Cancelar', '.modal .modal-actions .btn.ghost');
  await shot('06-backup-importar-modal');
  await p.locator('.modal .modal-actions .btn.ghost').click(); await wait(500);
  // 6) Fechar mês (modal)
  await p.locator('button', { hasText: 'Fechar mês' }).first().scrollIntoViewIfNeeded(); await p.locator('button', { hasText: 'Fechar mês' }).first().click(); await wait(600);
  await check('Fechar mês: confirmar', '.modal .modal-actions .btn:not(.ghost)');
  await p.locator('.modal .modal-actions .btn.ghost').click(); await wait(500);
  // 7) Objetivos: último campo + botão + teclado
  await p.click('nav >> text=Objetivos'); await wait(800);
  await p.locator('button', { hasText: '+ Adicionar objetivo' }).scrollIntoViewIfNeeded(); await wait(200);
  await check('Objetivos: + Adicionar objetivo', 'button:has-text("+ Adicionar objetivo")');
  await kbOn('main input:not([type=checkbox]) >> nth=-1'); await check('Objetivos + teclado: último campo', 'main input:not([type=checkbox]) >> nth=-1');
  await shot('07-objetivos-teclado'); await kbOff();
  // 8) Simulador: formulário + fim da página
  await p.click('nav >> text=Plano'); await wait(800); await p.locator('.sim-item').click(); await wait(900); await p.locator('.sim-list .sim-item').first().click(); await wait(900);
  await kbOn('main input[inputmode="decimal"] >> nth=-1'); await check('Simulador + teclado: último campo', 'main input[inputmode="decimal"] >> nth=-1'); await kbOff();
  if (await p.locator('button:has-text("Salvar como objetivo")').count()) { await p.locator('button:has-text("Salvar como objetivo")').scrollIntoViewIfNeeded(); await wait(300); await check('Simulador: Salvar como objetivo', 'button:has-text("Salvar como objetivo")'); }
  await p.evaluate(() => scrollTo(0, 1e6)); await wait(500);
  const endGap = await p.evaluate(() => { const els = [...document.querySelectorAll('main .card, main .btn')]; const last = els[els.length - 1]; const nav = document.querySelector('nav').getBoundingClientRect(); const fab = document.querySelector('.fab')?.getBoundingClientRect(); return { lastBottom: Math.round(last.getBoundingClientRect().bottom), navTop: Math.round(nav.top), fabTop: fab ? Math.round(fab.top) : null }; });
  checks++; if (endGap.lastBottom > Math.min(endGap.navTop, endGap.fabTop ?? 1e9)) fails.push(`${vp.n} · fim do Simulador sob a barra/FAB: ${JSON.stringify(endGap)}`);
  await shot('08-simulador-fim');
  // fim de cada aba acima da barra e do FAB
  for (const t of ['Início', 'Meus dados', 'Diagnóstico', 'Plano', 'Objetivos']) {
    await p.click(`nav >> text=${t}`); await wait(800); await p.evaluate(() => scrollTo(0, 1e6)); await wait(500);
    const g = await p.evaluate(() => { const els = [...document.querySelectorAll('main > div > *')]; const last = els[els.length - 1]; const nav = document.querySelector('nav').getBoundingClientRect(); const fab = document.querySelector('.fab')?.getBoundingClientRect(); return { lastBottom: Math.round(last.getBoundingClientRect().bottom), navTop: Math.round(nav.top), fabTop: fab ? Math.round(fab.top) : null }; });
    checks++; if (g.lastBottom > Math.min(g.navTop, g.fabTop ?? 1e9)) fails.push(`${vp.n} · fim da aba ${t} sob a barra/FAB: ${JSON.stringify(g)}`);
  }
  // 9) Alertas (folha) — rolar até o fim
  await p.click('.bell'); await wait(700);
  await p.evaluate(() => document.querySelector('.sheet').scrollTo(0, 1e6)); await wait(300);
  await check('Alertas: último botão', '.sheet button >> nth=-1');
  if (await p.evaluate(() => getComputedStyle(document.querySelector('.fab')).display !== 'none')) fails.push(`${vp.n} · FAB visível com alertas abertos`);
  await shot('09-alertas-fim');
  await p.click('.sheet .chat-back'); await wait(500);
  // 10) Termos e privacidade (folha) + modal de apagar
  await p.click('nav >> text=Início'); await wait(800);
  await p.locator('button', { hasText: 'Termos e privacidade' }).scrollIntoViewIfNeeded(); await p.locator('button', { hasText: 'Termos e privacidade' }).click(); await wait(700);
  await p.evaluate(() => document.querySelector('.terms-sheet').scrollTo(0, 1e6)); await wait(300);
  await check('Termos: Apagar todos os dados (botão)', '.danger-zone .btn');
  await p.click('.danger-zone .btn'); await wait(600);
  await check('Termos: modal Apagar tudo', '.modal .modal-actions .btn:not(.ghost)');
  await check('Termos: modal Cancelar', '.modal .modal-actions .btn.ghost');
  await shot('10-termos-apagar-modal');
  await p.locator('.modal .modal-actions .btn.ghost').click(); await wait(400); await p.click('.terms-sheet .chat-back'); await wait(500);
  // 11) Consultor + teclado
  await p.click('.fab'); await wait(900);
  await kbOn('.chat-input input, .chat-input textarea');
  await check('Consultor + teclado: Enviar', '.chat-input button');
  await check('Consultor + teclado: campo', '.chat-input input, .chat-input textarea');
  await shot('11-consultor-teclado'); await kbOff();
  await ctx.close();
  console.log(vp.n, 'ok');
}
await b.close();
console.log('checagens:', checks, '| falhas:', fails.length ? '\n  ' + fails.join('\n  ') : 'nenhuma');
console.log('erros:', errs.length ? errs.join('\n') : 'nenhum');
