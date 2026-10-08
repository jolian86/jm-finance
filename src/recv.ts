// Receitas futuras / recebíveis: modelo, presets, ocorrências, previsão, precisão e uso sugerido dos valores.
// Só importa TIPOS de finance.ts (evita import circular: finance.ts usa as funções daqui).
import type { Data, Debt, Goal, Priority } from './finance';

export type Certainty = 'garantido' | 'provavel' | 'incerto';
export type RecvStatus = 'previsto' | 'recebido' | 'atrasado' | 'cancelado';
export type Recurrence = 'once' | 'monthly' | 'yearly' | 'custom';
export type RecvType = '13o' | 'ferias' | 'plr' | 'restituicao' | 'rescisao' | 'fgts' | 'pis'
  | 'honorarios' | 'exito' | 'convenio' | 'plantao' | 'nota' | 'comissao' | 'corretagem' | 'safra' | 'evento'
  | 'aluguel' | 'investimento' | 'dividendos' | 'venda' | 'devedor' | 'heranca' | 'processo' | 'outro';
/** date: 'YYYY-MM' (só mês) ou 'YYYY-MM-DD' (data exata). net opcional: se vazio, usa bruto − desconto estimado. */
export type RecvInstallment = { id: string; label?: string; date: string; gross: number; net?: number };
export type RecvRecord = { status: 'recebido' | 'cancelado'; amount?: number; date?: string };
export type Receivable = {
  id: string; name: string; type: RecvType; certainty: Certainty; prob: number; discountPct: number;
  recurrence: Recurrence; installments: RecvInstallment[]; until?: string; createdAt: string;
  /** situação de cada ocorrência: chave `${idDaParcela}@${YYYY-MM}` */
  records: Record<string, RecvRecord>;
};
export type RecvMode = 'ponderado' | 'garantido';

/** label = escolha na tela; word = adjetivo nas frases; prob = quanto o plano conta (por trás, nunca exigido do usuário). */
export const CERT: Record<Certainty, { label: string; word: string; prob: number; color: string; plan: string }> = {
  garantido: { label: 'Com certeza', word: 'certo', prob: 100, color: '#f7b731', plan: 'o plano conta com o valor inteiro' },
  provavel: { label: 'Provavelmente', word: 'provável', prob: 70, color: '#c3c7cc', plan: 'o plano conta com 70% do valor' },
  incerto: { label: 'Talvez', word: 'incerto', prob: 30, color: '#5c6672', plan: 'o plano conta só com 30% do valor' },
};
export const certFromProb = (p: number): Certainty => p >= 95 ? 'garantido' : p >= 50 ? 'provavel' : 'incerto';
export const REC_LABEL: Record<Recurrence, string> = { once: 'Só uma vez', monthly: 'Todo mês', yearly: 'Todo ano', custom: 'Em parcelas' };
export const STATUS_LABEL: Record<RecvStatus, string> = { previsto: 'Previsto', recebido: 'Recebido', atrasado: 'Atrasado', cancelado: 'Cancelado' };

type T = { label: string; group: string; cert: Certainty; discount: number; hint: string; art?: string };
export const RECV_TYPES: Record<RecvType, T> = {
  '13o': { label: '13º salário', group: 'Trabalho (CLT)', cert: 'garantido', discount: 0, hint: 'A 1ª parcela vem sem descontos; INSS e IR saem da 2ª.', art: 'o' },
  ferias: { label: 'Férias + 1/3', group: 'Trabalho (CLT)', cert: 'garantido', discount: 15, hint: 'Descontos de INSS e IR.', art: 'as' },
  plr: { label: 'PLR / PPR', group: 'Trabalho (CLT)', cert: 'provavel', discount: 0, hint: 'A PLR tem tabela de IR própria (exclusiva na fonte). Depende das metas da empresa.', art: 'a' },
  restituicao: { label: 'Restituição de IR', group: 'Trabalho (CLT)', cert: 'provavel', discount: 0, hint: 'A data depende do lote da Receita.', art: 'a' },
  rescisao: { label: 'Rescisão', group: 'Trabalho (CLT)', cert: 'garantido', discount: 10, hint: 'INSS e IR conforme as verbas.', art: 'a' },
  fgts: { label: 'FGTS (saque)', group: 'Trabalho (CLT)', cert: 'garantido', discount: 0, hint: 'Saque-aniversário, rescisão ou outra modalidade.', art: 'o' },
  pis: { label: 'PIS/Pasep (abono)', group: 'Trabalho (CLT)', cert: 'garantido', discount: 0, hint: 'Depende do calendário oficial.', art: 'o' },
  honorarios: { label: 'Honorários', group: 'Profissionais liberais', cert: 'provavel', discount: 15, hint: 'IR/ISS e repasses ao escritório.', art: 'os' },
  exito: { label: 'Êxito / sucumbência', group: 'Profissionais liberais', cert: 'incerto', discount: 15, hint: 'Depende do resultado e do prazo do processo — datas costumam atrasar.' },
  convenio: { label: 'Repasse de convênio', group: 'Profissionais liberais', cert: 'provavel', discount: 10, hint: 'Risco de glosa e taxas do convênio.', art: 'o' },
  plantao: { label: 'Plantões', group: 'Profissionais liberais', cert: 'provavel', discount: 15, hint: 'IR/INSS ou impostos da PJ.', art: 'os' },
  nota: { label: 'Nota fiscal / contrato', group: 'Autônomos, MEI e PJ', cert: 'provavel', discount: 6, hint: 'Impostos (Simples/ISS) e taxas de antecipação.', art: 'a' },
  comissao: { label: 'Comissão', group: 'Autônomos, MEI e PJ', cert: 'provavel', discount: 10, hint: 'IR/INSS; pode haver estorno se a venda cair.', art: 'a' },
  corretagem: { label: 'Corretagem', group: 'Autônomos, MEI e PJ', cert: 'incerto', discount: 10, hint: 'Só entra se o negócio fechar.', art: 'a' },
  safra: { label: 'Safra', group: 'Autônomos, MEI e PJ', cert: 'provavel', discount: 20, hint: 'Custos, Funrural, frete e preço de mercado.', art: 'a' },
  evento: { label: 'Cachê / evento', group: 'Autônomos, MEI e PJ', cert: 'provavel', discount: 10, hint: 'Impostos e taxas da produção.', art: 'o' },
  aluguel: { label: 'Aluguel recebido', group: 'Outros', cert: 'garantido', discount: 10, hint: 'IR (carnê-leão) e taxa da imobiliária.', art: 'o' },
  investimento: { label: 'Vencimento de investimento', group: 'Outros', cert: 'garantido', discount: 15, hint: 'IR regressivo sobre o rendimento.', art: 'o' },
  dividendos: { label: 'Dividendos / JCP', group: 'Outros', cert: 'provavel', discount: 0, hint: 'JCP tem IR na fonte.', art: 'os' },
  venda: { label: 'Venda de bem', group: 'Outros', cert: 'incerto', discount: 5, hint: 'Comissão e IR sobre ganho de capital.', art: 'a' },
  devedor: { label: 'Dinheiro que me devem', group: 'Outros', cert: 'incerto', discount: 0, hint: 'Combine data e forma de pagamento por escrito.', art: 'o' },
  heranca: { label: 'Herança', group: 'Outros', cert: 'incerto', discount: 5, hint: 'ITCMD e custos do inventário; prazos longos.', art: 'a' },
  processo: { label: 'Processo judicial', group: 'Outros', cert: 'incerto', discount: 20, hint: 'Honorários do advogado e IR; prazos imprevisíveis.', art: 'o' },
  outro: { label: 'Outro', group: 'Outros', cert: 'provavel', discount: 0, hint: '' },
};

// ---------- datas ----------
const pad = (n: number) => String(n).padStart(2, '0');
export const ymOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const isoDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const ymAdd = (ym: string, k: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return ymOf(d); };
const ymDiff = (a: string, b: string) => { const [ya, ma] = a.split('-').map(Number), [yb, mb] = b.split('-').map(Number); return (yb - ya) * 12 + (mb - ma); };
export const parseDate = (s: string) => { const [y, m, d] = s.split('-').map(Number); return { y, m, day: d || undefined }; };
const lastDay = (y: number, m: number) => new Date(y, m, 0).getDate();
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const fmtOccDate = (ym: string, day?: number) => { const { y, m } = parseDate(ym); return day ? `${pad(day)}/${pad(m)}/${y}` : `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`; };
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (n: number) => brl(Math.round(n));

// ---------- ocorrências ----------
export type Occ = {
  key: string; recv: Receivable; inst: RecvInstallment; ym: string; day?: number; due: Date;
  gross: number; net: number; prob: number; certainty: Certainty; status: RecvStatus; record?: RecvRecord; daysToDue: number;
};
export const netOf = (r: Receivable, i: RecvInstallment) => i.net !== undefined && i.net !== null && Number.isFinite(i.net) ? i.net : Math.round(i.gross * (1 - (r.discountPct || 0) / 100) * 100) / 100;

export function occurrences(r: Receivable, today = new Date(), horizon = 12): Occ[] {
  const now = ymOf(today), end = ymAdd(now, horizon - 1), created = (r.createdAt || isoDay(today)).slice(0, 7);
  const t0 = startOfDay(today).getTime();
  const out: Occ[] = [];
  const push = (inst: RecvInstallment, ym: string, day?: number) => {
    const { y, m } = parseDate(ym); const due = new Date(y, m - 1, day ? Math.min(day, lastDay(y, m)) : lastDay(y, m));
    const key = `${inst.id}@${ym}`; const record = r.records?.[key];
    const status: RecvStatus = record?.status ?? (due.getTime() < t0 ? 'atrasado' : 'previsto');
    out.push({ key, recv: r, inst, ym, day, due, gross: inst.gross, net: netOf(r, inst), prob: r.prob, certainty: r.certainty, status, record, daysToDue: Math.round((due.getTime() - t0) / 864e5) });
  };
  for (const inst of r.installments) {
    if (!inst.date) continue;
    const { y, m, day } = parseDate(inst.date); const base = `${y}-${pad(m)}`;
    if (r.recurrence === 'once' || r.recurrence === 'custom') { push(inst, base, day); continue; }
    const step = r.recurrence === 'monthly' ? 1 : 12;
    const stop = r.recurrence === 'monthly' && r.until && r.until < end ? r.until : end;
    for (let ym = base; ym <= stop; ym = ymAdd(ym, step)) if (ym >= created) push(inst, ym, day);
  }
  return out.sort((a, b) => a.due.getTime() - b.due.getTime());
}
export const allOccurrences = (d: Data, today = new Date(), horizon = 12) => (d.receivables || []).flatMap(r => occurrences(r, today, horizon)).sort((a, b) => a.due.getTime() - b.due.getTime());
/** valor considerado no plano: ponderado pela chance, ou só o garantido */
export const modeValue = (o: Occ, mode: RecvMode) => mode === 'garantido' ? (o.certainty === 'garantido' ? o.net : 0) : o.net * o.prob / 100;
export const isOpen = (o: Occ) => o.status === 'previsto' || o.status === 'atrasado';

// ---------- previsão (12 meses) ----------
export function forecast(d: Data, today = new Date(), months = 12) {
  const start = ymOf(today);
  const buckets = Array.from({ length: months }, (_, i) => { const ym = ymAdd(start, i); const { y, m } = parseDate(ym); return { ym, label: `${MONTHS_SHORT[m - 1]}/${String(y).slice(2)}`, garantido: 0, provavel: 0, incerto: 0, ponderado: 0 }; });
  let expected = 0, weighted = 0, guaranteed = 0, overdue = 0, overdueValue = 0;
  for (const o of allOccurrences(d, today, months)) {
    if (!isOpen(o)) continue;
    const i = Math.max(0, ymDiff(start, o.ym)); if (i >= months) continue;
    if (o.status === 'atrasado') { overdue++; overdueValue += o.net; }
    const b = buckets[i]; b[o.certainty] += o.net; b.ponderado += o.net * o.prob / 100;
    expected += o.net; weighted += o.net * o.prob / 100; if (o.certainty === 'garantido') guaranteed += o.net;
  }
  buckets.forEach(b => { b.garantido = Math.round(b.garantido); b.provavel = Math.round(b.provavel); b.incerto = Math.round(b.incerto); b.ponderado = Math.round(b.ponderado); });
  return { buckets, expected, weighted, guaranteed, overdue, overdueValue };
}

// ---------- precisão: previsto x recebido ----------
export type TypePrecision = { type: RecvType; label: string; n: number; cancelled: number; valueRatio: number; avgDelay: number; currentProb: number; suggestedProb?: number; text: string };
export function precision(d: Data, today = new Date()) {
  const by: Record<string, { n: number; cancelled: number; exp: number; got: number; delay: number; delays: number; probs: number[] }> = {};
  for (const r of d.receivables || []) {
    const e = by[r.type] ??= { n: 0, cancelled: 0, exp: 0, got: 0, delay: 0, delays: 0, probs: [] };
    e.probs.push(r.prob);
    for (const o of occurrences(r, today, 1)) {
      if (!o.record) continue;
      e.n++; e.exp += o.net;
      if (o.record.status === 'cancelado') { e.cancelled++; continue; }
      e.got += o.record.amount ?? o.net;
      if (o.record.date) { const dd = Math.round((startOfDay(new Date(o.record.date + 'T12:00:00')).getTime() - startOfDay(o.due).getTime()) / 864e5); e.delay += Math.max(0, dd); e.delays++; }
    }
  }
  const list: TypePrecision[] = Object.entries(by).filter(([, e]) => e.n > 0).map(([type, e]) => {
    const label = RECV_TYPES[type as RecvType]?.label ?? type;
    const valueRatio = e.exp ? e.got / e.exp : 0, avgDelay = e.delays ? Math.round(e.delay / e.delays) : 0;
    const currentProb = Math.round(e.probs.reduce((s, x) => s + x, 0) / e.probs.length);
    const sug = Math.max(5, Math.min(100, Math.round(valueRatio * 20) * 5));
    const when = avgDelay <= 3 ? 'chegaram no prazo' : `chegaram em média ${avgDelay} dias depois`;
    const text = `Seus recebimentos de ${label} ${when} e renderam ${Math.round(valueRatio * 100)}% do valor previsto${e.cancelled ? ` (${e.cancelled} cancelado${e.cancelled > 1 ? 's' : ''})` : ''}.`;
    return { type: type as RecvType, label, n: e.n, cancelled: e.cancelled, valueRatio, avgDelay, currentProb, suggestedProb: Math.abs(sug - currentProb) >= 10 ? sug : undefined, text };
  });
  const n = list.reduce((s, x) => s + x.n, 0);
  const valueRatio = n ? list.reduce((s, x) => s + x.valueRatio * x.n, 0) / n : 0;
  const avgDelay = n ? Math.round(list.reduce((s, x) => s + x.avgDelay * x.n, 0) / n) : 0;
  const level = !n ? null : valueRatio >= 0.95 && avgDelay <= 7 ? 'alta' : valueRatio >= 0.8 && avgDelay <= 30 ? 'média' : 'baixa';
  // 0–100: valor recebido (até 100%) menos penalidade por atraso
  const score = n ? Math.max(0, Math.round(Math.min(1, valueRatio) * 100 - Math.min(40, avgDelay / 2))) : null;
  return { list, n, valueRatio, avgDelay, level, score };
}

// ---------- uso sugerido de cada valor ----------
export type LumpPart = { kind: 'debt'; id: string; name: string; amount: number; payoff: boolean; expensive: boolean } | { kind: 'reserve'; amount: number } | { kind: 'goal'; id: string; name: string; amount: number } | { kind: 'free'; amount: number };
export type Lump = { occ: Occ; value: number; month: number; parts: LumpPart[] };
const PR: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };
/** Distribui cada recebimento: dívida cara → reserva de emergência (até 1 mês de custos) → objetivos → demais dívidas → reserva (até 6 meses) → livre. */
export function planLumps(d: Data, ctx: { expensiveIds: Set<string>; reserveGap1: number; reserveGap6: number }, valueOf: (o: Occ) => number, today = new Date(), horizon = 12): Lump[] {
  const start = ymOf(today);
  const debts = [...d.debts].sort((a, b) => b.rate - a.rate).map(x => ({ ...x, left: x.balance }));
  let gap1 = Math.max(0, ctx.reserveGap1), gap6 = Math.max(0, ctx.reserveGap6 - Math.max(0, ctx.reserveGap1));
  const goals = [...d.goals].filter(g => g.type !== 'aposentadoria' && g.target > 0).sort((a, b) => PR[a.priority] - PR[b.priority]).map(g => ({ g, left: Math.max(0, g.target - g.saved) }));
  const out: Lump[] = [];
  for (const o of allOccurrences(d, today, horizon)) {
    if (!isOpen(o)) continue;
    const month = Math.max(0, ymDiff(start, o.ym)); if (month >= horizon) continue;
    let v = valueOf(o); const value = v; if (v <= 0.5) continue;
    const parts: LumpPart[] = [];
    const payDebt = (x: typeof debts[number]) => { if (v <= 0 || x.left <= 0) return; const a = Math.min(v, x.left); x.left -= a; v -= a; parts.push({ kind: 'debt', id: x.id, name: x.name, amount: a, payoff: x.left <= 0.5, expensive: ctx.expensiveIds.has(x.id) }); };
    debts.filter(x => ctx.expensiveIds.has(x.id)).forEach(payDebt);
    if (v > 0 && gap1 > 0) { const a = Math.min(v, gap1); gap1 -= a; v -= a; parts.push({ kind: 'reserve', amount: a }); }
    for (const G of goals) { if (v <= 0) break; if (G.left <= 0 || (G.g.date && G.g.date < o.ym)) continue; const a = Math.min(v, G.left); G.left -= a; v -= a; parts.push({ kind: 'goal', id: G.g.id, name: G.g.name, amount: a }); }
    debts.filter(x => !ctx.expensiveIds.has(x.id)).forEach(payDebt);
    if (v > 0 && gap6 > 0) { const a = Math.min(v, gap6); gap6 -= a; v -= a; const prev = parts.find(p => p.kind === 'reserve'); if (prev) prev.amount += a; else parts.push({ kind: 'reserve', amount: a }); }
    if (v > 0.5) parts.push({ kind: 'free', amount: v });
    out.push({ occ: o, value, month, parts });
  }
  return out;
}

const joinPt = (a: string[]) => a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} e ${a[a.length - 1]}`;
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function occTitle(o: Occ) {
  const T = RECV_TYPES[o.recv.type]; const first = norm(T.label.split(/[ /]/)[0]);
  const art = T.art && norm(o.recv.name).startsWith(first) ? `${T.art} ` : '';
  return `${art}${art ? o.recv.name : `“${o.recv.name}”`}${o.inst.label ? ` (${o.inst.label})` : ''}`;
}
export function monthText(o: Occ, today = new Date()) {
  const { y, m } = parseDate(o.ym); return `${MONTHS_FULL[m - 1]}${y !== today.getFullYear() ? `/${String(y).slice(2)}` : ''}`;
}
/** Frase simples: "Use a PLR (1ª parcela) de outubro (R$ 3.000 provável) para quitar o Cartão Banco X." */
export function lumpSentence(l: Lump, today = new Date()) {
  const o = l.occ;
  const paid = l.parts.filter(p => p.kind === 'debt' && p.payoff).map(p => `o ${(p as { name: string }).name}`);
  const acts = [...(paid.length ? [`quitar ${joinPt(paid)}`] : []), ...l.parts.filter(p => !(p.kind === 'debt' && p.payoff)).map(p => p.kind === 'debt' ? `abater ${brl0(p.amount)} do ${p.name}`
    : p.kind === 'reserve' ? `reforçar a reserva de emergência (${brl0(p.amount)})`
      : p.kind === 'goal' ? `guardar ${brl0(p.amount)} para o objetivo “${p.name}”` : `deixar ${brl0(p.amount)} livres (decida com calma)`)];
  const cert = o.status === 'atrasado' ? 'atrasado' : CERT[o.certainty].word;
  const tail = o.certainty === 'incerto' || o.status === 'atrasado' ? ' — só quando o dinheiro cair na conta' : '';
  return `Use ${occTitle(o)} de ${monthText(o, today)} (${brl0(o.net)} ${cert}) para ${joinPt(acts)}${tail}.`;
}

// ---------- presets ----------
const today0 = () => new Date();
const nextYm = (month: number, from = today0()) => { const y = from.getMonth() + 1 > month ? from.getFullYear() + 1 : from.getFullYear(); return `${y}-${pad(month)}`; };
const id = () => Math.random().toString(36).slice(2, 10);
/** Salário líquido de referência: renda chamada "Salário" (ou a maior renda fixa). */
export function salaryBase(d: Data) {
  const fixed = d.incomes.filter(i => !i.variable);
  const s = fixed.find(i => /sal[aá]rio/i.test(i.name)) ?? [...fixed].sort((a, b) => b.amount - a.amount)[0];
  return s?.amount ?? 0;
}
type Draft = Omit<Receivable, 'id' | 'createdAt' | 'records'> & { note?: string };
export type Preset = { key: string; label: string; build: (d: Data) => Draft };
const base = (type: RecvType, name: string, recurrence: Recurrence, installments: RecvInstallment[], extra: Partial<Draft> = {}): Draft => {
  const T = RECV_TYPES[type]; return { name, type, certainty: T.cert, prob: CERT[T.cert].prob, discountPct: T.discount, recurrence, installments, ...extra };
};
export const PRESETS: Preset[] = [
  { key: '13o', label: '13º salário', build: d => {
    const S = salaryBase(d), G = Math.round(S / 0.85); const nov = nextYm(11), dec = `${nov.slice(0, 4)}-12`;
    return base('13o', '13º salário', 'yearly', [{ id: id(), label: '1ª parcela', date: `${nov}-30`, gross: Math.round(G / 2), net: Math.round(G / 2) }, { id: id(), label: '2ª parcela', date: `${dec}-20`, gross: G - Math.round(G / 2), net: Math.max(0, Math.round(S - G / 2)) }],
      { note: S ? `Estimativa a partir do seu salário líquido (${brl0(S)}): bruto ≈ ${brl0(G)}. A 1ª parcela vem sem descontos; INSS e IR saem da 2ª. Ajuste com o seu holerite.` : 'Cadastre seu salário em "Rendas mensais" para sugerirmos os valores.' });
  } },
  { key: 'ferias', label: 'Férias + 1/3', build: d => { const S = salaryBase(d); const t = new Date(); t.setMonth(t.getMonth() + 3);
    return base('ferias', 'Férias + 1/3', 'yearly', [{ id: id(), date: ymOf(t), gross: Math.round(S / 0.85 * 4 / 3), net: Math.round(S * 4 / 3) }], { note: 'Salário + 1/3, pago até 2 dias antes das férias. Escolha o mês das suas férias.' }); } },
  { key: 'plr', label: 'PLR', build: d => { const S = salaryBase(d); const out = nextYm(10); const fev = nextYm(2, new Date(Number(out.slice(0, 4)), 9, 1));
    return base('plr', 'PLR', 'yearly', [{ id: id(), label: '1ª parcela', date: out, gross: Math.round(S * 0.6) }, { id: id(), label: '2ª parcela', date: fev, gross: Math.round(S * 0.6) }],
      { note: 'Duas parcelas por ano (outubro e fevereiro) — ajuste meses e valores conforme o acordo da sua empresa.' }); } },
  { key: 'restituicao', label: 'Restituição IR', build: () => base('restituicao', 'Restituição do IR', 'once', [{ id: id(), date: nextYm(7), gross: 0 }], { note: 'Veja o valor no recibo da declaração. A data depende do lote.' }) },
  { key: 'honorarios', label: 'Honorários', build: () => { const t = new Date(); t.setMonth(t.getMonth() + 1); return base('honorarios', 'Honorários — cliente', 'custom', [{ id: id(), label: 'iniciais', date: ymOf(t), gross: 0 }], { note: 'Para êxito/sucumbência, use o tipo "Êxito / sucumbência" (incerto).' }); } },
  { key: 'convenio', label: 'Repasse de convênio', build: () => { const t = new Date(); t.setMonth(t.getMonth() + 1); return base('convenio', 'Repasse de convênio', 'monthly', [{ id: id(), date: ymOf(t), gross: 0 }], { note: 'Use o desconto para estimar glosas e taxas.' }); } },
  { key: 'comissao', label: 'Comissão', build: () => { const t = new Date(); t.setMonth(t.getMonth() + 1); return base('comissao', 'Comissão', 'monthly', [{ id: id(), date: ymOf(t), gross: 0 }]); } },
  { key: 'nota', label: 'Nota fiscal a receber', build: () => { const t = new Date(); t.setDate(t.getDate() + 30); return base('nota', 'Nota fiscal — cliente', 'once', [{ id: id(), date: isoDay(t), gross: 0 }]); } },
  { key: 'safra', label: 'Safra', build: () => { const t = new Date(); t.setMonth(t.getMonth() + 6); return base('safra', 'Safra', 'once', [{ id: id(), date: ymOf(t), gross: 0 }]); } },
];
export const newReceivable = (dr: Draft): Receivable => ({ ...dr, id: id(), createdAt: isoDay(new Date()), records: {} });

/** Limpeza defensiva (dados salvos/backup). */
export function cleanReceivables(v: unknown): Receivable[] {
  if (!Array.isArray(v)) return [];
  return v.filter(x => x && typeof x === 'object').map((x: Partial<Receivable>) => {
    const type = (x.type && x.type in RECV_TYPES ? x.type : 'outro') as RecvType;
    const certainty = (x.certainty && x.certainty in CERT ? x.certainty : RECV_TYPES[type].cert) as Certainty;
    const prob = Number.isFinite(Number(x.prob)) ? Math.max(0, Math.min(100, Number(x.prob))) : CERT[certainty].prob;
    const installments = (Array.isArray(x.installments) ? x.installments : []).filter(i => i && typeof i === 'object' && typeof i.date === 'string' && /^\d{4}-\d{2}(-\d{2})?$/.test(i.date))
      .map(i => ({ id: String(i.id ?? id()), label: i.label ? String(i.label) : undefined, date: i.date, gross: Number(i.gross) || 0, net: i.net === undefined || i.net === null || !Number.isFinite(Number(i.net)) ? undefined : Number(i.net) }));
    const records: Record<string, RecvRecord> = {};
    if (x.records && typeof x.records === 'object') for (const [k, r] of Object.entries(x.records)) if (r && (r.status === 'recebido' || r.status === 'cancelado')) records[k] = { status: r.status, amount: r.amount === undefined ? undefined : Number(r.amount) || 0, date: typeof r.date === 'string' ? r.date : undefined };
    return { id: String(x.id ?? id()), name: String(x.name ?? 'Recebível'), type, certainty, prob, discountPct: Math.max(0, Math.min(100, Number(x.discountPct) || 0)),
      recurrence: (['once', 'monthly', 'yearly', 'custom'].includes(String(x.recurrence)) ? x.recurrence : 'once') as Recurrence, installments,
      until: typeof x.until === 'string' ? x.until : undefined, createdAt: typeof x.createdAt === 'string' ? x.createdAt : isoDay(new Date()), records };
  });
}

/** Exemplo: 13º (garantido), PLR em 2 parcelas (outubro e fevereiro, provável), freela incerto com histórico e um processo. */
export function exampleReceivables(salary: number, today = new Date()): Receivable[] {
  const t = new Date(today); const created = (k: number) => { const x = new Date(today); x.setMonth(x.getMonth() - k); return isoDay(x); };
  const d13 = PRESETS[0].build({ incomes: [{ id: 's', name: 'Salário', amount: salary }] } as Data);
  // PLR: parcela de outubro (se estamos em outubro, cai em 3 dias para demonstrar o alerta) + fevereiro
  const inOct = today.getMonth() === 9 && today.getDate() <= 27;
  const octDate = inOct ? (() => { const x = new Date(today); x.setDate(x.getDate() + 3); return isoDay(x); })() : `${nextYm(10, today)}-10`;
  const febYm = `${Number(octDate.slice(0, 4)) + 1}-02`;
  const ym = (k: number, day: number) => { const x = new Date(t.getFullYear(), t.getMonth() + k, 1); return `${ymOf(x)}-${pad(day)}`; };
  const p1 = id(), p2 = id(), p3 = id(), p4 = id();
  const freelaNet = Math.round(2000 * 0.94);
  const recDate = (k: number, day: number, plus: number) => { const x = new Date(t.getFullYear(), t.getMonth() + k, day); x.setDate(x.getDate() + plus); return isoDay(x); };
  return [
    { ...newReceivable(d13), createdAt: created(1) },
    { ...newReceivable(base('plr', 'PLR', 'yearly', [{ id: id(), label: '1ª parcela', date: octDate, gross: 3000 }, { id: id(), label: '2ª parcela', date: febYm, gross: 3000 }])), createdAt: created(1) },
    { id: id(), name: 'Projeto freela — app (cliente A)', type: 'nota', certainty: 'incerto', prob: 40, discountPct: 6, recurrence: 'custom', createdAt: created(5),
      installments: [{ id: p1, label: '1ª parcela', date: ym(-4, 10), gross: 2000 }, { id: p2, label: '2ª parcela', date: ym(-3, 10), gross: 2000 }, { id: p3, label: '3ª parcela', date: ym(-1, 10), gross: 2000 }, { id: p4, label: '4ª parcela', date: ym(1, 10), gross: 2000 }],
      records: { [`${p1}@${ym(-4, 10).slice(0, 7)}`]: { status: 'recebido', amount: Math.round(freelaNet * 0.9), date: recDate(-4, 10, 40) }, [`${p2}@${ym(-3, 10).slice(0, 7)}`]: { status: 'recebido', amount: Math.round(freelaNet * 0.8), date: recDate(-3, 10, 50) } } },
    { ...newReceivable(base('processo', 'Processo trabalhista (antigo emprego)', 'once', [{ id: id(), date: ym(8, 1).slice(0, 7), gross: 8000 }])), createdAt: created(2) },
  ];
}
export type { Debt, Goal };
