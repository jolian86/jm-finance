import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v10';
const TAG = process.argv[4] || '';
const SHOT = (process.argv[5] || '360x740,390x844,1366x768').split(',');
const ONLY = (process.argv[6] || '').split(',').filter(Boolean);
const VPS = [[375, 667], [390, 844], [360, 740], [412, 915], [430, 932], [820, 1180, 'tablet'], [1366, 768, 'desktop']].filter(([w, h]) => !ONLY.length || ONLY.includes(`${w}x${h}`));
const b = await chromium.launch(); const errs = []; const fails = [];
for (const [w, h, kind] of VPS) {
  const n = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: kind === 'desktop' ? 1 : 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: !kind, hasTouch: kind !== 'desktop' });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(`${n}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errs.push(`${n}: ${m.text()}`));
  await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:nm', '1'); }); await p.reload(); await p.waitForTimeout(600);
  await p.click('.welcome .accept'); await p.locator('.welcome .btn').last().click(); await p.waitForTimeout(600);
  await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(800);
  // valores grandes para checar se cabem
  await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); d.expenses[0].amount = 10000; d.expenses[0].dueDay = 28; d.expenses[2].category = 'alimentacao'; d.incomes[0].amount = 12500.5; d.debts[0].balance = 10000; d.debts[0].dueDay = 31; localStorage.setItem('jmfinance:data', JSON.stringify(d)); });
  await p.reload(); await p.waitForTimeout(700);
  await p.click('nav >> text=Meus dados'); await p.waitForTimeout(900);
  await p.addStyleTag({ content: '.fab{display:none!important}' });
  // ---- Gastos: planejado x gasto até agora ----
  const gone = await p.locator('h3:has-text("Gasto real deste mês")').count(); if (gone) fails.push(`${n} · cartão antigo "Gasto real deste mês" ainda aparece`);
  const cat = t => p.locator(`section.cat-card[aria-label="Categoria ${t}"]`);
  await cat('Moradia').locator('.paid-toggle input').check(); await p.waitForTimeout(250);
  const fillA = async (t, v) => { const i = cat(t).locator('.cat-cell input'); await i.click(); await i.fill(v); await i.blur(); await p.waitForTimeout(250); };
  await fillA('Alimentação', '1150'); await fillA('Transporte', '200'); await fillA('Lazer', '640');
  const st = await p.evaluate(() => [...document.querySelectorAll('section.cat-card')].map(s => `${s.getAttribute('aria-label').replace('Categoria ', '')}[${s.className.replace('cat-card ', '')}] ${s.querySelector('.cat-sentence').textContent.replace(/\u00a0/g, ' ')}`));
  const act = await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).actuals);
  if (n === '390x844') { console.log(st.join('\n')); console.log('actuals:', JSON.stringify(act)); }
  const want = { Moradia: 'paid', 'Alimentação': 'near', Transporte: 'ok', Lazer: 'over' };
  for (const [k, v] of Object.entries(want)) if (!st.find(x => x.startsWith(`${k}[${v}]`))) fails.push(`${n} · ${k} deveria ser ${v}: ${st.find(x => x.startsWith(k))}`);
  if (!(act.moradia === 10350 && act.alimentacao === 1150 && act.transporte === 200 && act.lazer === 640)) fails.push(`${n} · actuals inesperados ${JSON.stringify(act)}`);
  // desmarcar "Já paguei" remove o lançamento
  await cat('Moradia').locator('.paid-toggle input').uncheck(); await p.waitForTimeout(200);
  if ((await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')).actuals.moradia)) !== undefined) fails.push(`${n} · desmarcar Já paguei não limpou`);
  await cat('Moradia').locator('.paid-toggle input').check(); await p.waitForTimeout(200);
  const alertsN = await p.evaluate(() => document.querySelector('.bell-badge')?.textContent); if (n === '390x844') console.log('badge alertas:', alertsN);
  await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(300);
  // ---- Patrimônio: sem escolha de liquidez; classificação automática ----
  const assetCard = p.locator('.card', { has: p.locator('h3:text-is("Patrimônio (bens e aplicações)")') });
  if (await assetCard.locator('select', { has: p.locator('option:text-is("Ilíquido")') }).count()) fails.push(`${n} · ainda pede líquido/ilíquido`);
  const firstType = assetCard.locator('.f-type select').first();
  await firstType.selectOption('invest_rapido'); await p.waitForTimeout(250);
  const auto1 = await assetCard.locator('.asset-auto').first().textContent();
  await firstType.selectOption('invest_longo'); await p.waitForTimeout(250);
  const auto2 = await assetCard.locator('.asset-auto').first().textContent();
  if (!auto1.startsWith('✓ Disponível rápido') || auto2.startsWith('✓')) fails.push(`${n} · classificação automática errada: ${auto1} | ${auto2}`);
  await firstType.selectOption('veiculo'); await p.waitForTimeout(250);
  if (n === '390x844') console.log('auto:', auto1, '||', auto2);
  // ---- Previdência e seguro de vida ----
  const DD = () => p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')));
  const longs = assetCard.locator('.debt.asset.long'); const pv = longs.nth(0), sg = longs.nth(1);
  if ((await longs.count()) !== 2) fails.push(`${n} · exemplo deveria ter previdência e seguro (${await longs.count()})`);
  for (const [loc, nm] of [[pv, 'previdência'], [sg, 'seguro']]) { const t = await loc.locator('.asset-auto').textContent(); if (!t.startsWith('Fora da reserva') || !/emergência/.test(t)) fails.push(`${n} · nota ${nm}: ${t}`); if (!(await loc.locator('.asset-extra input[type=checkbox]').isChecked())) fails.push(`${n} · ${nm} deveria estar lançado em gastos`); }
  let D0 = await DD(); const tot0 = D0.expenses.reduce((s, e) => s + e.amount, 0);
  const cntPrev = d => d.expenses.filter(e => e.name === 'Previdência').length;
  if (cntPrev(D0) !== 1) fails.push(`${n} · gasto Previdência deveria existir 1x`);
  // mudar o aporte na previdência atualiza o MESMO gasto (sem duplicar)
  const pvMonthly = pv.locator('.f-money input').nth(1); await pvMonthly.click(); await pvMonthly.fill('200'); await pvMonthly.blur(); await p.waitForTimeout(250);
  let D1 = await DD(); const tot1 = D1.expenses.reduce((s, e) => s + e.amount, 0);
  if (!(cntPrev(D1) === 1 && D1.expenses.find(e => e.name === 'Previdência').amount === 200 && Math.abs(tot1 - tot0 - 50) < 0.01)) fails.push(`${n} · aporte não sincronizou: ${cntPrev(D1)}x total ${tot0}->${tot1}`);
  // desmarcar remove o gasto; marcar de novo cria só um
  await pv.locator('.asset-extra input[type=checkbox]').uncheck(); await p.waitForTimeout(250); D1 = await DD();
  if (cntPrev(D1) !== 0 || D1.assets.find(a => a.type === 'previdencia').monthly !== 200) fails.push(`${n} · desmarcar lançamento: ${cntPrev(D1)} ${JSON.stringify(D1.assets.find(a => a.type === 'previdencia'))}`);
  const outNote = await pv.locator('.asset-goal').textContent(); if (!outNote.includes('Para o valor mensal também contar')) fails.push(`${n} · falta aviso de aporte fora do orçamento`);
  await pv.locator('.asset-extra input[type=checkbox]').check(); await p.waitForTimeout(250); D1 = await DD();
  if (cntPrev(D1) !== 1 || D1.expenses.find(e => e.name === 'Previdência').category !== 'protecao') fails.push(`${n} · remarcar lançamento: ${cntPrev(D1)}`);
  if (await p.locator('section.cat-card[aria-label="Categoria Previdência e seguros"]').count() !== 1) fails.push(`${n} · categoria Previdência e seguros não aparece em Gastos`);
  const pvHint = await pv.locator('.asset-extra .fhint').first().textContent(); if (!pvHint.includes('contado uma vez')) fails.push(`${n} · falta dica de não contar 2x`);
  if (SHOT.includes(n)) { await pv.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 140)); await p.waitForTimeout(400); await p.screenshot({ path: `${OUT}/${TAG}${n}-patrimonio-previdencia-seguro.png` }); }
  // objetivo de aposentadoria usa o saldo e o aporte
  await p.click('nav >> text=Objetivos'); await p.waitForTimeout(900);
  const retire = p.locator('.card.goal', { has: p.locator('.goal-name:text-is("Aposentadoria")') });
  const pnote = (await retire.locator('.prev-note:not(.rate-note)').textContent()).replace(/\u00a0/g, ' ');
  if (!(pnote.includes('R$ 8.500,00') && pnote.includes('R$ 200,00/mês'))) fails.push(`${n} · nota previdência no objetivo: ${pnote}`);
  const needWith = await retire.locator('.finding > b').first().textContent();
  if (n === '390x844') console.log('objetivo:', needWith.replace(/\u00a0/g, ' '), '|', pnote);
  if (SHOT.includes(n)) { await retire.scrollIntoViewIfNeeded(); await p.evaluate(() => { const c = [...document.querySelectorAll('.card.goal')].find(c => c.querySelector('.goal-name')?.textContent === 'Aposentadoria'); scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${TAG}${n}-objetivo-aposentadoria-com-previdencia.png` }); }
  // "não usar" tira do objetivo; o link volta
  await p.click('nav >> text=Meus dados'); await p.waitForTimeout(900); await p.addStyleTag({ content: '.fab{display:none!important}' });
  await pv.locator('.asset-goal button:has-text("não usar")').click(); await p.waitForTimeout(250);
  await p.click('nav >> text=Objetivos'); await p.waitForTimeout(700);
  const needWithout = await retire.locator('.finding > b').first().textContent();
  if ((await retire.locator('.prev-note:not(.rate-note)').count()) || needWithout === needWith) fails.push(`${n} · "não usar" não tirou a previdência do objetivo (${needWith} / ${needWithout})`);
  await p.click('nav >> text=Meus dados'); await p.waitForTimeout(900); await p.addStyleTag({ content: '.fab{display:none!important}' });
  await pv.locator('button:has-text("Usar no objetivo de aposentadoria")').click(); await p.waitForTimeout(250);
  if (!(await DD()).assets.find(a => a.type === 'previdencia').forRetirement) fails.push(`${n} · link "Usar no objetivo" não marcou`);
  // diagnóstico: não entra no disponível rápido, entra no total
  await p.click('nav >> text=Diagnóstico'); await p.waitForTimeout(2500);
  const stats = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('.stat')].map(s => [s.querySelector('small,span,.stat-l')?.textContent || s.textContent.slice(0, 20), s.textContent.replace(/\u00a0/g, ' ')])));
  const sv = k => Object.values(stats).find(t => t.includes(k)) || '';
  if (n === '390x844') console.log('diag:', sv('Disponível rápido'), '|', sv('Tudo o que você tem'), '|', sv('Quanto você tem de verdade'));
  const DX = await DD(); const fmt = v => 'R$ ' + Math.round(v).toLocaleString('pt-BR'); const liqTypes = ['conta', 'invest_rapido'];
  const expLiq = fmt(DX.reserve + DX.assets.filter(a => liqTypes.includes(a.type)).reduce((t, a) => t + a.value, 0)), expTot = fmt(DX.reserve + DX.assets.reduce((t, a) => t + a.value, 0));
  if (n === '390x844') console.log('esperado:', expLiq, expTot, 'prev+seguro =', fmt(DX.assets.filter(a => ['previdencia', 'seguro_vida'].includes(a.type)).reduce((t, a) => t + a.value, 0)));
  if (!sv('Disponível rápido').includes(expLiq) || !sv('Tudo o que você tem').includes(expTot)) fails.push(`${n} · diagnóstico: ${sv('Disponível rápido')} | ${sv('Tudo o que você tem')}`);
  await p.click('nav >> text=Meus dados'); await p.waitForTimeout(900); await p.addStyleTag({ content: '.fab{display:none!important}' });
  // ---- Dívidas: "Não sei a taxa", unidades, 0%, decimais ----
  const debtCard = p.locator('.card', { has: p.locator('h3:text-is("Dívidas")') });
  await debtCard.locator('button:has-text("+ Adicionar dívida")').click(); await p.waitForTimeout(400);
  const nd = debtCard.locator('.debt').last();
  const money = nd.locator('.f-money input'); const instIn = nd.locator('.f-n input');
  const typeM = async (loc, v) => { await loc.click(); await loc.fill(''); await loc.pressSequentially(v, { delay: 15 }); await loc.blur(); await p.waitForTimeout(200); };
  const D = () => p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')).debts; return d[d.length - 1]; });
  await typeM(money.nth(0), '10000'); await typeM(money.nth(1), '459,05'); await typeM(instIn, '24');
  const calcTxt = (await nd.locator('.rate-calc').textContent()).replace(/\u00a0/g, ' '); const endTxt = await nd.locator('.debt-end').textContent();
  let dd = await D(); if (!(calcTxt.includes('0,79% ao mês ≈ 9,90% ao ano') && Math.abs(dd.rate - 0.79) < 0.001 && endTxt.includes('setembro de 2028'))) fails.push(`${n} · cálculo da taxa: ${calcTxt} | ${endTxt} | ${dd.rate}`);
  if (n === '390x844') console.log('calc:', calcTxt, '|', endTxt, '| rate', dd.rate);
  if (SHOT.includes(n)) { await nd.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 120)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${n}-divida-nao-sei-a-taxa.png` }); }
  await typeM(money.nth(1), '400'); const warn = await nd.locator('.rate-calc').textContent(); if (!warn.includes('somam')) fails.push(`${n} · aviso parcelas < saldo ausente: ${warn}`);
  if (SHOT.includes(n)) { await p.screenshot({ path: `${OUT}/${n}-divida-aviso-parcelas-menor-que-saldo.png` }); }
  await typeM(money.nth(1), '416,67'); const zero = await nd.locator('.rate-calc').textContent(); dd = await D(); if (!(zero.includes('sem juros (0%)') && dd.rate === 0)) fails.push(`${n} · 0% calculado: ${zero} ${dd.rate}`);
  // Sei a taxa: digitação com vírgula, zero à esquerda, ao mês e ao ano
  await nd.getByRole('radio', { name: 'Sei a taxa', exact: true }).click(); await p.waitForTimeout(300);
  const rateIn = nd.locator('.rate-in input');
  const res = [];
  for (const unit of ['% ao mês', '% ao ano']) {
    await nd.getByRole('radio', { name: unit, exact: true }).click(); await p.waitForTimeout(200);
    for (const v of ['0,5', '0,79', '0,0125', '12,5']) {
      await rateIn.click(); await rateIn.fill(''); await rateIn.pressSequentially(v, { delay: 20 });
      const typed = await rateIn.inputValue(); dd = await D();
      const exp = unit === '% ao mês' ? Number(v.replace(',', '.')) : (Math.pow(1 + Number(v.replace(',', '.')) / 100, 1 / 12) - 1) * 100;
      const eq = (await nd.locator('.rate-eq').textContent()).replace(/\u00a0/g, ' ');
      res.push(`${unit} ${v}: campo="${typed}" am=${dd.rate.toFixed(6)} [${eq}]`);
      if (typed !== v || Math.abs(dd.rate - exp) > 1e-6) fails.push(`${n} · digitar ${v} (${unit}): campo="${typed}" rate=${dd.rate} esperado ${exp}`);
    }
  }
  await rateIn.click(); await rateIn.fill(''); await rateIn.pressSequentially('0', { delay: 20 }); await rateIn.blur(); await p.waitForTimeout(200);
  dd = await D(); const eq0 = await nd.locator('.rate-eq').textContent(); if (!(dd.rate === 0 && eq0.includes('Sem juros'))) fails.push(`${n} · 0% digitado: ${dd.rate} ${eq0}`);
  if (n === '390x844') console.log(res.join('\n'));
  await rateIn.click(); await rateIn.fill(''); await rateIn.pressSequentially('10,5', { delay: 20 }); await rateIn.blur();
  await nd.locator('.f-type select').selectOption('financiamento_imovel'); await p.waitForTimeout(300);
  dd = await D(); if (dd.rateUnit !== 'aa') fails.push(`${n} · financiamento imóvel deveria ir para a.a.`);
  if (SHOT.includes(n)) { await nd.scrollIntoViewIfNeeded(); await p.evaluate(() => scrollBy(0, 160)); await p.waitForTimeout(300); await p.screenshot({ path: `${OUT}/${n}-divida-sei-a-taxa-ao-ano.png` }); }
  // plano e diagnóstico sem NaN com dívida 0%
  await typeM(rateIn, '0');
  await p.click('nav >> text=Plano'); await p.waitForTimeout(900);
  const planTxt = await p.evaluate(() => document.querySelector('main').innerText); if (/NaN|Infinity|undefined/.test(planTxt)) fails.push(`${n} · plano com NaN/Infinity`);
  await p.click('nav >> text=Diagnóstico'); await p.waitForTimeout(900);
  const diagTxt = await p.evaluate(() => document.querySelector('main').innerText); if (/NaN|Infinity|undefined/.test(diagTxt)) fails.push(`${n} · diagnóstico com NaN/Infinity`);
  await p.click('nav >> text=Meus dados'); await p.waitForTimeout(900);
  const audit = await p.evaluate(() => {
    const out = []; const vw = document.documentElement.clientWidth;
    if (document.documentElement.scrollWidth > vw + 1) out.push(`overflow horizontal da página: ${document.documentElement.scrollWidth} > ${vw}`);
    const cards = [...document.querySelectorAll('main .card')];
    for (const c of cards) { const cr = c.getBoundingClientRect(); for (const el of c.querySelectorAll('input:not([type=checkbox]):not([type=radio]),select,button.x')) { if (el.closest('.sheet-wrap') || el.offsetParent === null) continue; const r = el.getBoundingClientRect(); if (r.right > cr.right - 2 || r.left < cr.left + 2) out.push(`fora do cartão: ${c.querySelector('h3')?.textContent} ${el.tagName} ${el.getAttribute('aria-label') || el.placeholder || ''} ${Math.round(r.left)}-${Math.round(r.right)} vs ${Math.round(cr.left)}-${Math.round(cr.right)}`); } }
    const m = s => [...document.querySelectorAll(s)].filter(e => e.offsetParent).map(e => Math.round(e.getBoundingClientRect().width));
    // cabe o texto? (scrollWidth > clientWidth em select = cortado)
    const cut = [...document.querySelectorAll('main select')].filter(e => e.offsetParent).map(s => { const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(s); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const tw = c.measureText(s.selectedOptions[0]?.text || '').width; const avail = s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return tw > avail + 1 ? `${s.selectedOptions[0]?.text} (${Math.round(tw)}>${Math.round(avail)})` : null; }).filter(Boolean);
    const inputs = [...document.querySelectorAll('main input[type=number], main input[data-money]')].filter(e => e.offsetParent && e.value).map(i => { const c = document.createElement('canvas').getContext('2d'); const cs = getComputedStyle(i); c.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const tw = c.measureText(i.value).width + (i.classList.contains('due') ? 2 : 16); const avail = i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight); return tw > avail ? `${i.getAttribute('aria-label') || ''}=${i.value} (${Math.round(tw)}>${Math.round(avail)})` : null; }).filter(Boolean);
    return { out, cut, inputs, money: m('main .card .money input, main .card input[data-money]').slice(0, 3), due: m('main .card input.due, main .card .due input').slice(0, 3), names: m('main .exp-name, main .row>input:first-child').slice(0, 3) };
  });
  console.log(n, JSON.stringify({ money: audit.money, due: audit.due, names: audit.names }));
  for (const x of [...audit.out, ...audit.cut.map(c => 'select cortado: ' + c), ...audit.inputs.map(c => 'valor cortado: ' + c)]) fails.push(`${n} · ${x}`);
  if (SHOT.includes(n)) {
    const sc = async (h3, name) => { await p.evaluate(t => { const c = [...document.querySelectorAll('main .card')].find(c => c.querySelector('h3')?.textContent.startsWith(t)); scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }, h3); await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${TAG}${n}-${name}.png` }); };
    await sc('Gastos mensais', 'gastos-moradia-paga');
    await p.evaluate(() => { const c = document.querySelector('section.cat-card[aria-label="Categoria Alimentação"]'); scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${TAG}${n}-gastos-alimentacao-80.png` });
    await p.evaluate(() => { const c = document.querySelector('section.cat-card[aria-label="Categoria Lazer"]'); scrollTo(0, c.getBoundingClientRect().top + scrollY - 70); }); await p.waitForTimeout(500);
    await p.screenshot({ path: `${OUT}/${TAG}${n}-gastos-lazer-estourado.png` });
    if (!TAG) { await sc('Rendas mensais', 'rendas'); await sc('Dívidas', 'dividas'); await sc('Patrimônio (bens', 'patrimonio-automatico');
      await p.click('nav >> text=Diagnóstico'); await p.waitForTimeout(900); await sc('O que você tem', 'diagnostico-disponivel-rapido');
      const st = await p.evaluate(() => [...document.querySelectorAll('.stat')].map(s => s.textContent).find(t => t.includes('Disponível rápido')) || ''); if (!st.includes('poucos dias')) fails.push(`${n} · stat Disponível rápido ausente`); }
  }
  await ctx.close();
}
await b.close();
console.log('falhas:', fails.length ? '\n  ' + fails.join('\n  ') : 'nenhuma'); console.log('erros:', errs.length ? errs.join('\n') : 'nenhum');
