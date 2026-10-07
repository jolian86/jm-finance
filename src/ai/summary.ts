import { Data, CATEGORIES, DEBT_TYPES, ASSET_TYPES, GOAL_TYPES, diagnose, actionPlan, order, evaluateGoals } from '../finance';
import type { FinancialSummary } from './types';

export function buildSummary(d: Data): FinancialSummary {
  const r = diagnose(d); const p = actionPlan(d); const g = evaluateGoals(d);
  const expIds = new Set(r.expensive.map(x => x.id));
  void CATEGORIES;
  return {
    hasData: d.incomes.length > 0,
    income: r.income, expenses: r.expenses, minPayments: r.minPayments, balance: r.balance,
    commitmentPct: r.commitment * 100, debtToIncomePct: r.dti * 100, monthlyInterest: r.monthlyInterest,
    score: r.score, level: r.level,
    reserve: r.reserve, effReserve: r.effReserve, reserveMonths: r.reserveMonths, reserveTarget6m: (r.essentials + r.minPayments) * 6,
    totalAssets: r.totalAssets + r.reserve, liquidAssets: r.liquidAssets + r.reserve, netWorth: r.netWorth,
    assets: d.assets.map(a => ({ name: a.name, type: ASSET_TYPES[a.type]?.label ?? a.type, value: a.value, liquid: a.liquid })),
    debts: d.debts.map(x => ({ name: x.name, type: DEBT_TYPES[x.type], balance: x.balance, ratePctMonth: x.rate, minPayment: x.minPayment, expensive: expIds.has(x.id) })),
    avalancheOrder: order(d.debts, 'avalanche').map(x => x.name), snowballOrder: order(d.debts, 'snowball').map(x => x.name),
    payoff: p.payoff ? { monthlyBudget: p.payoff.budget, avalancheMonths: p.payoff.av.feasible ? p.payoff.av.months : null, avalancheInterest: p.payoff.av.interest,
      snowballMonths: p.payoff.sb.feasible ? p.payoff.sb.months : null, snowballInterest: p.payoff.sb.interest } : undefined,
    surplusAfterCuts: p.surplus, freeForGoals: p.freeForGoals, freeAfterDebts: g.freeAfter, suggestedCuts: p.cuts,
    goals: g.results.map(x => ({ name: x.goal.name, type: GOAL_TYPES[x.goal.type], target: x.target, saved: x.goal.saved, monthsLeft: x.months, monthlyNeed: x.need, fits: x.fits, priority: x.goal.priority })),
    planSteps: p.steps.map(s => s.title),
  };
}
