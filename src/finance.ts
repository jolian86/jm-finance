export type Income = { id: string; name: string; amount: number };
export type Expense = { id: string; name: string; amount: number; category: Category; kind: 'fixa' | 'variavel' };
export type DebtType = 'cartao_rotativo' | 'cheque_especial' | 'emprestimo_pessoal' | 'consignado' | 'financiamento' | 'outro';
export type Debt = { id: string; name: string; type: DebtType; balance: number; rate: number; minPayment: number };
export type Data = { incomes: Income[]; expenses: Expense[]; debts: Debt[]; reserve: number; isExample?: boolean };
export type Category = 'moradia' | 'alimentacao' | 'transporte' | 'saude' | 'educacao' | 'lazer' | 'assinaturas' | 'compras' | 'outros';

export const CATEGORIES: Record<Category, { label: string; group: 'necessidade' | 'desejo' }> = {
  moradia: { label: 'Moradia', group: 'necessidade' },
  alimentacao: { label: 'Alimentação', group: 'necessidade' },
  transporte: { label: 'Transporte', group: 'necessidade' },
  saude: { label: 'Saúde', group: 'necessidade' },
  educacao: { label: 'Educação', group: 'necessidade' },
  lazer: { label: 'Lazer', group: 'desejo' },
  assinaturas: { label: 'Assinaturas', group: 'desejo' },
  compras: { label: 'Compras', group: 'desejo' },
  outros: { label: 'Outros', group: 'desejo' },
};
export const DEBT_TYPES: Record<DebtType, string> = {
  cartao_rotativo: 'Cartão (rotativo)', cheque_especial: 'Cheque especial', emprestimo_pessoal: 'Empréstimo pessoal',
  consignado: 'Consignado', financiamento: 'Financiamento', outro: 'Outro',
};

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
export const uid = () => Math.random().toString(36).slice(2, 10);

export const emptyData = (): Data => ({ incomes: [], expenses: [], debts: [], reserve: 0 });
export const exampleData = (): Data => ({
  isExample: true,
  reserve: 800,
  incomes: [{ id: uid(), name: 'Salário', amount: 4200 }, { id: uid(), name: 'Freela', amount: 1500 }],
  expenses: [
    { id: uid(), name: 'Aluguel', amount: 1500, category: 'moradia', kind: 'fixa' },
    { id: uid(), name: 'Luz/água/internet', amount: 350, category: 'moradia', kind: 'fixa' },
    { id: uid(), name: 'Mercado', amount: 900, category: 'alimentacao', kind: 'variavel' },
    { id: uid(), name: 'Delivery', amount: 450, category: 'alimentacao', kind: 'variavel' },
    { id: uid(), name: 'Combustível/app', amount: 400, category: 'transporte', kind: 'variavel' },
    { id: uid(), name: 'Streaming e apps', amount: 120, category: 'assinaturas', kind: 'fixa' },
    { id: uid(), name: 'Saídas', amount: 600, category: 'lazer', kind: 'variavel' },
    { id: uid(), name: 'Roupas/compras online', amount: 500, category: 'compras', kind: 'variavel' },
  ],
  debts: [
    { id: uid(), name: 'Cartão Banco X', type: 'cartao_rotativo', balance: 3500, rate: 14, minPayment: 350 },
    { id: uid(), name: 'Cheque especial', type: 'cheque_especial', balance: 1200, rate: 8, minPayment: 150 },
    { id: uid(), name: 'Empréstimo pessoal', type: 'emprestimo_pessoal', balance: 6000, rate: 4.5, minPayment: 420 },
  ],
});

const sum = (a: { amount: number }[]) => a.reduce((s, x) => s + (Number(x.amount) || 0), 0);

export type Level = 'crítico' | 'atenção' | 'estável' | 'saudável';
export type Finding = { tone: 'bad' | 'warn' | 'good'; title: string; text: string };

export function diagnose(d: Data) {
  const income = sum(d.incomes);
  const expenses = sum(d.expenses);
  const minPayments = d.debts.reduce((s, x) => s + x.minPayment, 0);
  const totalDebt = d.debts.reduce((s, x) => s + x.balance, 0);
  const outflow = expenses + minPayments;
  const balance = income - outflow;
  const commitment = income ? outflow / income : 0;
  const dti = income ? minPayments / income : 0;
  const essentials = d.expenses.filter(e => CATEGORIES[e.category].group === 'necessidade').reduce((s, e) => s + e.amount, 0);
  const wants = expenses - essentials;
  const reserveMonths = essentials + minPayments > 0 ? d.reserve / (essentials + minPayments) : 0;
  const expensive = d.debts.filter(x => x.type === 'cartao_rotativo' || x.type === 'cheque_especial' || x.rate >= 5);
  const monthlyInterest = d.debts.reduce((s, x) => s + x.balance * x.rate / 100, 0);

  // Score 0-100
  let score = 100;
  if (balance < 0) score -= 35; else if (balance < income * 0.05) score -= 15;
  score -= Math.min(25, Math.max(0, (dti - 0.1) * 100));
  score -= Math.min(20, expensive.length * 10);
  if (reserveMonths < 1) score -= 15; else if (reserveMonths < 3) score -= 8; else if (reserveMonths < 6) score -= 3;
  if (income && totalDebt / income > 6) score -= 10;
  score = Math.max(0, Math.round(score));
  const level: Level = score < 40 ? 'crítico' : score < 60 ? 'atenção' : score < 80 ? 'estável' : 'saudável';
  const levelText: Record<Level, string> = {
    'crítico': 'Sua situação exige ação imediata. O dinheiro que entra não está dando conta do que sai e/ou os juros estão consumindo sua renda. A boa notícia: com um plano claro dá para virar o jogo.',
    'atenção': 'Você está no limite. Qualquer imprevisto pode virar dívida. É hora de organizar e criar folga no orçamento.',
    'estável': 'As contas fecham, mas ainda há pontos a melhorar para ganhar segurança e começar a construir patrimônio.',
    'saudável': 'Parabéns! Suas finanças estão equilibradas. O foco agora é proteger e fazer o dinheiro crescer.',
  };

  const f: Finding[] = [];
  if (!income) f.push({ tone: 'warn', title: 'Sem renda cadastrada', text: 'Cadastre sua renda para gerar o diagnóstico.' });
  else {
    f.push(balance < 0
      ? { tone: 'bad', title: `Faltam ${brl(-balance)} por mês`, text: `Você gasta ${pct(commitment)} do que ganha. Isso significa que todo mês a dívida cresce para cobrir a diferença.` }
      : { tone: balance < income * 0.1 ? 'warn' : 'good', title: `Sobram ${brl(balance)} por mês`, text: `Você compromete ${pct(commitment)} da renda. O ideal é sobrar pelo menos 10–20% para dívidas e reserva.` });
    f.push(dti > 0.3
      ? { tone: 'bad', title: `Dívidas consomem ${pct(dti)} da renda`, text: 'Acima de 30% é considerado superendividamento. Renegociar é prioridade.' }
      : dti > 0.15 ? { tone: 'warn', title: `Parcelas de dívida: ${pct(dti)} da renda`, text: 'Está aceitável, mas acima de 15% já pesa. Evite novas dívidas.' }
      : { tone: 'good', title: `Parcelas de dívida: ${pct(dti)} da renda`, text: 'Nível de endividamento sob controle.' });
  }
  if (monthlyInterest > 0) f.push({ tone: monthlyInterest > income * 0.05 ? 'bad' : 'warn', title: `Você paga cerca de ${brl(monthlyInterest)} de juros por mês`, text: 'Esse dinheiro não abate nada da dívida — é o "custo" de dever. Quanto antes quitar as dívidas caras, mais sobra.' });
  expensive.forEach(x => f.push({ tone: 'bad', title: `Dívida cara: ${x.name} (${x.rate}% a.m.)`, text: `${x.rate}% ao mês equivale a ~${pct(Math.pow(1 + x.rate / 100, 12) - 1)} ao ano. ${x.type === 'cartao_rotativo' ? 'O rotativo do cartão é a dívida mais cara do Brasil.' : x.type === 'cheque_especial' ? 'Cheque especial nunca deve ser usado como renda extra.' : ''} Troque por uma dívida mais barata ou quite primeiro.` }));
  f.push(reserveMonths < 1
    ? { tone: 'bad', title: `Reserva cobre ${reserveMonths.toFixed(1)} mês`, text: 'Sem reserva, qualquer imprevisto vira dívida cara. Meta inicial: 1 mês de custos essenciais.' }
    : reserveMonths < 6 ? { tone: 'warn', title: `Reserva cobre ${reserveMonths.toFixed(1)} meses`, text: 'Bom começo. A meta é de 3 a 6 meses de custos essenciais.' }
    : { tone: 'good', title: `Reserva cobre ${reserveMonths.toFixed(1)} meses`, text: 'Reserva de emergência completa.' });

  return { reserve: d.reserve, income, expenses, minPayments, totalDebt, outflow, balance, commitment, dti, essentials, wants, reserveMonths, expensive, monthlyInterest, score, level, levelText: levelText[level], findings: f };
}

export type Strategy = 'avalanche' | 'snowball';
export function order(debts: Debt[], s: Strategy) {
  return [...debts].sort((a, b) => s === 'avalanche' ? b.rate - a.rate : a.balance - b.balance);
}

export function simulate(debts: Debt[], s: Strategy, budget: number) {
  let ds = order(debts, s).map(x => ({ ...x }));
  const payoff: Record<string, number> = {};
  const timeline: { mes: number; saldo: number }[] = [{ mes: 0, saldo: ds.reduce((a, x) => a + x.balance, 0) }];
  let interest = 0, m = 0;
  const minSum = ds.reduce((a, x) => a + x.minPayment, 0);
  if (budget < minSum) budget = minSum;
  while (ds.some(x => x.balance > 0.01) && m < 120) {
    m++;
    ds.forEach(x => { if (x.balance > 0) { const i = x.balance * x.rate / 100; interest += i; x.balance += i; } });
    let avail = budget;
    ds.forEach(x => { if (x.balance > 0) { const p = Math.min(x.minPayment, x.balance); x.balance -= p; avail -= p; } });
    for (const x of ds) { if (avail <= 0) break; if (x.balance > 0) { const p = Math.min(avail, x.balance); x.balance -= p; avail -= p; } }
    ds.forEach(x => { if (x.balance <= 0.01 && !payoff[x.id]) payoff[x.id] = m; });
    timeline.push({ mes: m, saldo: Math.max(0, ds.reduce((a, x) => a + Math.max(0, x.balance), 0)) });
  }
  return { months: m, interest, payoff, timeline, feasible: !ds.some(x => x.balance > 0.01) };
}

export type Step = { title: string; text: string; items?: string[] };
export function actionPlan(d: Data) {
  const r = diagnose(d);
  const steps: Step[] = [];
  const income = r.income;
  // 50/30/20 adapted: in crisis, 50 needs / 20 wants / 30 debts+reserve
  const crisis = r.level === 'crítico' || r.level === 'atenção' || r.expensive.length > 0;
  const guide = crisis ? { n: 0.5, w: 0.2, s: 0.3, label: '50/20/30 (modo recuperação)' } : { n: 0.5, w: 0.3, s: 0.2, label: '50/30/20' };
  const targetWants = income * guide.w;
  const targetNeeds = income * guide.n;

  const cuts: { name: string; current: number; suggested: number }[] = [];
  if (r.wants > targetWants) {
    const factor = targetWants / r.wants;
    const byCat: Record<string, number> = {};
    d.expenses.filter(e => CATEGORIES[e.category].group === 'desejo').forEach(e => byCat[e.category] = (byCat[e.category] || 0) + e.amount);
    Object.entries(byCat).forEach(([c, v]) => cuts.push({ name: CATEGORIES[c as Category].label, current: v, suggested: Math.round(v * factor) }));
  }
  const varNeeds = d.expenses.filter(e => e.kind === 'variavel' && CATEGORIES[e.category].group === 'necessidade');
  if (r.essentials > targetNeeds) varNeeds.forEach(e => cuts.push({ name: `${e.name} (${CATEGORIES[e.category].label})`, current: e.amount, suggested: Math.round(e.amount * 0.85) }));
  const savings = cuts.reduce((s, c) => s + c.current - c.suggested, 0);

  if (r.balance < 0 || r.expensive.length) steps.push({
    title: 'Estanque o sangramento', text: 'Antes de tudo, pare de criar dívida nova.',
    items: [
      r.expensive.some(x => x.type === 'cartao_rotativo') ? 'Pare de usar o cartão de crédito até quitar o rotativo. Use débito/Pix.' : 'Use débito/Pix em vez de crédito por enquanto.',
      r.expensive.some(x => x.type === 'cheque_especial') ? 'Peça ao banco para reduzir ou cancelar o limite do cheque especial.' : 'Não use limites de cheque especial.',
      'Anote todo gasto por 30 dias — o que não é medido não é controlado.',
      r.balance < 0 ? `Meta: eliminar o déficit de ${brl(-r.balance)}/mês com os cortes abaixo e/ou renda extra.` : 'Mantenha as contas no azul todo mês.',
    ]});
  if (cuts.length) steps.push({
    title: `Ajuste o orçamento (regra ${guide.label})`,
    text: `Referência: até ${pct(guide.n)} da renda (${brl(targetNeeds)}) para necessidades, ${pct(guide.w)} (${brl(targetWants)}) para desejos e ${pct(guide.s)} (${brl(income * guide.s)}) para dívidas e reserva. Cortes sugeridos liberam ~${brl(savings)}/mês:`,
    items: cuts.map(c => `${c.name}: de ${brl(c.current)} para ${brl(c.suggested)}`),
  });
  if (r.expensive.length) steps.push({
    title: 'Renegocie as dívidas mais caras', text: 'Troque dívida cara por dívida barata. Ligue para o banco ou use o Desenrola/Serasa Limpa Nome/Registrato.',
    items: [
      ...order(r.expensive, 'avalanche').map(x => `${x.name}: ${x.rate}% a.m. — peça parcelamento com juros menores ou desconto à vista.`),
      'Considere um empréstimo consignado ou com garantia (juros de 1,5–3% a.m.) para quitar rotativo/cheque especial — só se parar de usá-los.',
      'Nunca aceite uma parcela que não caiba no orçamento ajustado.',
    ]});
  const surplus = Math.max(0, r.balance + savings);
  const reserveTarget1 = r.essentials + r.minPayments;
  if (r.reserve < reserveTarget1 * 0.5 && d.debts.length) steps.push({
    title: 'Monte uma mini-reserva', text: `Separe ${brl(Math.min(1000, reserveTarget1 * 0.5))} para imprevistos antes de acelerar as dívidas — assim um pneu furado não vira novo rotativo. Guarde em conta que renda 100% do CDI com liquidez diária.` });
  let payoff = null as null | { budget: number; av: ReturnType<typeof simulate>; sb: ReturnType<typeof simulate> };
  if (d.debts.length) {
    const budget = r.minPayments + surplus * 0.8;
    const av = simulate(d.debts, 'avalanche', budget), sb = simulate(d.debts, 'snowball', budget);
    payoff = { budget, av, sb };
    steps.push({
      title: 'Quite as dívidas em ordem', text: `Pague o mínimo em todas e direcione ${brl(budget - r.minPayments)} extras/mês para uma dívida por vez (orçamento total para dívidas: ${brl(budget)}/mês).`,
      items: [
        `Avalanche (maior juro primeiro): ${av.feasible ? `${av.months} meses, ${brl(av.interest)} em juros` : 'não quita com o orçamento atual'}. Ordem: ${order(d.debts, 'avalanche').map(x => x.name).join(' → ')}.`,
        `Bola de neve (menor saldo primeiro): ${sb.feasible ? `${sb.months} meses, ${brl(sb.interest)} em juros` : 'não quita com o orçamento atual'}. Ordem: ${order(d.debts, 'snowball').map(x => x.name).join(' → ')}.`,
        av.interest < sb.interest - 1 ? `Recomendado: Avalanche — economiza ${brl(sb.interest - av.interest)}. Se precisar de motivação rápida, a bola de neve elimina dívidas mais cedo.` : 'As duas estratégias dão resultado parecido; escolha a bola de neve pela motivação de ver dívidas sumindo.',
        ...(!av.feasible ? ['⚠️ Com o orçamento atual a dívida NÃO diminui em 10 anos (os juros superam os pagamentos). Renegociar (etapa anterior) e aumentar a renda são obrigatórios.'] : []),
      ]});
  }
  if (r.reserveMonths < 6) steps.push({
    title: 'Construa a reserva de emergência', text: `Meta: 6 meses de custos essenciais = ${brl(reserveTarget1 * 6)}. Hoje: ${brl(r.reserve)}. ${surplus > 0 ? `Após quitar as dívidas, guardando ${brl(surplus + r.minPayments)}/mês você chega lá em ~${Math.ceil(Math.max(0, reserveTarget1 * 6 - r.reserve) / (surplus + r.minPayments))} meses.` : 'Primeiro crie folga no orçamento.'}` });
  steps.push({ title: 'Próximo nível', text: 'Com dívidas quitadas e reserva pronta: invista para objetivos (Tesouro Direto, CDBs), revise o orçamento a cada 3 meses e busque aumentar a renda.' });
  return { steps, cuts, savings, guide, payoff, surplus };
}
