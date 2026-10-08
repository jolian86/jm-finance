/** Simulador de decisões: cenários comparados lado a lado com os dados reais do usuário. Nunca decide pelo usuário. */
import { Data, Debt, Category, CATEGORIES, diagnose, actionPlan, evaluateGoals, simulate, brl, uid , fmtAm } from './finance';

export type SimId = 'financiar' | 'quitar-investir' | 'antecipar' | 'consolidar' | 'cortar';
/** advanced = fica em "Ajustar (opcional)" com um padrão sensato. */
export type Field = { key: string; label: string; type: 'number' | 'select' | 'multi'; step?: number; suffix?: string; options?: { value: string; label: string }[]; hint?: string; advanced?: boolean };
export type Row = { label: string; a: string; b: string; better?: 'a' | 'b' };
export type Series = { key: string; name: string; color: 'gold' | 'silver' | 'bronze' | 'champagne'; dash?: boolean };
export type SimResult = {
  cols: [string, string]; rows: Row[]; summary: string;
  options: { name: string; pros: string[]; cons: string[] }[]; risks: string[];
  chart: { kind: 'line' | 'bar'; title: string; xKey: string; xLabel?: string; data: Record<string, number | string>[]; series: Series[] };
  goal?: { name: string; type: 'compra' | 'outro' | 'reserva'; target: number; months: number };
};
export type Values = Record<string, string>;
export type Sim = { id: SimId; title: string; desc: string; icon: string; fields: (d: Data) => Field[]; defaults: (d: Data) => Values; run: (d: Data, v: Values) => SimResult | { error: string } };

const n = (v: string | undefined, def = 0) => { let t = String(v ?? '').trim(); if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); const x = Number(t); return Number.isFinite(x) ? x : def; };
const pmt = (pv: number, i: number, k: number) => i === 0 ? pv / k : pv * i / (1 - Math.pow(1 + i, -k));
const pctM = (x: number) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao mês`;
const WHEN = [['6', '6 meses'], ['12', '1 ano'], ['24', '2 anos'], ['36', '3 anos'], ['60', '5 anos']].map(([value, label]) => ({ value, label }));
const pct = (x: number) => `${(x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
const mo = (k: number | null) => k === null ? 'não quita' : `${k} ${k === 1 ? 'mês' : 'meses'}`;
const debtOpts = (d: Data) => d.debts.map(x => ({ value: x.id, label: `${x.name} (${fmtAm(x.rate)})` }));
const topDebt = (d: Data) => [...d.debts].sort((a, b) => b.rate - a.rate)[0];
const freeNow = (d: Data) => { const p = actionPlan(d); return Math.max(0, p.surplus); };

/* 1) Financiar x juntar e comprar à vista */
const financiar: Sim = {
  id: 'financiar', title: 'Financiar ou juntar e comprar à vista', icon: '🚗', desc: 'Compare parcelas e juros com guardar todo mês até ter o valor.',
  fields: () => [
    { key: 'price', label: 'Preço do bem', type: 'number', suffix: 'R$' }, { key: 'down', label: 'Entrada (já tenho)', type: 'number', suffix: 'R$' },
    { key: 'term', label: 'Em quantas parcelas?', type: 'number' },
    { key: 'save', label: 'Quanto consigo guardar por mês', type: 'number', suffix: 'R$', hint: 'Sugestão: a sobra do seu orçamento após os cortes do plano.' },
    { key: 'rate', label: 'Juros do financiamento', type: 'number', step: 0.1, suffix: '% ao mês', advanced: true, hint: 'Está na proposta da loja ou do banco. Padrão: 1,9% ao mês, perto da média de financiamento de veículos.' },
    { key: 'ret', label: 'Quanto o dinheiro guardado rende', type: 'number', step: 0.1, suffix: '% ao mês', advanced: true, hint: 'Padrão: 0,5% ao mês, perto do que rende uma aplicação segura (como a poupança).' },
  ],
  defaults: d => ({ price: '40000', down: '5000', rate: '1.9', term: '48', save: String(Math.round(Math.max(300, freeNow(d) + (d.debts.length ? 0 : 0)))), ret: '0.5' }),
  run: (d, v) => {
    const P = n(v.price), D = Math.min(n(v.down), P), i = n(v.rate) / 100, k = Math.max(1, Math.round(n(v.term))), S = n(v.save), r = n(v.ret) / 100;
    if (P <= 0) return { error: 'Informe o preço.' };
    const fin = pmt(P - D, i, k), finTotal = D + fin * k;
    let m = 0, bal = D; while (bal < P && m < 600) { bal = bal * (1 + r) + S; m++; }
    const reach = bal >= P ? m : null; const deposits = reach ? D + S * reach : 0;
    const r0 = diagnose(d);
    const withLoan = diagnose({ ...d, debts: [...d.debts, { id: 'sim', name: 'Financiamento (simulado)', type: 'financiamento', balance: P - D, rate: n(v.rate), minPayment: fin }] });
    const free = actionPlan(d).surplus;
    const commitA = r0.income ? (r0.outflow + fin) / r0.income : 0;
    const horizon = Math.max(k, reach ?? 0, 12);
    const data = Array.from({ length: horizon + 1 }, (_, t) => ({ mes: t, Financiar: Math.round(D + fin * Math.min(t, k)), 'Juntar e comprar': Math.round(reach === null ? D + S * t : D + S * Math.min(t, reach)) }));
    return {
      cols: ['Financiar', 'Juntar e comprar à vista'],
      rows: [
        { label: 'Tem o bem em', a: 'agora', b: reach === null ? 'não chega em 50 anos' : mo(reach), better: 'a' },
        { label: 'Parcela / depósito mensal', a: brl(fin), b: brl(S) },
        { label: 'Custo total', a: brl(finTotal), b: reach === null ? '—' : brl(Math.min(P, deposits)), better: 'b' },
        { label: 'Juros pagos (ou rendimento ganho)', a: brl(finTotal - P), b: reach === null ? '—' : `+${brl(Math.max(0, bal - deposits))} de rendimento`, better: 'b' },
        { label: 'Renda já comprometida (gastos + parcelas)', a: `${pct(r0.commitment)} → ${pct(commitA)}`, b: `${pct(r0.commitment)} (sem nova parcela)`, better: 'b' },
        { label: 'Nota de saúde financeira', a: `${r0.score} → ${withLoan.score}`, b: `${r0.score} (mantém)`, better: withLoan.score < r0.score ? 'b' : undefined },
      ],
      summary: `Financiando, você tem o bem agora e paga ${brl(fin)}/mês por ${k} meses: ${brl(finTotal - P)} a mais em juros (${pct(finTotal / P - 1)} sobre o preço). Juntando ${brl(S)}/mês, ${reach === null ? 'o valor não é alcançado — seria preciso guardar mais' : `você compra em ${mo(reach)} sem juros`}. ${fin > free ? `A parcela é maior que a sobra atual do seu orçamento (${brl(Math.max(0, free))}).` : 'A parcela cabe na sua sobra atual.'}`,
      options: [
        { name: 'Financiar', pros: ['Usa o bem imediatamente', 'Útil se o bem gera renda ou evita custo maior (ex.: trabalho)'], cons: [`Paga ${brl(finTotal - P)} de juros`, 'Compromete o orçamento por anos', r0.expensive.length ? 'Soma-se a dívidas caras já existentes' : 'Reduz a folga para imprevistos'] },
        { name: 'Juntar e comprar à vista', pros: ['Sem juros; o rendimento trabalha a seu favor', 'À vista dá poder de negociar desconto', 'Mantém a nota e a folga do orçamento'], cons: ['Demora mais para ter o bem', 'O preço pode subir no período'] },
      ],
      risks: ['Atrasar parcelas gera multa e juros, e o banco pode tomar o bem de volta (ele fica como garantia até a última parcela).', 'Peça o custo total do financiamento (aparece como “CET”): inclui tarifas e seguros além dos juros.', 'Mexer na reserva de emergência para a entrada deixa você desprotegido.'],
      chart: { kind: 'line', title: 'Quanto você terá desembolsado mês a mês', xKey: 'mes', xLabel: 'mês', data, series: [{ key: 'Financiar', name: 'Financiar', color: 'gold' }, { key: 'Juntar e comprar', name: 'Juntar e comprar', color: 'silver', dash: true }] },
      goal: reach ? { name: 'Compra à vista', type: 'compra', target: P, months: reach } : undefined,
    };
  },
};

/* 2) Quitar dívida x investir */
const quitarInvestir: Sim = {
  id: 'quitar-investir', title: 'Quitar dívida ou investir', icon: '⚖️', desc: 'Compare os juros que você deixa de pagar com o que um investimento renderia.',
  fields: d => [
    ...(d.debts.length ? [{ key: 'debt', label: 'Dívida', type: 'select' as const, options: debtOpts(d) }] : []),
    { key: 'amount', label: 'Quanto dinheiro você tem para isso', type: 'number', suffix: 'R$' },
    { key: 'months', label: 'Em quanto tempo quer comparar?', type: 'select', options: WHEN },
    { key: 'dr', label: 'Juros da dívida', type: 'number', step: 0.1, suffix: '% ao mês', advanced: true, hint: d.debts.length ? 'Já vem da dívida escolhida.' : 'Está no contrato ou na fatura.' },
    { key: 'ir', label: 'Quanto um investimento seguro renderia', type: 'number', step: 0.1, suffix: '% ao mês', advanced: true, hint: 'Padrão: 0,8% ao mês, já descontado o imposto — perto do que rende hoje uma aplicação segura de banco grande.' },
  ],
  defaults: d => { const t = topDebt(d); const r = diagnose(d); return { debt: t?.id ?? '', dr: String(t?.rate ?? 3), amount: String(Math.round(Math.min(t?.balance ?? 1000, Math.max(1000, r.liquidAssets + r.reserve)))), ir: '0.8', months: '12' }; },
  run: (d, v) => {
    const t = d.debts.find(x => x.id === v.debt); const dr = n(v.dr, t?.rate) / 100, ir = n(v.ir) / 100, A = Math.min(n(v.amount), t ? t.balance : Infinity), N = Math.max(1, Math.round(n(v.months)));
    if (A <= 0) return { error: 'Informe o valor.' };
    const saved = A * (Math.pow(1 + dr, N) - 1), earned = A * (Math.pow(1 + ir, N) - 1);
    const r = diagnose(d); const reserveLeft = r.liquidAssets + r.reserve - A;
    const data = Array.from({ length: N + 1 }, (_, k) => ({ mes: k, 'Quitar (juros evitados)': Math.round(A * (Math.pow(1 + dr, k) - 1)), 'Investir (rendimento)': Math.round(A * (Math.pow(1 + ir, k) - 1)) }));
    const better = saved > earned ? 'a' : 'b';
    return {
      cols: ['Quitar a dívida', 'Investir'],
      rows: [
        { label: 'Juros por mês', a: `${pctM(dr)} (você paga)`, b: `${pctM(ir)} (você ganha)` },
        { label: 'Juros por ano (aprox.)', a: pct(Math.pow(1 + dr, 12) - 1), b: pct(Math.pow(1 + ir, 12) - 1) },
        { label: `Resultado em ${mo(N)}`, a: `${brl(saved)} de juros evitados`, b: `${brl(earned)} de rendimento`, better },
        { label: 'Diferença', a: better === 'a' ? `+${brl(saved - earned)}` : '—', b: better === 'b' ? `+${brl(earned - saved)}` : '—', better },
      ],
      summary: `Com ${brl(A)}${t ? ` na ${t.name}` : ''}, quitar evita cerca de ${brl(saved)} de juros em ${mo(N)} (juros que esse saldo acumularia se continuasse em aberto); investir o mesmo valor renderia cerca de ${brl(earned)}. ${dr > ir ? 'Os números indicam que quitar rende mais — juros de dívida costumam superar qualquer aplicação segura.' : 'Aqui o investimento rende mais que o custo da dívida; ainda assim, considere o risco e a segurança de estar sem dívida.'}${reserveLeft < 0 ? ' Atenção: esse valor é maior do que você tem disponível rápido.' : ''}`,
      options: [
        { name: 'Quitar a dívida', pros: ['Retorno garantido igual aos juros da dívida', 'Libera a parcela no orçamento', 'Reduz o estresse e melhora a nota'], cons: ['O dinheiro sai da sua mão (fica menos dinheiro disponível para emergências)'] },
        { name: 'Investir', pros: ['Mantém o dinheiro disponível', 'Bom quando a dívida é barata (ex.: juros abaixo do rendimento)'], cons: ['O rendimento não é garantido em aplicações de risco', 'Impostos e taxas reduzem o ganho'] },
      ],
      risks: ['Não use toda a reserva de emergência para quitar: um imprevisto pode gerar dívida ainda mais cara.', 'Peça desconto para quitação à vista — muitos credores oferecem.', 'Rendimentos passados não garantem rendimentos futuros.'],
      chart: { kind: 'line', title: 'Ganho acumulado de cada opção', xKey: 'mes', xLabel: 'mês', data, series: [{ key: 'Quitar (juros evitados)', name: 'Quitar (juros evitados)', color: 'gold' }, { key: 'Investir (rendimento)', name: 'Investir (rendimento)', color: 'silver', dash: true }] },
    };
  },
};

/* 3) Antecipar parcelas */
const nper = (B: number, i: number, p: number) => i === 0 ? Math.ceil(B / p) : (p <= B * i ? Infinity : Math.ceil(-Math.log(1 - i * B / p) / Math.log(1 + i)));
const antecipar: Sim = {
  id: 'antecipar', title: 'Antecipar parcelas', icon: '⏩', desc: 'Veja o desconto de juros ao pagar parcelas antes (as últimas rendem mais desconto).',
  fields: d => [
    ...(d.debts.length ? [{ key: 'debt', label: 'Dívida parcelada', type: 'select' as const, options: debtOpts(d) }] : []),
    { key: 'balance', label: 'Quanto falta pagar', type: 'number', suffix: 'R$' },
    { key: 'inst', label: 'Valor da parcela', type: 'number', suffix: 'R$' }, { key: 'k', label: 'Quantas parcelas quer adiantar?', type: 'number', hint: 'Adiantando as últimas parcelas, o desconto de juros é maior — é seu direito (Código de Defesa do Consumidor, art. 52).' },
    { key: 'rate', label: 'Juros da dívida', type: 'number', step: 0.1, suffix: '% ao mês', advanced: true, hint: 'Já vem da dívida escolhida. Se não souber, deixe como está.' },
  ],
  defaults: d => { const t = [...d.debts].filter(x => x.type !== 'cartao_rotativo' && x.type !== 'cheque_especial').sort((a, b) => b.balance - a.balance)[0] ?? d.debts[0]; return { debt: t?.id ?? '', balance: String(t?.balance ?? 6000), rate: String(t?.rate ?? 3), inst: String(t?.minPayment ?? 400), k: '3' }; },
  run: (_d, v) => {
    const B = n(v.balance), i = n(v.rate) / 100, p = n(v.inst), k = Math.max(1, Math.round(n(v.k)));
    const N = nper(B, i, p);
    if (!Number.isFinite(N)) return { error: 'Com essa parcela, os juros consomem tudo e a dívida não diminui. Renegocie ou aumente a parcela.' };
    const kk = Math.min(k, N);
    const pv = Array.from({ length: kk }, (_, j) => p / Math.pow(1 + i, N - kk + 1 + j));
    const pay = pv.reduce((a, b) => a + b, 0), nominal = p * kk, save = nominal - pay;
    const data = pv.map((x, j) => ({ parcela: `${N - kk + 1 + j}ª`, 'Valor da parcela': Math.round(p), 'Pagando hoje': Math.round(x) }));
    return {
      cols: ['Manter como está', `Antecipar ${kk} parcela${kk > 1 ? 's' : ''}`],
      rows: [
        { label: 'Parcelas restantes', a: `${N}`, b: `${N - kk}`, better: 'b' },
        { label: 'Fim da dívida', a: mo(N), b: mo(N - kk), better: 'b' },
        { label: 'Você paga por essas parcelas', a: brl(nominal), b: brl(pay), better: 'b' },
        { label: 'Desconto de juros', a: '—', b: `${brl(save)} (${pct(save / nominal)})`, better: 'b' },
        { label: 'Dinheiro necessário hoje', a: brl(0), b: brl(pay), better: 'a' },
      ],
      summary: `Antecipando as ${kk} últimas parcelas de ${brl(p)}, você paga ${brl(pay)} hoje em vez de ${brl(nominal)} — economia de ${brl(save)} — e termina ${mo(kk)} antes (em ${mo(N - kk)}).`,
      options: [
        { name: 'Manter', pros: ['Dinheiro continua disponível', 'Sem esforço agora'], cons: [`Paga ${brl(save)} a mais em juros nessas parcelas`] },
        { name: 'Antecipar', pros: ['Desconto dos juros garantido por lei', 'A dívida termina antes'], cons: ['Usa dinheiro que poderia ser reserva', 'Não diminui a parcela de cada mês (diminui quantas faltam)'] },
      ],
      risks: ['Peça ao credor o valor exato com desconto antes de pagar (boleto de antecipação).', 'Se houver dívidas mais caras, antecipar nelas costuma render mais.', 'Mantenha uma mini-reserva para imprevistos.'],
      chart: { kind: 'bar', title: 'Cada parcela adiantada: valor normal x pagando hoje', xKey: 'parcela', data, series: [{ key: 'Valor da parcela', name: 'Valor da parcela', color: 'silver' }, { key: 'Pagando hoje', name: 'Pagando hoje', color: 'gold' }] },
    };
  },
};

/* 4) Consolidar dívidas / portabilidade */
const consolidar: Sim = {
  id: 'consolidar', title: 'Juntar dívidas em uma só, mais barata', icon: '🔗', desc: 'Troque dívidas caras por um empréstimo com juros menores e compare parcela e prazo.',
  fields: d => [
    { key: 'ids', label: 'Quais dívidas juntar?', type: 'multi', options: debtOpts(d) },
    { key: 'term', label: 'Em quantas parcelas?', type: 'number' },
    { key: 'rate', label: 'Juros do novo empréstimo', type: 'number', step: 0.1, suffix: '% ao mês', advanced: true, hint: 'Padrão: 2,2% ao mês, comum em consignado (descontado do salário) ou crédito com garantia. Se tiver uma proposta, use a taxa dela.' },
  ],
  defaults: d => { const exp = diagnose(d).expensive; return { ids: (exp.length ? exp : d.debts).map(x => x.id).join(','), rate: '2.2', term: '24' }; },
  run: (d, v) => {
    const sel = d.debts.filter(x => (v.ids || '').split(',').includes(x.id));
    if (!sel.length) return { error: 'Selecione ao menos uma dívida.' };
    const B = sel.reduce((a, x) => a + x.balance, 0), mins = sel.reduce((a, x) => a + x.minPayment, 0);
    const i = n(v.rate) / 100, k = Math.max(1, Math.round(n(v.term))), p = pmt(B, i, k), newInt = p * k - B;
    const cur = simulate(sel, 'avalanche', mins);
    const data: Record<string, number>[] = []; let nb = B;
    const H = Math.max(k, cur.feasible ? cur.months : 60);
    for (let t = 0; t <= Math.min(H, 120); t++) { data.push({ mes: t, Atual: Math.round(cur.timeline[t]?.saldo ?? (cur.feasible ? 0 : cur.timeline[cur.timeline.length - 1].saldo)), Consolidada: Math.round(Math.max(0, nb)) }); nb = nb * (1 + i) - p; }
    return {
      cols: ['Como está hoje', 'Juntando em uma só'],
      rows: [
        { label: 'Dívidas', a: sel.map(x => `${x.name} (${fmtAm(x.rate)})`).join(', '), b: `1 empréstimo a ${n(v.rate).toLocaleString('pt-BR')}% ao mês` },
        { label: 'Pagamento mensal', a: brl(mins), b: brl(p), better: p < mins ? 'b' : 'a' },
        { label: 'Prazo para quitar', a: cur.feasible ? mo(cur.months) : 'não quita pagando só as parcelas atuais', b: mo(k), better: !cur.feasible || k < cur.months ? 'b' : 'a' },
        { label: 'Juros totais', a: cur.feasible ? brl(cur.interest) : 'crescem sem parar', b: brl(newInt), better: !cur.feasible || newInt < cur.interest ? 'b' : 'a' },
      ],
      summary: `Juntando ${brl(B)} em um empréstimo a ${n(v.rate).toLocaleString('pt-BR')}% ao mês por ${k} meses, a parcela fica em ${brl(p)}${p < mins ? ` (${brl(mins - p)} a menos por mês)` : ` (${brl(p - mins)} a mais por mês)`} e os juros totais em ${brl(newInt)}. ${cur.feasible ? `Pagando só as parcelas atuais, levaria ${mo(cur.months)} e ${brl(cur.interest)} de juros.` : 'Pagando só as parcelas atuais, essas dívidas não terminam — os juros superam os pagamentos.'}`,
      options: [
        { name: 'Manter como está', pros: ['Sem novo contrato'], cons: ['Juros altos continuam correndo', 'Várias datas de vencimento para controlar'] },
        { name: 'Juntar em uma só', pros: ['Uma parcela só, previsível', 'Juros menores', 'Data certa para sair da dívida'], cons: ['Muitas parcelas podem aumentar o total pago', 'Pode exigir um bem como garantia ou desconto direto no salário'] },
      ],
      risks: ['O maior risco é voltar a usar o cartão/cheque especial depois de juntar as dívidas — aí a dívida dobra.', 'Compare o custo total (aparece como “CET” e inclui impostos, tarifas e seguros), não só os juros.', 'Desconfie de ofertas que pedem pagamento antecipado para liberar crédito.'],
      chart: { kind: 'line', title: 'Quanto falta pagar ao longo do tempo', xKey: 'mes', xLabel: 'mês', data, series: [{ key: 'Atual', name: 'Como está hoje', color: 'silver', dash: true }, { key: 'Consolidada', name: 'Juntando em uma só', color: 'gold' }] },
    };
  },
};

/* 5) Cortar um gasto */
const cortar: Sim = {
  id: 'cortar', title: 'Cortar um gasto', icon: '✂️', desc: 'Veja o efeito de reduzir uma categoria nas dívidas, objetivos e na nota.',
  fields: d => {
    const cats = [...new Set(d.expenses.map(e => e.category))];
    return [{ key: 'cat', label: 'Categoria', type: 'select', options: cats.map(c => ({ value: c, label: CATEGORIES[c].label })) }, { key: 'cut', label: 'Cortar por mês', type: 'number', suffix: 'R$' }];
  },
  defaults: d => {
    const by: Partial<Record<Category, number>> = {}; d.expenses.forEach(e => by[e.category] = (by[e.category] || 0) + e.amount);
    const want = (Object.keys(by) as Category[]).filter(c => CATEGORIES[c].group === 'desejo').sort((a, b) => (by[b] || 0) - (by[a] || 0))[0] ?? (Object.keys(by)[0] as Category);
    return { cat: want ?? 'outros', cut: String(Math.round((by[want] || 0) * 0.3)) };
  },
  run: (d, v) => {
    const c = v.cat as Category; const items = d.expenses.filter(e => e.category === c); const tot = items.reduce((a, e) => a + e.amount, 0);
    if (!tot) return { error: 'Categoria sem gastos cadastrados.' };
    const cut = Math.min(tot, Math.max(0, n(v.cut)));
    const d2: Data = { ...d, expenses: d.expenses.map(e => e.category === c ? { ...e, amount: e.amount * (1 - cut / tot) } : e) };
    const [p1, p2] = [actionPlan(d), actionPlan(d2)], [g1, g2] = [evaluateGoals(d), evaluateGoals(d2)], [r1, r2] = [diagnose(d), diagnose(d2)];
    const m1 = p1.payoff?.av.feasible ? p1.payoff.av.months : null, m2 = p2.payoff?.av.feasible ? p2.payoff.av.months : null;
    const fit1 = g1.results.filter(x => x.fits).length, fit2 = g2.results.filter(x => x.fits).length;
    const L = Math.max(p1.payoff?.av.timeline.length ?? 0, p2.payoff?.av.timeline.length ?? 0, 2);
    const data = Array.from({ length: Math.min(L, 121) }, (_, t) => ({ mes: t, 'Sem corte': Math.round(p1.payoff?.av.timeline[t]?.saldo ?? 0), 'Com corte': Math.round(p2.payoff?.av.timeline[t]?.saldo ?? 0) }));
    return {
      cols: ['Sem corte', `Cortando ${brl(cut)}/mês`],
      rows: [
        { label: `Gasto em ${CATEGORIES[c].label}`, a: brl(tot), b: brl(tot - cut), better: 'b' },
        { label: 'Saldo do mês', a: brl(r1.balance), b: brl(r2.balance), better: 'b' },
        ...(d.debts.length ? [{ label: 'Dívidas quitadas em', a: mo(m1), b: mo(m2), better: 'b' as const }, { label: 'Juros até quitar', a: p1.payoff ? brl(p1.payoff.av.interest) : '—', b: p2.payoff ? brl(p2.payoff.av.interest) : '—', better: 'b' as const }] : []),
        { label: 'Livre para objetivos/mês', a: brl(g1.free), b: brl(g2.free), better: 'b' },
        ...(d.goals.length ? [{ label: 'Objetivos que cabem', a: `${fit1} de ${d.goals.length}`, b: `${fit2} de ${d.goals.length}`, better: fit2 > fit1 ? 'b' as const : undefined }] : []),
        { label: 'Nota', a: String(r1.score), b: String(r2.score), better: r2.score > r1.score ? 'b' : undefined },
      ],
      summary: `Cortando ${brl(cut)}/mês em ${CATEGORIES[c].label}${d.debts.length && m1 !== null && m2 !== null ? `, suas dívidas terminam em ${mo(m2)} em vez de ${mo(m1)}${p1.payoff && p2.payoff ? ` e você economiza ${brl(p1.payoff.av.interest - p2.payoff.av.interest)} de juros` : ''}` : ''}. ${fit2 > fit1 ? `Mais ${fit2 - fit1} objetivo(s) passam a caber no orçamento.` : `O dinheiro livre para objetivos vai de ${brl(g1.free)} para ${brl(g2.free)}/mês.`}`,
      options: [
        { name: 'Manter o gasto', pros: ['Mantém o padrão de vida atual'], cons: ['Plano de dívidas e objetivos mais lentos'] },
        { name: 'Cortar', pros: ['Resultado imediato e garantido', 'Acelera a saída das dívidas'], cons: ['Exige mudança de hábito', 'Cortes radicais demais costumam não durar'] },
      ],
      risks: ['Prefira cortes que você consegue manter por meses (ex.: trocar delivery por marmita 3x/semana).', 'Direcione o valor cortado logo no dia do salário, senão ele "some" em outros gastos.'],
      chart: { kind: 'line', title: 'Quanto falta pagar das dívidas: sem corte x com corte', xKey: 'mes', xLabel: 'mês', data, series: [{ key: 'Sem corte', name: 'Sem corte', color: 'silver', dash: true }, { key: 'Com corte', name: 'Com corte', color: 'gold' }] },
    };
  },
};

export const SIMS: Sim[] = [financiar, quitarInvestir, antecipar, consolidar, cortar];
export const simById = (id: SimId) => SIMS.find(s => s.id === id)!;
/** Ajustes ao trocar a dívida selecionada (preenche taxa/saldo da dívida escolhida). */
export function onDebtChange(id: SimId, d: Data, v: Values): Values {
  const t: Debt | undefined = d.debts.find(x => x.id === v.debt); if (!t) return v;
  if (id === 'quitar-investir') return { ...v, dr: String(t.rate), amount: String(Math.round(Math.min(t.balance, n(v.amount) || t.balance))) };
  if (id === 'antecipar') return { ...v, balance: String(t.balance), rate: String(t.rate), inst: String(t.minPayment) };
  return v;
}
export const newGoalId = uid;
