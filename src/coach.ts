// v15: "caminho até 80" + análise gasto a gasto. Tudo calculado no aparelho, a partir dos dados do usuário.
import { Data, Expense, Debt, Category, diagnose, uid, expanded, SplitKey } from './finance';

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const r10 = (n: number) => Math.round(n / 10) * 10;

/** Referências mensais típicas (casa de 2–3 pessoas) — usadas só para apontar onde dá para olhar com carinho. */
type Kind = { id: string; label: string; rx: RegExp; typ: (inc: number) => number; tips: string[] };
export const KINDS: Kind[] = [
  { id: 'luz', label: 'luz', rx: /\bluz\b|energia|eletric|\benel\b|cemig|copel|cpfl|coelba|celesc|equatorial/, typ: i => Math.max(150, Math.min(260, i * 0.035)),
    tips: ['troque as lâmpadas que ainda não são LED (gastam até 80% menos)', 'banho mais curto e chuveiro na posição “verão” fora do inverno — o chuveiro elétrico costuma ser o maior vilão', 'tire da tomada o que fica em espera (TV, micro-ondas, carregadores)', 'confira a bandeira e a tarifa na conta — em bandeira vermelha, segure secadora, ferro e forno elétrico'] },
  { id: 'agua', label: 'água', rx: /\bagua\b|sabesp|saneamento|cedae|copasa|embasa|sanepar/, typ: () => 110,
    tips: ['banhos de até 5 minutos', 'junte roupa para lavar com a máquina cheia', 'confira se não tem vazamento (relógio girando com tudo fechado)'] },
  { id: 'internet', label: 'internet', rx: /internet|wi-?fi|banda larga|fibra|\bnet\b|vivo fibra|claro net/, typ: () => 110,
    tips: ['ligue para a operadora e peça um plano mais barato ou o desconto de cliente antigo — funciona muito', 'veja se a velocidade contratada não é maior do que você usa'] },
  { id: 'celular', label: 'celular', rx: /celular|telefone|\bplano (de )?celular|tim\b|\bvivo\b|\bclaro\b|\boi\b/, typ: () => 80,
    tips: ['compare com planos controle ou pré-pagos de R$ 30–50', 'junte as linhas da família num plano só'] },
  { id: 'streaming', label: 'streaming e apps', rx: /stream|netflix|spotify|prime|disney|hbo|\bmax\b|globoplay|deezer|youtube|apps?\b|assinatura/, typ: () => 60,
    tips: ['fique com 1 ou 2 serviços e reveze: assine um mês, cancele, assine outro', 'procure assinaturas esquecidas na fatura do cartão', 'planos com anúncio ou família saem mais baratos'] },
  { id: 'delivery', label: 'delivery', rx: /delivery|ifood|rappi|lanche|pedido|comida pronta|aiqfome/, typ: i => Math.max(150, i * 0.03),
    tips: ['combine um limite por semana (ex.: 1 pedido) e cozinhe em maior quantidade para congelar', 'desligue as notificações de promoção do app', 'quando pedir, retire no local — sem taxa de entrega'] },
  { id: 'mercado', label: 'mercado', rx: /mercado|supermerc|feira|alimenta|compras do mes|atacad/, typ: i => Math.max(600, i * 0.18),
    tips: ['faça lista e vá com o cardápio da semana pronto', 'atacarejo para itens de limpeza e não perecíveis', 'marcas próprias do mercado costumam ser bem mais baratas'] },
  { id: 'transporte', label: 'combustível / transporte', rx: /combust|gasolina|etanol|posto|uber|99|\bapp\b|transporte|onibus|metro|estacion/, typ: i => Math.max(250, i * 0.09),
    tips: ['junte saídas no mesmo trajeto', 'compare carro de aplicativo com transporte público ou carona em trajetos fixos', 'calibre os pneus e use app de preço de combustível'] },
  { id: 'moradia', label: 'aluguel / moradia', rx: /aluguel|condominio|prestacao da casa|moradia/, typ: i => i * 0.3,
    tips: ['vale conversar com o dono sobre o reajuste — muita gente consegue segurar o aumento', 'no médio prazo, um lugar um pouco menor ou dividir a moradia é o que mais libera dinheiro'] },
  { id: 'lazer', label: 'saídas e lazer', rx: /saida|lazer|bar\b|restaurante|balada|passeio|role/, typ: i => Math.max(200, i * 0.06),
    tips: ['defina um valor por mês para saídas e guarde o resto', 'troque algumas saídas por programas em casa ou gratuitos'] },
  { id: 'compras', label: 'compras e roupas', rx: /roupa|compras|shopping|online|shein|shopee|mercado livre|amazon/, typ: i => Math.max(150, i * 0.04),
    tips: ['espere 48 horas antes de comprar algo que não é necessário', 'tire o cartão salvo dos apps de compra'] },
  { id: 'academia', label: 'academia', rx: /academia|smartfit|crossfit|pilates/, typ: () => 120,
    tips: ['veja planos mais simples ou treinos ao ar livre'] },
];
const OUTROS_RX = /\boutros?\b|diversos|gerais|variados|extras?\b|avulsos?|sem categoria|coisas/;
export const RECAT: [RegExp, Category, string][] = [
  [/farmac|remedio|medic|consulta|dentist|plano de saude|academia/, 'saude', 'Saúde'], [/escola|curso|faculdade|livro|material/, 'educacao', 'Educação'],
  [/pet|racao|veterin|presente|roupa|cabelo|beleza|salao|manicure|cosmetic/, 'compras', 'Compras'], [/bar|cerveja|saida|cinema|show|jogo|aposta|bet\b/, 'lazer', 'Lazer'],
  [/uber|gasolina|onibus|estacion|pedagio|carro|moto/, 'transporte', 'Transporte'], [/mercado|padaria|lanche|ifood|comida|acougue/, 'alimentacao', 'Alimentação'],
  [/netflix|spotify|assinatura|app/, 'assinaturas', 'Assinaturas'], [/gas\b|botijao|condominio|conserto|reforma|faxina|diarista/, 'moradia', 'Moradia'],
];
export const guessCategory = (t: string) => { const n = norm(t); return RECAT.find(([rx]) => rx.test(n)); };

export type ExpenseNote = { id: string; name: string; amount: number; typical: number; save: number; label: string; tips: string[] };
export type OthersNote = { id: string; name: string; amount: number; sharePct: number; kind: 'outros' | 'cartao'; split: boolean; parcelas: number };

/** Gasto a gasto: compara com referências e aponta onde dá para economizar. */
export function reviewExpenses(d: Data, income = diagnose(d).income) {
  const total = d.expenses.reduce((s, e) => s + e.amount, 0) || 1;
  const notes: ExpenseNote[] = []; const others: OthersNote[] = [];
  for (const e of expanded(d.expenses)) {
    const n = norm(e.name);
    if (e.category === 'protecao' || e.splitKey === 'parcelas') continue;
    const card = e.category === 'cartao' || (!e.parent && /fatura|cartao de credito/.test(n));
    if ((card || e.category === 'outros' || OUTROS_RX.test(n)) && e.amount / total >= 0.08) {
      const pid = e.parent ?? e.id; const par = d.expenses.find(x => x.id === pid);
      others.push({ id: pid, name: par?.name ?? e.name, amount: e.amount, sharePct: Math.round(e.amount / total * 100), kind: card ? 'cartao' : 'outros', split: !!e.parent, parcelas: Number(par?.split?.parcelas) || 0 }); continue; }
    const ks = KINDS.filter(k => k.rx.test(n));
    if (!ks.length) continue;
    const typical = r10(ks.reduce((s, k) => s + k.typ(income), 0));
    if (e.amount > typical * 1.15 && e.amount - typical >= 30)
      notes.push({ id: e.id, name: e.name, amount: e.amount, typical, save: r10(e.amount - typical), label: ks.map(k => k.label).join(', '), tips: ks.flatMap(k => k.tips.slice(0, ks.length > 1 ? 1 : 3)) });
  }
  notes.sort((a, b) => b.save - a.save);
  return { notes, others, total };
}

/** O que puxa a nota para baixo (mesmas regras do diagnóstico). */
export function drivers(d: Data) {
  const r = diagnose(d); const l: { pts: number; text: string }[] = [];
  if (r.balance < 0) l.push({ pts: 35, text: `o mês não fecha: faltam ${brl(-r.balance)}` });
  else if (r.balance < r.income * 0.05) l.push({ pts: 15, text: 'sobra quase nada no fim do mês' });
  const dp = Math.round(Math.min(25, Math.max(0, (r.dti - 0.1) * 100))); if (dp) l.push({ pts: dp, text: `parcelas levam ${Math.round(r.dti * 100)}% da renda` });
  if (r.expensive.length) l.push({ pts: Math.min(20, r.expensive.length * 10), text: `${r.expensive.length === 1 ? 'uma dívida cara' : `${r.expensive.length} dívidas caras`} (${r.expensive.map(x => x.name).join(', ')})` });
  if (r.reserveMonths < 1) l.push({ pts: 15, text: 'reserva para imprevistos menor que 1 mês' }); else if (r.reserveMonths < 3) l.push({ pts: 8, text: 'reserva para imprevistos menor que 3 meses' }); else if (r.reserveMonths < 6) l.push({ pts: 3, text: 'reserva ainda abaixo de 6 meses' });
  if (r.income && r.totalDebt / r.income > 6) l.push({ pts: 10, text: 'dívida total maior que 6 meses de renda' });
  if (r.netWorth < 0) l.push({ pts: 5, text: 'você deve mais do que tem' });
  return l.sort((a, b) => b.pts - a.pts);
}
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export type PathStep = { kind: 'cortar' | 'renda' | 'divida_cara' | 'quitar' | 'reserva'; text: string; from: number; to: number; expenseId?: string };
type Cand = { key: string; kind: PathStep['kind']; text: (d: Data) => string; apply: (d: Data) => Data; expenseId?: string };

/** muda o valor de um gasto — ou de uma parte da fatura do cartão (id "fatura:chave"), ajustando a fatura junto */
function setAmt(x: Data, id: string, v: number): Data {
  const [pid, key] = id.split(':');
  return { ...x, expenses: x.expenses.map(e => { if (e.id !== pid) return e; if (!key) return { ...e, amount: v };
    const old = key === 'resto' ? 0 : Number(e.split?.[key as SplitKey]) || 0; if (key === 'resto') return e;
    return { ...e, amount: Math.max(0, e.amount - (old - v)), split: { ...e.split, [key]: v } }; }) };
}
/** Caminho até a meta (padrão 80 = saudável): escolhe, passo a passo, a ação que mais sobe a nota. */
export function pathTo(d0: Data, target = 80, max = 7) {
  const start = diagnose(d0).score; const steps: PathStep[] = [];
  let d: Data = { ...d0, expenses: [...d0.expenses], debts: [...d0.debts], incomes: [...d0.incomes] };
  const used = new Set<string>();
  const { notes } = reviewExpenses(d0);
  const cands = (): Cand[] => {
    const r = diagnose(d); const c: Cand[] = [];
    for (const n of notes) c.push({ key: 'cut:' + n.id, kind: 'cortar', expenseId: n.id, text: () => `Baixar ${n.name} de ${brl(n.amount)} para ~${brl(n.typical)}`,
      apply: x => setAmt(x, n.id, n.typical) });
    if (notes.length > 1) { const tot = notes.reduce((a, n) => a + n.save, 0);
      c.push({ key: 'cutall', kind: 'cortar', text: () => `Ajustar ${notes.length === 2 ? 'dois gastos' : `${notes.length} gastos`}: ${notes.map(n => `${n.name} (${brl(n.amount)} → ~${brl(n.typical)})`).join(', ')} — sobram ~${brl(tot)} por mês`,
        apply: x => notes.reduce((y, n) => setAmt(y, n.id, n.typical), x) }); }
    // desejos sem referência: 20% a menos
    for (const e of expanded(d0.expenses)) if (e.splitKey !== 'parcelas' && e.category !== 'cartao' && !notes.some(n => n.id === e.id) && e.amount >= 150 && ['lazer', 'compras', 'assinaturas', 'outros'].includes(e.category))
      c.push({ key: 'cut:' + e.id, kind: 'cortar', expenseId: e.id, text: () => `Gastar uns 20% a menos em ${e.name} (${brl(e.amount)} → ~${brl(r10(e.amount * 0.8))})`,
        apply: x => setAmt(x, e.id, r10(e.amount * 0.8)) });
    for (const x of r.expensive) c.push({ key: 'cara:' + x.id, kind: 'divida_cara', text: () => `Trocar a dívida “${x.name}” (${x.rate.toLocaleString('pt-BR')}% ao mês) por um empréstimo mais barato — renegociação ou consignado`,
      apply: y => ({ ...y, debts: y.debts.map(z => z.id === x.id ? { ...z, type: 'emprestimo_pessoal', rate: 2.5, minPayment: Math.min(z.minPayment || Infinity, Math.round(z.balance * 0.025 / (1 - Math.pow(1.025, -24)))) } as Debt : z) }) });
    const small = [...d.debts].filter(x => x.balance > 0).sort((a, b) => a.balance - b.balance)[0];
    if (small && small.balance <= r.income * 0.6) c.push({ key: 'quitar:' + small.id, kind: 'quitar', text: () => `Terminar de pagar “${small.name}” (faltam ${brl(small.balance)}) — libera ${brl(small.minPayment)} por mês`,
      apply: y => ({ ...y, debts: y.debts.filter(z => z.id !== small.id) }) });
    const base = r.essentials + r.minPayments;
    for (const m of [1, 3, 6]) if (r.reserveMonths < m && base > 0) { const need = Math.ceil((base * m - r.effReserve) / 100) * 100;
      c.push({ key: 'res:' + m, kind: 'reserva', text: () => `Juntar mais ${brl(need)} na reserva para imprevistos (chega a ${m} ${m === 1 ? 'mês' : 'meses'} de gastos)`, apply: y => ({ ...y, reserve: y.reserve + need }) }); break; }
    if (r.income > 0) { const extra = Math.max(200, Math.ceil(r.income * 0.1 / 100) * 100);
      c.push({ key: 'renda', kind: 'renda', text: () => `Conseguir uma renda extra de ~${brl(extra)} por mês (bico, freela, vender o que não usa)`, apply: y => ({ ...y, incomes: [...y.incomes, { id: uid(), name: 'Renda extra', amount: extra }] }) }); }
    return c.filter(x => !used.has(x.key) && !(x.key.startsWith('cut:') && used.has('cutall')) && !(x.key === 'cutall' && [...used].some(u => u.startsWith('cut:'))));
  };
  let cur = start;
  // ordem de conversa: 1) gastos (depende só de você) 2) dívida cara 3) renda extra se o mês ainda não fecha 4) terminar dívida pequena 5) reserva 6) renda extra
  const phases: PathStep['kind'][] = ['cortar', 'divida_cara', 'renda', 'quitar', 'reserva', 'renda'];
  for (const [pi, ph] of phases.entries()) {
    while (cur < target && steps.length < max) {
      if (ph === 'renda' && pi === 2 && diagnose(d).balance >= 0) break;
      let best: { c: Cand; nd: Data; s: number } | null = null;
      for (const c of cands().filter(x => x.kind === ph)) { const nd = c.apply(d); const sc = diagnose(nd).score; if (!best || sc > best.s || (sc === best.s && diagnose(nd).balance > diagnose(best.nd).balance)) best = { c, nd, s: sc }; }
      if (!best) break;
      const helps = best.s > cur || (ph === 'cortar' && !steps.length && diagnose(best.nd).balance > diagnose(d).balance);
      if (!helps) break;
      steps.push({ kind: best.c.kind, text: best.c.text(d), from: cur, to: best.s, expenseId: best.c.expenseId });
      used.add(best.c.key); d = best.nd; cur = best.s;
      if (ph === 'renda') break;
    }
  }
  return { start, end: cur, target, steps, reached: cur >= target };
}
export const levelOf = (s: number) => s < 40 ? 'crítico' : s < 60 ? 'atenção' : s < 80 ? 'estável' : 'saudável';
export type _E = Expense;
