export type ChatRole = 'user' | 'assistant';
/** Ação opcional sugerida pelo consultor (o usuário decide se executa). */
export type SimLink = 'financiar' | 'quitar-investir' | 'antecipar' | 'consolidar' | 'cortar';
export type ChatAction = { type: 'create_goal'; label: string; goal: { name: string; type: 'viagem' | 'compra' | 'reserva' | 'outro'; target: number; date: string } }
  | { type: 'open_sim'; label: string; sim: SimLink }
  | { type: 'go'; label: string; tab: 'dados' | 'plano' | 'diagnostico' | 'objetivos' }
  | { type: 'recat'; label: string; expenseId: string; category: string }
  /** abre "O que entra na fatura?" no gasto (e, se toCard, antes transforma o gasto em Fatura do cartão) */
  | { type: 'card'; label: string; expenseId: string; toCard?: boolean };
export type ChatMessage = { id: string; role: ChatRole; content: string; at: number; actions?: ChatAction[]; done?: boolean };
export type ChatReply = { content: string; actions?: ChatAction[]; setName?: string };

/** Resumo financeiro enviado ao consultor (simulado ou LLM real). Sem dados identificáveis. */
export type FinancialSummary = {
  hasData: boolean;
  /** como o usuário quer ser chamado (opcional) */
  userName?: string;
  /** v15: o mês dia a dia (só se alguma renda tem dia que recebe) */
  cashflow?: { startDay: number; deficit: number; paydays: { name: string; day: number; amount: number }[]; tightDays: string; worstDay: number; worstBalance: number; billsBeforeMoney: { name: string; day: number; amount: number; suggestDay: number }[] };
  /** v15: o que puxa a nota para baixo, caminho até 80 e análise gasto a gasto */
  coach: { drivers: { pts: number; text: string }[]; path: { start: number; end: number; reached: boolean; steps: { kind: string; text: string; from: number; to: number; expenseId?: string }[] };
    expenseNotes: { id: string; name: string; amount: number; typical: number; save: number; label: string; tips: string[] }[]; others: { id: string; name: string; amount: number; sharePct: number; kind: 'outros' | 'cartao'; split: boolean; parcelas: number }[]; hasRevolving: boolean; cardParcelas: number;
    expenses: { id: string; name: string; amount: number; category: string }[]; incomeKinds: { variable: boolean; daily: boolean } };
  income: number; expenses: number; minPayments: number; balance: number;
  commitmentPct: number; debtToIncomePct: number; monthlyInterest: number;
  score: number; level: string;
  reserve: number; effReserve: number; reserveMonths: number; reserveTarget6m: number;
  totalAssets: number; liquidAssets: number; netWorth: number;
  assets: { name: string; type: string; value: number; liquid: boolean }[];
  debts: { name: string; type: string; balance: number; ratePctMonth: number; minPayment: number; expensive: boolean }[];
  avalancheOrder: string[]; snowballOrder: string[];
  /** recommended: estratégia que o app recomenda. Nomes para o usuário: avalanche = "Economizar mais juros"; snowball = "Quitar primeiro as menores". */
  payoff?: { monthlyBudget: number; avalancheMonths: number | null; avalancheInterest: number; snowballMonths: number | null; snowballInterest: number; recommended: 'avalanche' | 'snowball'; recommendedMonths: number | null };
  surplusAfterCuts: number; freeForGoals: number; freeAfterDebts: number; suggestedCuts: { name: string; current: number; suggested: number }[];
  goals: { name: string; type: string; target: number; saved: number; monthsLeft: number; monthlyNeed: number; fits: boolean; priority: string }[];
  planSteps: string[];
  /** receitas futuras (12 meses): totais, modo usado no plano e frases de uso sugerido */
  receivables: { count: number; expected: number; weighted: number; guaranteed: number; mode: string; overdue: number;
    upcoming: { name: string; type: string; when: string; net: number; certainty: string; prob: number }[]; uses: { type: string; text: string }[] };
  variableIncome: { name: string; base: number; avg: number; min: number }[];
  /** renda por dia (diária): valor por dia, dias por mês (estimados ou aprendidos), quanto o plano conta e como vai o mês atual */
  dailyIncome: { name: string; perDay: number; daysPerMonth: number; expectedMonth: number; planMonth: number; learned: boolean; thisMonthDays: number; thisMonthTotal: number; thisMonthStatus: string }[];
};

/** Interface agnóstica de provedor: qualquer backend (simulação, OpenAI, etc.) implementa isto. */
export interface ChatProvider {
  id: string;
  label: string;
  simulated: boolean;
  sendMessage(history: ChatMessage[], financialSummary: FinancialSummary): Promise<ChatReply>;
}
