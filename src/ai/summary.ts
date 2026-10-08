import { Data, CATEGORIES, DEBT_TYPES, ASSET_TYPES, GOAL_TYPES, diagnose, actionPlan, order, evaluateGoals, varStats } from '../finance';
import { RECV_TYPES, CERT, fmtOccDate, lumpSentence, isOpen, allOccurrences } from '../recv';
import type { FinancialSummary } from './types';

export function buildSummary(d: Data): FinancialSummary {
  const r = diagnose(d); const p = actionPlan(d); const g = evaluateGoals(d);
  const expIds = new Set(r.expensive.map(x => x.id));
  void CATEGORIES; void RECV_TYPES;
  return {
    hasData: d.incomes.length > 0,
    income: r.income, expenses: r.expenses, minPayments: r.minPayments, balance: r.balance,
    commitmentPct: r.commitment * 100, debtToIncomePct: r.dti * 100, monthlyInterest: r.monthlyInterest,
    score: r.score, level: r.level,
    reserve: r.reserve, effReserve: r.effReserve, reserveMonths: r.reserveMonths, reserveTarget6m: (r.essentials + r.minPayments) * 6,
    totalAssets: r.totalAssets + r.reserve, liquidAssets: r.liquidAssets + r.reserve, netWorth: r.netWorth,
    assets: d.assets.map(a => ({ name: a.name, type: ASSET_TYPES[a.type]?.label ?? a.type, value: a.value, liquid: ASSET_TYPES[a.type]?.liquid ?? false })),
    debts: d.debts.map(x => ({ name: x.name, type: DEBT_TYPES[x.type], balance: x.balance, ratePctMonth: x.rate, minPayment: x.minPayment, expensive: expIds.has(x.id) })),
    avalancheOrder: order(d.debts, 'avalanche').map(x => x.name), snowballOrder: order(d.debts, 'snowball').map(x => x.name),
    payoff: p.payoff ? { monthlyBudget: p.payoff.budget, avalancheMonths: p.payoff.av.feasible ? p.payoff.av.months : null, avalancheInterest: p.payoff.av.interest,
      snowballMonths: p.payoff.sb.feasible ? p.payoff.sb.months : null, snowballInterest: p.payoff.sb.interest } : undefined,
    surplusAfterCuts: p.surplus, freeForGoals: p.freeForGoals, freeAfterDebts: g.freeAfter, suggestedCuts: p.cuts,
    goals: g.results.map(x => ({ name: x.goal.name, type: GOAL_TYPES[x.goal.type], target: x.target, saved: x.goal.saved, monthsLeft: x.months, monthlyNeed: x.need, fits: x.fits, priority: x.goal.priority })),
    planSteps: p.steps.map(s => s.title),
    receivables: { count: d.receivables.length, expected: p.recv.fc.expected, weighted: p.recv.fc.weighted, guaranteed: p.recv.fc.guaranteed, mode: p.recv.mode, overdue: p.recv.fc.overdue,
      upcoming: allOccurrences(d).filter(isOpen).slice(0, 8).map(o => ({ name: o.recv.name + (o.inst.label ? ` (${o.inst.label})` : ''), type: o.recv.type, when: fmtOccDate(o.ym, o.day), net: o.net, certainty: CERT[o.certainty].label, prob: o.prob })),
      uses: p.recv.lumpsFull.filter(l => l.occ.recv.recurrence !== 'monthly').slice(0, 8).map(l => ({ type: l.occ.recv.type, text: lumpSentence(l) })) },
    variableIncome: d.incomes.filter(i => i.variable).map(i => { const v = varStats(i.history ?? []); return { name: i.name, base: v.base || i.amount, avg: v.avg, min: v.min }; }),
  };
}
