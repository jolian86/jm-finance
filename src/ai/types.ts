export type ChatRole = 'user' | 'assistant';
export type ChatMessage = { id: string; role: ChatRole; content: string; at: number };

/** Resumo financeiro enviado ao consultor (simulado ou LLM real). Sem dados identificáveis. */
export type FinancialSummary = {
  hasData: boolean;
  income: number; expenses: number; minPayments: number; balance: number;
  commitmentPct: number; debtToIncomePct: number; monthlyInterest: number;
  score: number; level: string;
  reserve: number; effReserve: number; reserveMonths: number; reserveTarget6m: number;
  totalAssets: number; liquidAssets: number; netWorth: number;
  assets: { name: string; type: string; value: number; liquid: boolean }[];
  debts: { name: string; type: string; balance: number; ratePctMonth: number; minPayment: number; expensive: boolean }[];
  avalancheOrder: string[]; snowballOrder: string[];
  payoff?: { monthlyBudget: number; avalancheMonths: number | null; avalancheInterest: number; snowballMonths: number | null; snowballInterest: number };
  surplusAfterCuts: number; freeForGoals: number; freeAfterDebts: number; suggestedCuts: { name: string; current: number; suggested: number }[];
  goals: { name: string; type: string; target: number; saved: number; monthsLeft: number; monthlyNeed: number; fits: boolean; priority: string }[];
  planSteps: string[];
};

/** Interface agnóstica de provedor: qualquer backend (simulação, OpenAI, etc.) implementa isto. */
export interface ChatProvider {
  id: string;
  label: string;
  simulated: boolean;
  sendMessage(history: ChatMessage[], financialSummary: FinancialSummary): Promise<string>;
}
