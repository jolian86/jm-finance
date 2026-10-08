import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const ONLY = (process.argv[3] || '').split(',').filter(Boolean);
const VPS = [[375, 667], [390, 844], [360, 740], [412, 915], [430, 932], [820, 1180, 'tablet'], [1366, 768, 'desktop']].filter(([w, h]) => !ONLY.length || ONLY.includes(`${w}x${h}`));
const BAN = /\ba\.m\.|\ba\.a\.|ponderad|avalanche|bola de neve|patrim[oô]nio l[ií]quido|patrim[oô]nio total|comprometimento|liquidez|\bCDI\b|amortiza|superendivid|\baporte|rendimento real|saldo devedor|il[ií]quido|50\/30\/20|só garantido|pagamento m[ií]nimo|\bbruto\b/i;
const b = await chromium.launch(); const errs = []; const fails = []; let checks = 0;
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
for (const [w, h, kind] of VPS) {
  const n = `${w}x${h}`;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: kind === 'desktop' ? 1 : 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: !kind, hasTouch: kind !== 'desktop' });
  const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(`${n}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errs.push(`${n}: ${m.text()}`));
  const wait = ms => p.waitForTimeout(ms);
  const DD = () => p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')));
  const scan = async (where) => {
    const t = await p.evaluate(() => document.querySelector('main').innerText);
    const m = t.match(BAN); ok(!m, `${n} · jargão em ${where}: "${m?.[0]}" …${m ? t.slice(Math.max(0, m.index - 60), m.index + 40).replace(/\n/g, ' ') : ''}`);
    ok(!/NaN|Infinity|undefined/.test(t), `${n} · NaN/undefined em ${where}`);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(ov <= 1, `${n} · overflow horizontal em ${where}: ${ov}px`);
  };
  await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:nm', '1'); }); await p.reload(); await wait(600);
  await p.click('.welcome .accept'); await p.locator('.welcome .btn').last().click(); await wait(600);
  await p.click('text=Carregar dados de EXEMPLO'); await wait(800);
  await scan('Início');
  await p.click('nav >> text=Meus dados'); await wait(900); await p.addStyleTag({ content: '.fab{display:none!important}' });
  await scan('Meus dados');
  // 1) Fixo/variável: sem escolha obrigatória; chip opcional
  const gastos = p.locator('.card', { has: p.locator('h3:text-is("Gastos mensais")') });
  ok(!(await gastos.locator('select', { has: p.locator('option:text-is("Fixo"), option:text-is("Variável"), option:text-is("Fixa")') }).count()), `${n} · ainda há seletor Fixo/Variável`);
  const nExp = (await DD()).expenses.length; ok((await gastos.locator('.kind-chip').count()) === nExp, `${n} · chips de tipo ≠ gastos`);
  const row = gastos.locator('.exp', { has: p.locator('input.row-name[value="Mercado"]') }).first();
  const chip = row.locator('.kind-chip'); ok((await chip.textContent()) === 'varia', `${n} · Mercado deveria ser "varia"`);
  await chip.click(); await wait(200); ok(await row.locator('.kind-adj').isVisible(), `${n} · ajuste do tipo não abriu`);
  await row.locator('.kind-adj input[type=radio]').first().check(); await wait(200);
  let e = (await DD()).expenses.find(x => x.name === 'Mercado'); ok(e.kind === 'fixa' && e.kindSet === true, `${n} · override fixo não salvou ${JSON.stringify(e)}`);
  await row.locator('.kind-adj button:has-text("voltar ao automático")').click(); await wait(200);
  e = (await DD()).expenses.find(x => x.name === 'Mercado'); ok(e.kind === 'variavel' && e.kindSet === false, `${n} · voltar ao automático ${JSON.stringify(e)}`);
  await chip.click(); await wait(150);
  // renomear muda o tipo automático
  const nm = row.locator('input.row-name'); await nm.fill('Aluguel garagem'); await wait(200);
  e = (await DD()).expenses.find(x => x.name === 'Aluguel garagem'); ok(e?.kind === 'fixa' && !e.kindSet, `${n} · tipo automático pelo nome ${JSON.stringify(e)}`);
  await gastos.locator('.exp', { has: p.locator('input.row-name[value="Aluguel garagem"]') }).locator('input.row-name').fill('Mercado'); await wait(200);
  // 2–3) Rotativo: taxa média pré-selecionada + pagamento automático
  const debtCard = p.locator('.card', { has: p.locator('h3:text-is("Dívidas")') });
  await debtCard.locator('button:has-text("+ Adicionar dívida")').click(); await wait(300);
  const nd = debtCard.locator('.debt').last();
  await nd.locator('.f-type select').selectOption('cartao_rotativo'); await wait(250);
  const bal = nd.locator('.f-money input').nth(0); await bal.click(); await bal.fill('2000'); await bal.blur(); await wait(250);
  let dd = (await DD()).debts.at(-1);
  ok(dd.rateMode === 'media' && dd.rate === 15 && dd.minPayment === 300 && dd.payAuto, `${n} · rotativo padrão: ${JSON.stringify(dd)}`);
  const rc = (await nd.locator('.rate-calc').textContent()).replace(/\u00a0/g, ' '); ok(rc.includes('15% ao mês') && rc.includes('estimativa'), `${n} · nota taxa média: ${rc}`);
  ok(await nd.getByRole('radio', { name: 'Usar taxa média' }).getAttribute('aria-checked') === 'true', `${n} · "Usar taxa média" não pré-selecionado`);
  const ph = (await nd.locator('.pay-hint').textContent()).replace(/\u00a0/g, ' '); ok(ph.includes('15%') && ph.includes('R$ 300'), `${n} · dica pagamento: ${ph}`);
  if (n === '390x844') console.log('rotativo:', rc, '|', ph);
  const pay = nd.locator('.f-money input').nth(1); await pay.click(); await pay.fill('500'); await pay.blur(); await wait(200);
  dd = (await DD()).debts.at(-1); ok(dd.minPayment === 500 && !dd.payAuto, `${n} · pagamento digitado ${JSON.stringify(dd)}`);
  await bal.click(); await bal.fill('3000'); await bal.blur(); await wait(200);
  dd = (await DD()).debts.at(-1); ok(dd.minPayment === 500, `${n} · pagamento digitado foi sobrescrito ${dd.minPayment}`);
  await nd.locator('.f-type select').selectOption('cheque_especial'); await wait(200); dd = (await DD()).debts.at(-1); ok(dd.rate === 7.5 && dd.rateMode === 'media', `${n} · cheque média ${JSON.stringify(dd)}`);
  await nd.getByRole('radio', { name: 'Sei a taxa', exact: true }).click(); await wait(200); dd = (await DD()).debts.at(-1); ok(dd.rateMode === 'sei', `${n} · Sei a taxa`);
  await nd.locator('button.x').first().click(); await wait(200);
  // 4–5) Receitas futuras
  await p.locator('#receitas .presets button.ghost').click(); await wait(800);
  const form = p.locator('.recv-form');
  ok(await form.locator('label:has-text("Quanto cai na sua conta?")').first().isVisible(), `${n} · "Quanto cai na sua conta?" ausente`);
  ok((await form.locator('.cert-pick button').allTextContents()).map(t => t.trim()).join('|').match(/^Com certeza.*\|Provavelmente.*\|Talvez/), `${n} · certeza sem palavras simples`);
  ok(!(await form.locator('label:has-text("Chance de receber")').count()), `${n} · chance % visível sem abrir Ajustar`);
  ok(!(await form.locator('input[data-val="bruto"]').count()), `${n} · campo bruto visível por padrão`);
  await form.locator('.cert-pick button', { hasText: 'Provavelmente' }).click();
  const v = form.locator('input[data-val="liquido"]').first(); await v.click(); await wait(150); await v.fill('1500');
  await form.locator('.adv-toggle').click(); await wait(200); ok(await form.locator('label:has-text("Chance de receber")').isVisible(), `${n} · Ajustar não mostra a chance`);
  const formTxt = await form.innerText(); const fm = formTxt.replace(/Sei só o valor bruto[^\n]*|Valor bruto[^\n]*/g, '').match(BAN); ok(!fm, `${n} · jargão no formulário: ${fm?.[0]}`);
  await form.locator('input[name], label:has-text("Nome") input').first().fill('Freela teste');
  await form.locator('.modal-actions .btn:not(.ghost)').click(); await wait(600);
  const rv = (await DD()).receivables.find(r => r.name === 'Freela teste'); ok(rv && rv.installments[0].net === 1500 && rv.certainty === 'provavel' && rv.prob === 70, `${n} · receita salva ${JSON.stringify(rv)}`);
  // 6) Objetivos: rendimento escondido
  await p.click('nav >> text=Objetivos'); await wait(900); await scan('Objetivos');
  const retire = p.locator('.card.goal', { has: p.locator('.goal-name:text-is("Aposentadoria")') });
  ok(!(await retire.locator('label:has-text("Rendimento")').count()), `${n} · "Rendimento" ainda visível no objetivo`);
  await retire.locator('.adv-toggle').click(); await wait(200);
  const rIn = retire.locator('label:has-text("acima da inflação") input'); ok((await rIn.inputValue()) === '4', `${n} · padrão 4% ao ano: ${await rIn.inputValue()}`);
  // 7) Simulador
  await p.click('nav >> text=Plano'); await wait(900); await scan('Plano');
  await p.locator('.sim-item').first().click(); await wait(900);
  const nSims = await p.locator('.sim-list .sim-item').count();
  for (let i = 0; i < nSims; i++) {
    await p.locator('.sim-list .sim-item').nth(i).click(); await wait(900);
    const title = (await p.locator('main h2, main h3').first().textContent()).trim();
    await scan(`Simulador: ${title}`);
    const adv = await p.locator('main .adv-toggle').count();
    if (n === '390x844') console.log('sim', i, title, '| ajustar:', adv, '| campos visíveis:', await p.locator('main input:visible, main select:visible').count());
    await p.locator('.sim-top .chat-back').click(); await wait(600);
  }
  await p.locator('.sim-top .chat-back').click(); await wait(600);
  // Diagnóstico + Evolução
  await p.click('nav >> text=Diagnóstico'); await wait(2500); await scan('Diagnóstico');
  const dtxt = await p.evaluate(() => document.querySelector('main').innerText);
  ok(dtxt.includes('Quanto você tem de verdade') && dtxt.includes('Renda já comprometida'), `${n} · rótulos novos do diagnóstico`);
  await p.locator('[role=tab]', { hasText: 'Evolução' }).click(); await wait(1200); await scan('Evolução');
  // 9) Plano: estratégia com nome simples
  await p.click('nav >> text=Plano'); await wait(900);
  const ptxt = await p.evaluate(() => document.querySelector('main').innerText);
  ok(/Economizar mais juros|Quitar primeiro as menores/.test(ptxt) && ptxt.includes('recomend'), `${n} · estratégia sem nome simples/recomendação`);
  const mt = p.locator('label.mode-toggle'); if (await mt.count()) { await mt.locator('input').check(); await wait(300); ok((await DD()).settings.recvMode === 'garantido', `${n} · "Contar só o dinheiro certo" não salvou`); await mt.locator('input').uncheck(); await wait(200); }
  else ok(false, `${n} · interruptor "só o dinheiro certo" ausente no plano`);
  // Alertas e consultor
  await p.click('.bell'); await wait(700); const at = await p.locator('.sheet').innerText(); const am = at.match(BAN); ok(!am, `${n} · jargão nos alertas: ${am?.[0]}`); await p.click('.sheet .chat-back'); await wait(500);
  await ctx.close(); console.log(n, 'ok');
}
await b.close();
console.log('checagens:', checks, '| falhas:', fails.length ? '\n  ' + fails.join('\n  ') : 'nenhuma'); console.log('erros:', errs.length ? errs.join('\n') : 'nenhum');
