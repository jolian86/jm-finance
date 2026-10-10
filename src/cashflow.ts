// v15: o mês dia a dia — quando o dinheiro entra (dia que recebe) x quando as contas vencem.
import { Data, isDaily } from './finance';

export type FlowEvent = { day: number; name: string; amount: number; kind: 'entra' | 'conta' };
export type Flow = {
  start: number; // dia em que o "mês" começa: o dia da maior renda
  days: { day: number; bal: number }[]; // saldo ao fim de cada dia, contando a partir do dia do pagamento (começa em R$ 0)
  events: FlowEvent[]; tight: number[]; // dias em que o saldo fica negativo ("dias de aperto")
  early: { name: string; day: number; amount: number; suggest: number; id: string }[]; // contas que vencem antes do dinheiro chegar
  minBal: number; minDay: number; undated: number; deficit: number; paydays: { name: string; day: number; amount: number }[];
};
const clampDay = (d: number) => Math.min(28, Math.max(1, d));

/** null quando nenhuma renda tem "dia que recebe" (aí o app se comporta como antes). */
export function cashflow(d: Data): Flow | null {
  const pays = d.incomes.filter(i => i.payDay && !isDaily(i) && i.amount > 0).map(i => ({ id: i.id, name: i.name, day: Math.min(30, i.payDay!), amount: i.amount }));
  if (!pays.length) return null;
  const main = [...pays].sort((a, b) => b.amount - a.amount)[0];
  const start = main.day;
  // diárias e rendas sem dia entram aos poucos, ao longo do mês
  const spreadIn = d.incomes.filter(i => !pays.some(p => p.id === i.id)).reduce((s, i) => s + (i.amount || 0), 0) / 30;
  const bills = [...d.expenses.filter(e => e.dueDay).map(e => ({ id: e.id, name: e.name, day: Math.min(30, e.dueDay!), amount: e.amount })),
    ...d.debts.filter(x => x.dueDay && x.minPayment > 0).map(x => ({ id: x.id, name: x.name, day: Math.min(30, x.dueDay!), amount: x.minPayment }))];
  const undated = d.expenses.filter(e => !e.dueDay).reduce((s, e) => s + e.amount, 0) + d.debts.filter(x => !x.dueDay).reduce((s, x) => s + x.minPayment, 0);
  // se o mês não fecha, isso é outro problema (o diagnóstico já mostra): aqui olhamos só o "quando".
  const totIn = pays.reduce((a, p) => a + p.amount, 0) + spreadIn * 30, totOut = bills.reduce((a, b) => a + b.amount, 0) + undated;
  const deficit = Math.max(0, totOut - totIn);
  const spreadOut = Math.max(0, undated - deficit) / 30 - (deficit > undated ? 0 : 0);
  const events: FlowEvent[] = [...pays.map(p => ({ day: p.day, name: p.name, amount: p.amount, kind: 'entra' as const })), ...bills.map(b => ({ day: b.day, name: b.name, amount: b.amount, kind: 'conta' as const }))];
  const nextPay = (day: number) => { const ds = [...new Set(pays.map(p => p.day))].sort((a, b) => a - b); const nx = ds.find(x => x > day) ?? ds[0]; return clampDay(nx + 1); };
  let bal = 0; const days: Flow['days'] = []; const tight: number[] = []; let minBal = Infinity, minDay = start;
  const early: Flow['early'] = [];
  for (let k = 0; k < 30; k++) {
    const day = ((start - 1 + k) % 30) + 1;
    bal += pays.filter(p => p.day === day).reduce((s, p) => s + p.amount, 0) + spreadIn;
    const due = bills.filter(b => b.day === day);
    for (const b of due) { bal -= b.amount; if (bal < 0 && !early.some(e => e.id === b.id)) early.push({ id: b.id, name: b.name, day: b.day, amount: b.amount, suggest: nextPay(b.day) }); }
    bal -= spreadOut;
    days.push({ day, bal: Math.round(bal) });
    if (bal < -0.5) tight.push(day);
    if (bal < minBal) { minBal = bal; minDay = day; }
  }
  // sugestão: logo depois da renda que cobre melhor a conta (a maior que entra antes de faltar)
  return { start, days, events, tight, early, minBal: Math.round(minBal), minDay, undated, deficit: Math.round(deficit), paydays: pays.map(p => ({ name: p.name, day: p.day, amount: p.amount })) };
}
/** "dias 25 a 4" — agrupa dias seguidos */
export function dayRanges(ds: number[]) {
  const out: string[] = []; let i = 0;
  while (i < ds.length) { let j = i; while (j + 1 < ds.length && (ds[j + 1] === ds[j] + 1 || (ds[j] === 30 && ds[j + 1] === 1) || (ds[j] === 31 && ds[j + 1] === 1))) j++;
    out.push(i === j ? `dia ${ds[i]}` : `dias ${ds[i]} a ${ds[j]}`); i = j + 1; }
  return out.join(', ');
}
