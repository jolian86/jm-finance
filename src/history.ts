import { Data, Snapshot, Category, CATEGORIES, diagnose, exampleData, brl, uid, isDaily, withDaily } from './finance';

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MONTHS_FULL = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
export const ymAdd = (ym: string, k: number) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + k, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const ymShort = (ym: string) => { const [y, m] = ym.split('-'); return `${MONTHS[+m - 1]}/${y.slice(2)}`; };
export const ymLong = (ym: string) => { const [y, m] = ym.split('-'); return `${MONTHS_FULL[+m - 1]} de ${y}`; };
export const ymTitle = (ym: string) => { const t = ymLong(ym); return t[0].toUpperCase() + t.slice(1); };

export function plannedByCategory(d: Data) {
  const out: Partial<Record<Category, number>> = {};
  d.expenses.forEach(e => out[e.category] = (out[e.category] || 0) + (Number(e.amount) || 0));
  return out;
}
/** Gasto efetivo: usa o gasto real lançado quando existir; senão o planejado. */
export function spentByCategory(d: Data) {
  const p = plannedByCategory(d); const out: Partial<Record<Category, number>> = {};
  (Object.keys(p) as Category[]).forEach(c => out[c] = d.actuals[c] !== undefined && d.actuals[c] !== null ? Number(d.actuals[c]) : p[c]);
  return out;
}

export function snapshot(d: Data): Snapshot {
  const r = diagnose(d);
  const spent = spentByCategory(d);
  const expenses = Object.values(spent).reduce((a, b) => a + (b || 0), 0);
  return {
    month: d.month, closedAt: Date.now(), income: r.income, expenses, minPayments: r.minPayments, balance: r.income - expenses - r.minPayments,
    planned: plannedByCategory(d), spent, totalDebt: r.totalDebt, debts: d.debts.map(x => ({ name: x.name, balance: x.balance })),
    totalAssets: r.totalAssets + r.reserve, netWorth: r.netWorth, reserve: r.effReserve, reserveMonths: r.reserveMonths, score: r.score, level: r.level,
    goals: d.goals.map(g => ({ name: g.name, saved: g.saved, target: g.target, progress: g.target ? Math.min(1, g.saved / g.target) : 0 })),
    daily: d.incomes.filter(isDaily).map(i => { const e = Object.entries(i.daily?.log ?? {}).filter(([k]) => k.startsWith(d.month)); return { name: i.name, days: e.length, total: e.reduce((t, [, v]) => t + v, 0), logged: e.length > 0 }; }),
  };
}

/** Fecha o mês corrente: guarda a foto no histórico e avança para o mês seguinte (ou o mês do calendário atual). */
export function closeMonth(d: Data, calendarMonth: string): Data {
  const snap = snapshot(d);
  const history = [...d.history.filter(h => h.month !== d.month), snap].sort((a, b) => a.month.localeCompare(b.month)).slice(-36);
  const next = ymAdd(d.month, 1);
  // diárias: o total marcado no mês fechado entra no histórico (assim o app aprende os meses fracos)
  const incomes = d.incomes.map(i => { if (!isDaily(i)) return i; const e = Object.entries(i.daily?.log ?? {}).filter(([k]) => k.startsWith(d.month));
    return withDaily(e.length ? { ...i, history: [...(i.history ?? []), Math.round(e.reduce((t, [, v]) => t + v, 0) * 100) / 100].slice(-12) } : i); });
  return { ...d, incomes, history, month: next > calendarMonth ? next : calendarMonth, actuals: {}, dismissedAlerts: [] };
}

export const needsClosing = (d: Data, calendarMonth: string) => d.incomes.length > 0 && d.month < calendarMonth;

export type Point = { m: string; label: string; score: number; netWorth: number; totalDebt: number; reserveMonths: number; partial?: boolean; [cat: string]: string | number | boolean | undefined };
/** Série para gráficos: meses fechados + mês atual (parcial). */
export function series(d: Data): Point[] {
  const cur = snapshot(d);
  const all = [...d.history, cur];
  return all.map((h, i) => {
    const p: Point = { m: h.month, label: ymShort(h.month) + (i === all.length - 1 ? '*' : ''), score: h.score, netWorth: Math.round(h.netWorth), totalDebt: Math.round(h.totalDebt), reserveMonths: +h.reserveMonths.toFixed(1), partial: i === all.length - 1 };
    (Object.keys(h.spent) as Category[]).forEach(c => p[CATEGORIES[c].label] = Math.round(h.spent[c] || 0));
    return p;
  });
}

const f1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export type Delta = { tone: 'good' | 'bad' | 'neutral'; text: string };
/** Comparações em linguagem simples: mês atual x último mês fechado. */
export function deltas(d: Data): Delta[] {
  const last = d.history[d.history.length - 1]; if (!last) return [];
  const c = snapshot(d); const since = `desde ${ymShort(last.month)}`; const out: Delta[] = [];
  const dd = c.totalDebt - last.totalDebt;
  if (Math.abs(dd) >= 1) out.push(dd < 0 ? { tone: 'good', text: `Sua dívida caiu ${brl(-dd)} ${since}.` } : { tone: 'bad', text: `Sua dívida aumentou ${brl(dd)} ${since}.` });
  const nw = c.netWorth - last.netWorth;
  if (Math.abs(nw) >= 1) out.push(nw > 0 ? { tone: 'good', text: `Quanto você tem de verdade (bens − dívidas) cresceu ${brl(nw)} ${since}.` } : { tone: 'bad', text: `Quanto você tem de verdade (bens − dívidas) diminuiu ${brl(-nw)} ${since}.` });
  if (c.score !== last.score) out.push(c.score > last.score ? { tone: 'good', text: `Sua nota subiu de ${last.score} para ${c.score}.` } : { tone: 'bad', text: `Sua nota caiu de ${last.score} para ${c.score}.` });
  const rm = c.reserveMonths - last.reserveMonths;
  if (Math.abs(rm) >= 0.05) out.push({ tone: rm > 0 ? 'good' : 'bad', text: `Sua reserva ${rm > 0 ? 'aumentou' : 'diminuiu'} de ${f1(last.reserveMonths)} para ${f1(c.reserveMonths)} meses de custos.` });
  const ex = c.expenses - last.expenses;
  if (Math.abs(ex) >= 1) out.push(ex < 0 ? { tone: 'good', text: `Você gastou ${brl(-ex)} a menos que em ${ymShort(last.month)}${Object.keys(d.actuals).length ? '' : ' (pelo orçamento planejado)'}.` } : { tone: 'bad', text: `Seus gastos estão ${brl(ex)} acima de ${ymShort(last.month)}${Object.keys(d.actuals).length ? '' : ' (pelo orçamento planejado)'}.` });
  if (!out.length) out.push({ tone: 'neutral', text: `Nada mudou ${since}. Atualize saldos de dívidas, reserva e bens para acompanhar sua evolução.` });
  return out;
}

/** Dados de exemplo com ~6 meses de histórico fictício (melhora gradual). */
export function fullExample(): Data {
  const d = exampleData();
  const day = new Date().getDate();
  const wrap = (k: number) => ((day - 1 + k) % 28) + 1;
  d.debts = d.debts.map((x, i) => ({ ...x, dueDay: [wrap(2), wrap(9), wrap(0)][i] }));
  d.expenses = d.expenses.map(e => e.name === 'Aluguel' ? { ...e, dueDay: wrap(3) } : e.name.startsWith('Luz') ? { ...e, dueDay: wrap(12) } : e);
  d.actuals = { moradia: 1850, alimentacao: 1180, transporte: 300, lazer: 640, compras: 310, assinaturas: 120 };
  const base = snapshot({ ...d, actuals: {} });
  const steps = [
    { debt: 14800, nw: 25200, score: 15, res: 0.1, f: 1.10 }, { debt: 14100, nw: 25900, score: 16, res: 0.1, f: 1.08 },
    { debt: 13300, nw: 26800, score: 18, res: 0.2, f: 1.06 }, { debt: 12500, nw: 27700, score: 20, res: 0.3, f: 1.05 },
    { debt: 11700, nw: 28500, score: 21, res: 0.4, f: 1.03 }, { debt: 11100, nw: 29100, score: 22, res: 0.4, f: 1.02 },
  ];
  const ratio = base.totalDebt ? 1 : 0;
  d.history = steps.map((s, i) => {
    const month = ymAdd(d.month, i - steps.length);
    const spent: Snapshot['spent'] = {};
    (Object.keys(base.planned) as Category[]).forEach((c, j) => spent[c] = Math.round((base.planned[c] || 0) * (CATEGORIES[c].group === 'desejo' ? s.f + 0.08 * ((i + j) % 2) : 1 + (s.f - 1) / 2)));
    const expenses = Object.values(spent).reduce((a, b) => a + (b || 0), 0);
    return { ...base, month, closedAt: Date.now() - (steps.length - i) * 2.6e9, spent, expenses, balance: base.income - expenses - base.minPayments,
      totalDebt: s.debt * ratio, debts: base.debts.map(x => ({ ...x, balance: Math.round(x.balance * s.debt / base.totalDebt) })),
      netWorth: s.nw, reserveMonths: s.res, score: s.score, level: 'crítico',
      goals: base.goals.map(g => ({ ...g, saved: Math.round(g.saved * i / steps.length), progress: g.progress * i / steps.length })) };
  });
  d.goals = d.goals.map(g => ({ ...g, id: g.id || uid() }));
  return d;
}
