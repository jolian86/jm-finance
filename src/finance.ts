import { Receivable, RecvMode, cleanReceivables, exampleReceivables, planLumps, forecast, lumpSentence, modeValue, Lump } from './recv';
/** variable: renda variável; history: valores dos últimos meses (mais antigo → mais recente). Com 3+ meses, amount = base conservadora. */
export type Income = { id: string; name: string; amount: number; variable?: boolean; history?: number[] };
/** kind é decidido pelo app (inferKind) a partir da categoria e do nome; kindSet = o usuário ajustou manualmente (então não muda sozinho). */
export type Expense = { id: string; name: string; amount: number; category: Category; kind: 'fixa' | 'variavel'; dueDay?: number; kindSet?: boolean };
export type DebtType = 'cartao_rotativo' | 'cheque_especial' | 'emprestimo_pessoal' | 'consignado' | 'financiamento_imovel' | 'financiamento_veiculo' | 'financiamento' | 'outro';
/** rate = juros AO MÊS em % (canônico). rateUnit só muda como o usuário digita/vê. rateMode 'calc' = app calcula a taxa pela parcela.
 *  installments = parcelas restantes (opcional). minPayment = valor da parcela (ou pagamento mínimo no rotativo/cheque). */
/** rateMode 'media' = usa a taxa média do mercado para o tipo (rotativo/cheque); payAuto = pagamento mensal estimado pelo app (o usuário não informou). */
export type Debt = { id: string; name: string; type: DebtType; balance: number; rate: number; minPayment: number; dueDay?: number;
  rateUnit?: RateUnit; rateMode?: RateMode; installments?: number; payAuto?: boolean };
export type RateMode = 'sei' | 'calc' | 'media';
export type RateUnit = 'am' | 'aa';
export type AssetType = 'conta' | 'invest_rapido' | 'invest_longo' | 'previdencia' | 'seguro_vida' | 'imovel' | 'terreno' | 'veiculo' | 'outros';
/** `liquid` é derivado do tipo (ASSET_TYPES) — o usuário não escolhe; mantido no dado por compatibilidade. */
export type Asset = { id: string; name: string; type: AssetType; value: number; liquid: boolean;
  /** previdência/seguro: aporte mensal (opcional); expenseId = gasto fixo ligado (o valor vive no gasto, sem contar duas vezes); forRetirement = soma no objetivo de aposentadoria */
  monthly?: number; expenseId?: string; forRetirement?: boolean };
export type GoalType = 'viagem' | 'compra' | 'aposentadoria' | 'reserva' | 'outro';
export type Priority = 'alta' | 'media' | 'baixa';
/** rate = rendimento acima da inflação, % ao mês. rateSet = o usuário ajustou (senão usa o padrão conservador). */
export type Retire = { monthlyIncome: number; age: number; retireAge: number; rate: number; rateSet?: boolean };
export type Goal = { id: string; name: string; type: GoalType; target: number; date: string; saved: number; priority: Priority; retire?: Retire };
/** Foto de um mês fechado (histórico). */
export type Snapshot = {
  month: string; closedAt: number; income: number; expenses: number; minPayments: number; balance: number;
  planned: Partial<Record<Category, number>>; spent: Partial<Record<Category, number>>;
  totalDebt: number; debts: { name: string; balance: number }[]; totalAssets: number; netWorth: number;
  reserve: number; reserveMonths: number; score: number; level: string;
  goals: { name: string; saved: number; target: number; progress: number }[];
};
export type Data = {
  incomes: Income[]; expenses: Expense[]; debts: Debt[]; reserve: number; assets: Asset[]; goals: Goal[]; isExample?: boolean;
  /** mês corrente (YYYY-MM) a que os dados atuais se referem */
  month: string;
  /** gasto real lançado no mês corrente, por categoria (opcional) */
  actuals: Partial<Record<Category, number>>;
  history: Snapshot[];
  dismissedAlerts: string[];
  /** preferências (o horário de alertas será usado também por um futuro servidor de push) */
  settings: Settings;
  /** receitas futuras / recebíveis (13º, PLR, honorários, notas, safra...) */
  receivables: Receivable[];
};
/** Versão do formato dos dados (sobe quando o formato muda; dados antigos passam por migrate). */
export const SCHEMA_VERSION = 10;
/** terms: aceite dos Termos de Uso/Política de Privacidade (versão + data/hora ISO). */
export type Settings = { alertTime: string; firstSeenAt?: string; lastBackupAt?: string; terms?: { version: string; acceptedAt: string }; recvMode?: RecvMode };
export const DEFAULT_SETTINGS: Settings = { alertTime: '09:00' };
export type Category = 'moradia' | 'alimentacao' | 'transporte' | 'saude' | 'educacao' | 'lazer' | 'assinaturas' | 'compras' | 'protecao' | 'outros';

export const CATEGORIES: Record<Category, { label: string; short?: string; group: 'necessidade' | 'desejo' }> = {
  moradia: { label: 'Moradia', group: 'necessidade' },
  alimentacao: { label: 'Alimentação', group: 'necessidade' },
  transporte: { label: 'Transporte', group: 'necessidade' },
  saude: { label: 'Saúde', group: 'necessidade' },
  educacao: { label: 'Educação', group: 'necessidade' },
  lazer: { label: 'Lazer', group: 'desejo' },
  assinaturas: { label: 'Assinaturas', group: 'desejo' },
  compras: { label: 'Compras', group: 'desejo' },
  protecao: { label: 'Previdência e seguros', short: 'Prev./seguro', group: 'necessidade' },
  outros: { label: 'Outros', group: 'desejo' },
};
export const DEBT_TYPES: Record<DebtType, string> = {
  cartao_rotativo: 'Cartão (rotativo)', cheque_especial: 'Cheque especial', emprestimo_pessoal: 'Empréstimo pessoal',
  consignado: 'Consignado', financiamento_imovel: 'Financiamento de imóvel', financiamento_veiculo: 'Financiamento de veículo',
  financiamento: 'Outro financiamento', outro: 'Outra dívida / parcelamento',
};
/** Como cada tipo costuma informar os juros e se tem parcelas fixas. */
export const DEBT_INFO: Record<DebtType, { unit: RateUnit; parcelado: boolean; hint: string }> = {
  cartao_rotativo: { unit: 'am', parcelado: false, hint: 'Na fatura, procure “juros do rotativo”.' },
  cheque_especial: { unit: 'am', parcelado: false, hint: 'Aparece no app ou no extrato do banco. Por lei, não passa de 8% ao mês.' },
  emprestimo_pessoal: { unit: 'am', parcelado: true, hint: 'Está no contrato (procure “taxa mensal” ou “custo efetivo total”).' },
  consignado: { unit: 'am', parcelado: true, hint: 'Costuma ficar entre 1,5% e 2% ao mês.' },
  financiamento_imovel: { unit: 'aa', parcelado: true, hint: 'No contrato a taxa costuma vir ao ano (ex.: 10% ao ano ≈ 0,80% ao mês).' },
  financiamento_veiculo: { unit: 'aa', parcelado: true, hint: 'No contrato a taxa costuma vir ao ano (ex.: 24% ao ano ≈ 1,81% ao mês).' },
  financiamento: { unit: 'am', parcelado: true, hint: 'Está no contrato ou no app da financeira.' },
  outro: { unit: 'am', parcelado: true, hint: 'Se não souber, use “Não sei a taxa” e informe as parcelas.' },
};
/** Taxas médias de mercado (Banco Central, pessoa física, ago/2026) — usadas quando a pessoa não sabe a taxa do rotativo/cheque especial. */
export const AVG_RATES: Partial<Record<DebtType, { rate: number; ref: string }>> = {
  cartao_rotativo: { rate: 15, ref: 'média do Banco Central para o rotativo do cartão (ago/2026)' },
  cheque_especial: { rate: 7.5, ref: 'média do Banco Central para o cheque especial (ago/2026; o teto legal é 8%)' },
};
/** Pagamento mensal estimado quando a pessoa não informa: 15% da fatura no cartão; 10% do saldo no cheque especial. */
export const AUTO_PAY: Partial<Record<DebtType, number>> = { cartao_rotativo: 0.15, cheque_especial: 0.1 };
export const autoPay = (type: DebtType, balance: number) => Math.round((Number(balance) || 0) * (AUTO_PAY[type] ?? 0) * 100) / 100;
// ---- taxas: canônico ao mês; conversão por juros compostos ----
export const amToAa = (am: number) => (Math.pow(1 + am / 100, 12) - 1) * 100;
export const aaToAm = (aa: number) => (Math.pow(1 + aa / 100, 1 / 12) - 1) * 100;
const f2 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: n !== 0 && Math.abs(n) < 0.1 ? 4 : 2 });
/** Para textos corridos: "15% ao mês", "4,5% ao mês", "0,79% ao mês". */
const fp = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: n !== 0 && Math.abs(n) < 0.1 ? 4 : 2 });
export const fmtAm = (am: number) => `${fp(am)}% ao mês`;
export const fmtAa = (am: number) => `${fp(Math.round(amToAa(am) * 10) / 10)}% ao ano`;
/** "1,00% ao mês ≈ 12,68% ao ano" (ou ao ano primeiro quando a unidade é ao ano). */
export const fmtRateBoth = (am: number, unit: RateUnit = 'am') => unit === 'aa' ? `${f2(amToAa(am))}% ao ano ≈ ${f2(am)}% ao mês` : `${f2(am)}% ao mês ≈ ${f2(amToAa(am))}% ao ano`;
/** Lê "0,79", "0.79", "12,5", ",5". Vazio → undefined. */
export function parseRate(t: string): number | undefined {
  const s = t.trim().replace(/\s|%/g, ''); if (!s) return undefined;
  const norm = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  const n = Number(norm.endsWith('.') ? norm.slice(0, -1) : norm); return Number.isFinite(n) && n >= 0 ? n : undefined;
}
export type RateSolve = { ok: true; rate: number; zero: boolean } | { ok: false; msg: string };
/** Taxa mensal implícita (Price): saldo = parcela × (1 − (1+i)^−n) / i. Bisseção; 0% quando parcela × n = saldo. */
export function solveRate(balance: number, payment: number, n: number): RateSolve {
  const B = Number(balance) || 0, P = Number(payment) || 0, N = Math.round(Number(n) || 0);
  if (B <= 0 || P <= 0 || N < 1) return { ok: false, msg: 'Preencha o saldo devedor, o valor da parcela e quantas parcelas faltam — o app calcula a taxa.' };
  const total = P * N, tol = Math.max(0.5, B * 0.0005);
  if (total < B - tol) return { ok: false, msg: `As ${N} parcelas de ${brl(P)} somam ${brl(total)}, menos que o saldo devedor (${brl(B)}). Confira os valores: talvez faltem parcelas ou o saldo já tenha desconto.` };
  if (Math.abs(total - B) <= tol) return { ok: true, rate: 0, zero: true };
  const pv = (i: number) => P * (1 - Math.pow(1 + i, -N)) / i;
  let lo = 1e-9, hi = 1;
  if (pv(hi) > B) return { ok: false, msg: 'Com esses valores a taxa passaria de 100% ao mês. Confira a parcela, o saldo e quantas faltam.' };
  for (let k = 0; k < 200; k++) { const mid = (lo + hi) / 2; if (pv(mid) > B) lo = mid; else hi = mid; }
  return { ok: true, rate: Math.round(((lo + hi) / 2) * 100 * 10000) / 10000, zero: false };
}
/** Mês (YYYY-MM) da última parcela, contando a deste mês como 1ª. */
export const lastInstallmentYm = (n: number, from = thisMonth()) => { const [y, m] = from.split('-').map(Number); const d = new Date(y, m - 1 + Math.max(1, Math.round(n)) - 1, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** O app decide sozinho o que é "disponível rápido" pelo tipo do bem. */
export const ASSET_TYPES: Record<AssetType, { label: string; liquid: boolean; hint: string }> = {
  conta: { label: 'Dinheiro em conta ou poupança', liquid: true, hint: 'Dá para usar na hora.' },
  invest_rapido: { label: 'Investimento de resgate rápido', liquid: true, hint: 'Dá para sacar quando quiser e o dinheiro cai em poucos dias. Ex.: CDB com resgate diário, Tesouro Selic, fundo DI.' },
  previdencia: { label: 'Previdência (PGBL/VGBL)', liquid: false, hint: 'Sacar antes tem prazo mínimo, imposto e às vezes taxa de saída. É dinheiro para a aposentadoria.' },
  seguro_vida: { label: 'Seguro de vida com resgate', liquid: false, hint: 'O resgate demora, tem descontos e pode cancelar a proteção da sua família.' },
  invest_longo: { label: 'Investimento de longo prazo', liquid: false, hint: 'Sacar antes do prazo pode demorar ou fazer perder dinheiro. Ex.: ações, fundos imobiliários, Tesouro IPCA, CDB/LCI/LCA com prazo para sacar.' },
  imovel: { label: 'Imóvel', liquid: false, hint: 'Casa, apartamento, sala. Leva tempo para vender.' },
  terreno: { label: 'Terreno', liquid: false, hint: 'Leva tempo para vender.' },
  veiculo: { label: 'Veículo', liquid: false, hint: 'Carro, moto. Leva tempo para vender sem perder valor.' },
  outros: { label: 'Outros bens', liquid: false, hint: 'Leva tempo para virar dinheiro.' },
};
const LONG_RX = /previd|pgbl|vgbl|a[cç][oõ]es|bolsa|\bfii?s?\b|imobili[aá]rio|lci|lca|car[eê]ncia|cdb.*(venc|20\d\d)|tesouro\s*(ipca|prefixado|renda\+?)|deb[eê]nture|cripto|bitcoin/i;
/** Tipo do bem a partir de dados antigos (o antigo "líquido/ilíquido" é ignorado). */
export function assetTypeOf(type: unknown, name: string): AssetType {
  if (type === 'outros' && /terreno|lote\b/i.test(name)) return 'terreno';
  if (typeof type === 'string' && type in ASSET_TYPES) return type as AssetType;
  if (type === 'investimentos') return /previd|pgbl|vgbl/i.test(name) ? 'previdencia' : LONG_RX.test(name) ? 'invest_longo' : 'invest_rapido';
  if (/terreno|lote\b/i.test(name)) return 'terreno';
  return 'outros';
}
export const isLiquid = (a: Pick<Asset, 'type'>) => !!ASSET_TYPES[a.type]?.liquid;
// ---- gasto fixo x variável: o app decide pela categoria e pelo nome ----
const FIXED_RX = /aluguel|condom|financ|presta[cç]|parcela|cons[oó]rcio|\bluz\b|energia|[aá]gua|\bg[aá]s\b|internet|telefone|celular|\bplano\b|assinatura|streaming|netflix|spotify|prime|disney|youtube|academia|mensalidade|escola|faculdade|creche|curso|seguro|previd|iptu|ipva|\btv\b|bab[aá]|diarista|empregada|pens[aã]o|d[ií]zimo/i;
const VAR_RX = /mercado|feira|padaria|a[cç]ougue|delivery|ifood|restaurante|lanche|comida|combust|gasolina|[aá]lcool|etanol|uber|\b99\b|t[aá]xi|[oô]nibus|metr[oô]|estacionamento|ped[aá]gio|farm[aá]cia|rem[eé]dio|consulta|sa[ií]da|bar\b|cinema|passeio|viagem|roupa|compra|presente|sal[aã]o|beleza|cabelo|pet\b|ra[cç][aã]o/i;
const FIXED_CATS: Category[] = ['moradia', 'educacao', 'assinaturas', 'protecao'];
/** Fixo (mesmo valor todo mês) ou variável — decidido pelo app. O nome tem prioridade sobre a categoria. */
export function inferKind(category: Category, name = ''): 'fixa' | 'variavel' {
  if (FIXED_RX.test(name)) return 'fixa';
  if (VAR_RX.test(name)) return 'variavel';
  return FIXED_CATS.includes(category) ? 'fixa' : 'variavel';
}
/** Atualiza um gasto mantendo o "fixo/variável" automático (a menos que o usuário tenha ajustado). */
export const withAutoKind = (e: Expense): Expense => e.kindSet ? e : { ...e, kind: inferKind(e.category, e.name) };
// ---- objetivo de aposentadoria: rendimento acima da inflação (padrão conservador) ----
export const DEFAULT_REAL_AA = 4;
export const DEFAULT_REAL_AM = Math.round(aaToAm(DEFAULT_REAL_AA) * 10000) / 10000;
export const newRetire = (age = 30): Retire => ({ monthlyIncome: 3000, age, retireAge: 65, rate: DEFAULT_REAL_AM, rateSet: false });
export const GOAL_TYPES: Record<GoalType, string> = { viagem: 'Viagem', compra: 'Compra', aposentadoria: 'Aposentadoria', reserva: 'Reserva', outro: 'Outro' };
export const PRIORITIES: Record<Priority, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
export const DISCLAIMER = 'A JM Finance não decide por você. Nós auxiliamos na sua gestão financeira!';

export const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const pct = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
export const uid = () => Math.random().toString(36).slice(2, 10);

export const thisMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
export const emptyData = (): Data => ({ incomes: [], expenses: [], debts: [], reserve: 0, assets: [], goals: [], month: thisMonth(), actuals: {}, history: [], dismissedAlerts: [], settings: { ...DEFAULT_SETTINGS }, receivables: [] });
const isoOk = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v));
// Migra dados antigos (sem assets/goals) sem quebrar
export function migrate(raw: unknown): Data {
  const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<Data>;
  const arr = <T,>(v: unknown) => (Array.isArray(v) ? v as T[] : []);
  return {
    ...emptyData(), ...d,
    incomes: arr<Income>(d.incomes).map(i => ({ ...i, history: Array.isArray(i.history) ? i.history.map(v => Number(v) || 0).slice(-12) : undefined, variable: !!i.variable })), receivables: cleanReceivables(d.receivables), expenses: arr<Expense>(d.expenses).filter(o => o && typeof o === 'object').map(e => ({ ...e, id: String(e.id || uid()), name: String(e.name ?? ''), amount: Number(e.amount) || 0, category: e.category in CATEGORIES ? e.category : 'outros', kind: (e.kind === 'variavel' ? 'variavel' : 'fixa') as Expense['kind'] })).map(e => ({ ...e, kindSet: typeof e.kindSet === 'boolean' ? e.kindSet : e.kind !== inferKind(e.category, e.name) })),
    debts: arr<Debt>(d.debts).filter(o => o && typeof o === 'object').map(x => { const inst = Math.round(Number(x.installments)); return { ...x, id: String(x.id || uid()), name: String(x.name ?? ''), type: x.type in DEBT_TYPES ? x.type : 'outro', balance: Number(x.balance) || 0, rate: Math.max(0, Number(x.rate) || 0), minPayment: Number(x.minPayment) || 0, rateUnit: x.rateUnit === 'aa' ? 'aa' : 'am', rateMode: x.rateMode === 'calc' || x.rateMode === 'media' ? x.rateMode : 'sei', installments: inst >= 1 && inst <= 600 ? inst : undefined, payAuto: !!x.payAuto }; }),
    assets: arr<Asset>(d.assets).filter(o => o && typeof o === 'object').map(x => { const name = String(x.name ?? ''); const type = assetTypeOf(x.type, name); const mo = Number(x.monthly); return { ...x, id: String(x.id || uid()), name, type, value: Number(x.value) || 0, liquid: ASSET_TYPES[type].liquid, monthly: mo > 0 ? mo : undefined, expenseId: typeof x.expenseId === 'string' ? x.expenseId : undefined, forRetirement: !!x.forRetirement }; }),
    goals: arr<Goal>(d.goals).filter(o => o && typeof o === 'object').map(g => ({ ...g, id: String(g.id || uid()), name: String(g.name ?? ''), type: g.type in GOAL_TYPES ? g.type : 'outro', target: Number(g.target) || 0, saved: Number(g.saved) || 0, date: typeof g.date === 'string' ? g.date : ym(12), priority: g.priority || 'media' as Goal['priority'], retire: migrateRetire(g.retire) })), reserve: Number(d.reserve) || 0,
    month: typeof d.month === 'string' && /^\d{4}-\d{2}$/.test(d.month) ? d.month : thisMonth(),
    actuals: d.actuals && typeof d.actuals === 'object' ? d.actuals : {},
    history: arr<Snapshot>(d.history).filter(h => h && typeof h.month === 'string'),
    dismissedAlerts: arr<string>(d.dismissedAlerts),
    settings: { ...DEFAULT_SETTINGS, ...(d.settings && typeof d.settings === 'object' ? d.settings : {}), alertTime: /^\d{2}:\d{2}$/.test(String(d.settings?.alertTime)) ? String(d.settings!.alertTime) : DEFAULT_SETTINGS.alertTime,
      firstSeenAt: isoOk(d.settings?.firstSeenAt) ? d.settings!.firstSeenAt : new Date().toISOString(), lastBackupAt: isoOk(d.settings?.lastBackupAt) ? d.settings!.lastBackupAt : undefined,
      terms: d.settings?.terms && typeof d.settings.terms.version === 'string' && isoOk(d.settings.terms.acceptedAt) ? { version: d.settings.terms.version, acceptedAt: d.settings.terms.acceptedAt } : undefined,
      recvMode: d.settings?.recvMode === 'garantido' ? 'garantido' : 'ponderado' },
  };
}
/** Rendimento antigo "0,5% a.m." era só o padrão da tela → passa ao novo padrão conservador. Valores ajustados pelo usuário são mantidos. */
function migrateRetire(r: Retire | undefined): Retire | undefined {
  if (!r || typeof r !== 'object') return undefined;
  const rate = Number(r.rate); const base = { ...r, monthlyIncome: Number(r.monthlyIncome) || 0, age: Number(r.age) || 0, retireAge: Number(r.retireAge) || 0 };
  if (typeof r.rateSet === 'boolean') return { ...base, rate: r.rateSet && rate > 0 ? rate : DEFAULT_REAL_AM };
  return !(rate > 0) || Math.abs(rate - 0.5) < 1e-9 ? { ...base, rate: DEFAULT_REAL_AM, rateSet: false } : { ...base, rate, rateSet: true };
}
const ym = (monthsAhead: number) => { const t = new Date(); t.setMonth(t.getMonth() + monthsAhead); return t.toISOString().slice(0, 7); };
export const exampleData = (): Data => { const prevE = uid(), segE = uid(); return {
  isExample: true, month: thisMonth(), actuals: {}, history: [], dismissedAlerts: [], settings: { ...DEFAULT_SETTINGS },
  reserve: 800,
  incomes: [{ id: uid(), name: 'Salário', amount: 4200 }, { id: uid(), name: 'Freelas (variável)', amount: varStats([1500, 1300, 1800, 1200, 1600, 1250]).base, variable: true, history: [1500, 1300, 1800, 1200, 1600, 1250] }],
  receivables: exampleReceivables(4200),
  expenses: [
    { id: uid(), name: 'Aluguel', amount: 1500, category: 'moradia', kind: 'fixa' },
    { id: uid(), name: 'Luz/água/internet', amount: 350, category: 'moradia', kind: 'fixa' },
    { id: uid(), name: 'Mercado', amount: 900, category: 'alimentacao', kind: 'variavel' },
    { id: uid(), name: 'Delivery', amount: 450, category: 'alimentacao', kind: 'variavel' },
    { id: uid(), name: 'Combustível/app', amount: 400, category: 'transporte', kind: 'variavel' },
    { id: uid(), name: 'Streaming e apps', amount: 120, category: 'assinaturas', kind: 'fixa' },
    { id: uid(), name: 'Saídas', amount: 600, category: 'lazer', kind: 'variavel' },
    { id: uid(), name: 'Roupas/compras online', amount: 500, category: 'compras', kind: 'variavel' },
    { id: prevE, name: 'Previdência', amount: 150, category: 'protecao', kind: 'fixa', dueDay: 15 },
    { id: segE, name: 'Seguro de vida', amount: 90, category: 'protecao', kind: 'fixa', dueDay: 5 },
  ],
  debts: [
    { id: uid(), name: 'Cartão Banco X', type: 'cartao_rotativo', balance: 3500, rate: 15, minPayment: 350, rateMode: 'media' },
    { id: uid(), name: 'Cheque especial', type: 'cheque_especial', balance: 1200, rate: 7.5, minPayment: 150, rateMode: 'media' },
    { id: uid(), name: 'Empréstimo pessoal', type: 'emprestimo_pessoal', balance: 6000, rate: 4.5, minPayment: 420 },
  ],
  assets: [
    { id: uid(), name: 'Carro (Gol 2015)', type: 'veiculo', value: 32000, liquid: false },
    { id: uid(), name: 'Poupança', type: 'conta', value: 1500, liquid: true },
    { id: uid(), name: 'Moto parada na garagem', type: 'veiculo', value: 6000, liquid: false },
    { id: uid(), name: 'Previdência VGBL (banco)', type: 'previdencia', value: 8500, liquid: false, monthly: 150, expenseId: prevE, forRetirement: true },
    { id: uid(), name: 'Seguro de vida com resgate', type: 'seguro_vida', value: 2400, liquid: false, monthly: 90, expenseId: segE },
  ],
  goals: [
    { id: uid(), name: 'Viagem para o Nordeste', type: 'viagem', target: 6000, date: ym(12), saved: 300, priority: 'media' },
    { id: uid(), name: 'Notebook novo', type: 'compra', target: 4000, date: ym(6), saved: 0, priority: 'baixa' },
    { id: uid(), name: 'Aposentadoria', type: 'aposentadoria', target: 0, date: '', saved: 0, priority: 'alta', retire: { monthlyIncome: 4000, age: 32, retireAge: 65, rate: DEFAULT_REAL_AM, rateSet: false } },
  ],
}; };

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
  const assets = d.assets || [];
  const totalAssets = assets.reduce((s, a) => s + (Number(a.value) || 0), 0);
  const liquidAssets = assets.filter(isLiquid).reduce((s, a) => s + (Number(a.value) || 0), 0);
  const netWorth = totalAssets + d.reserve - d.debts.reduce((s, x) => s + x.balance, 0);
  const effReserve = d.reserve + liquidAssets; // o que está disponível rápido conta como reserva
  const reserveMonths = essentials + minPayments > 0 ? effReserve / (essentials + minPayments) : 0;
  const expensive = d.debts.filter(x => x.type === 'cartao_rotativo' || x.type === 'cheque_especial' || x.rate >= 5);
  const monthlyInterest = d.debts.reduce((s, x) => s + x.balance * x.rate / 100, 0);

  // Score 0-100
  let score = 100;
  if (balance < 0) score -= 35; else if (balance < income * 0.05) score -= 15;
  score -= Math.min(25, Math.max(0, (dti - 0.1) * 100));
  score -= Math.min(20, expensive.length * 10);
  if (reserveMonths < 1) score -= 15; else if (reserveMonths < 3) score -= 8; else if (reserveMonths < 6) score -= 3;
  if (income && totalDebt / income > 6) score -= 10;
  if (netWorth < 0) score -= 5;
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
      : { tone: balance < income * 0.1 ? 'warn' : 'good', title: `Sobram ${brl(balance)} por mês`, text: `Gastos e parcelas levam ${pct(commitment)} do que você ganha. O ideal é sobrar pelo menos 10% a 20% para quitar dívidas e guardar.` });
    f.push(dti > 0.3
      ? { tone: 'bad', title: `Parcelas de dívidas levam ${pct(dti)} da sua renda`, text: 'Acima de 30% fica pesado demais e o risco de não conseguir pagar cresce. Renegociar é prioridade.' }
      : dti > 0.15 ? { tone: 'warn', title: `Parcelas de dívidas levam ${pct(dti)} da sua renda`, text: 'Ainda dá, mas acima de 15% já pesa. Evite fazer novas dívidas.' }
      : { tone: 'good', title: `Parcelas de dívidas levam ${pct(dti)} da sua renda`, text: 'Suas dívidas estão sob controle.' });
  }
  if (monthlyInterest > 0) f.push({ tone: monthlyInterest > income * 0.05 ? 'bad' : 'warn', title: `Você paga cerca de ${brl(monthlyInterest)} de juros por mês`, text: 'Esse dinheiro não abate nada da dívida — é o "custo" de dever. Quanto antes quitar as dívidas caras, mais sobra.' });
  expensive.forEach(x => f.push({ tone: 'bad', title: `Dívida cara: ${x.name} (${fmtAm(x.rate)})`, text: `Juros de ${fmtAm(x.rate)} equivalem a cerca de ${fmtAa(x.rate)}${x.rateMode === 'media' ? ' (estimativa pela taxa média do mercado)' : ''}. ${x.type === 'cartao_rotativo' ? 'O rotativo do cartão é a dívida mais cara do Brasil.' : x.type === 'cheque_especial' ? 'Cheque especial nunca deve ser usado como renda extra.' : ''} Troque por uma dívida mais barata ou quite primeiro.` }));
  if (totalAssets > 0) f.push(netWorth < 0
    ? { tone: 'bad', title: `Quanto você tem de verdade: ${brl(netWorth)}`, text: 'Você deve mais do que tem (bens − dívidas dá negativo). A prioridade é reduzir as dívidas antes de comprar novos bens.' }
    : { tone: 'good', title: `Quanto você tem de verdade: ${brl(netWorth)}`, text: `É o que sobraria se você vendesse tudo e quitasse as dívidas (bens − dívidas). Desse total, ${brl(liquidAssets + d.reserve)} está disponível rápido.` });
  f.push(reserveMonths < 1
    ? { tone: 'bad', title: `Reserva cobre ${reserveMonths.toFixed(1)} mês`, text: (liquidAssets ? `Considerando reserva + o que está disponível rápido (${brl(effReserve)}). ` : '') + 'Sem reserva, qualquer imprevisto vira dívida cara. Meta inicial: 1 mês de custos essenciais.' }
    : reserveMonths < 6 ? { tone: 'warn', title: `Reserva cobre ${reserveMonths.toFixed(1)} meses`, text: (liquidAssets ? `Considerando reserva + o que está disponível rápido (${brl(effReserve)}). ` : '') + 'Bom começo. A meta é de 3 a 6 meses de custos essenciais.' }
    : { tone: 'good', title: `Reserva cobre ${reserveMonths.toFixed(1)} meses`, text: 'Reserva de emergência completa.' });

  return { reserve: d.reserve, effReserve, totalAssets, liquidAssets, netWorth, income, expenses, minPayments, totalDebt, outflow, balance, commitment, dti, essentials, wants, reserveMonths, expensive, monthlyInterest, score, level, levelText: levelText[level], findings: f };
}

export type Strategy = 'avalanche' | 'snowball';
/** Nomes simples das estratégias (os nomes técnicos ficam só no código). */
export const STRATEGY: Record<Strategy, { name: string; how: string }> = {
  avalanche: { name: 'Economizar mais juros', how: 'paga primeiro a de juros mais altos' },
  snowball: { name: 'Quitar primeiro as menores', how: 'paga primeiro a de menor valor' },
};
/** O app recomenda: economizar juros quando a diferença importa (> R$ 50 ou > 2%); senão, quitar as menores (motivação). */
export function recommendStrategy(av: { interest: number; feasible: boolean }, sb: { interest: number; feasible: boolean }): Strategy {
  if (av.feasible !== sb.feasible) return av.feasible ? 'avalanche' : 'snowball';
  const diff = sb.interest - av.interest;
  return diff > Math.max(50, av.interest * 0.02) ? 'avalanche' : 'snowball';
}
export function order(debts: Debt[], s: Strategy) {
  return [...debts].sort((a, b) => s === 'avalanche' ? b.rate - a.rate : a.balance - b.balance);
}

/** extra[m]: dinheiro a mais no mês m (ex.: PLR, 13º) usado para abater dívidas na ordem da estratégia. */
export function simulate(debts: Debt[], s: Strategy, budget: number, extra?: Record<number, number>) {
  let ds = order(debts, s).map(x => ({ ...x }));
  const payoff: Record<string, number> = {};
  const timeline: { mes: number; saldo: number }[] = [{ mes: 0, saldo: ds.reduce((a, x) => a + x.balance, 0) }];
  let interest = 0, m = 0;
  const minSum = ds.reduce((a, x) => a + x.minPayment, 0);
  if (budget < minSum) budget = minSum;
  while (ds.some(x => x.balance > 0.01) && m < 120) {
    m++;
    ds.forEach(x => { if (x.balance > 0) { const i = x.balance * x.rate / 100; interest += i; x.balance += i; } });
    let avail = budget + (extra?.[m] ?? 0);
    ds.forEach(x => { if (x.balance > 0) { const p = Math.min(x.minPayment, x.balance); x.balance -= p; avail -= p; } });
    for (const x of ds) { if (avail <= 0) break; if (x.balance > 0) { const p = Math.min(avail, x.balance); x.balance -= p; avail -= p; } }
    ds.forEach(x => { if (x.balance <= 0.01 && !payoff[x.id]) payoff[x.id] = m; });
    timeline.push({ mes: m, saldo: Math.max(0, ds.reduce((a, x) => a + Math.max(0, x.balance), 0)) });
  }
  return { months: m, interest, payoff, timeline, feasible: !ds.some(x => x.balance > 0.01) };
}

export type Step = { title: string; text: string; items?: string[]; id?: string };
export function actionPlan(d: Data) {
  const r = diagnose(d);
  const steps: Step[] = [];
  const income = r.income;
  // 50/30/20 adapted: in crisis, 50 needs / 20 wants / 30 debts+reserve
  const crisis = r.level === 'crítico' || r.level === 'atenção' || r.expensive.length > 0;
  const guide = crisis ? { n: 0.5, w: 0.2, s: 0.3, label: 'modo recuperação' } : { n: 0.5, w: 0.3, s: 0.2, label: 'divisão saudável' };
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
    title: crisis ? 'Ajuste o orçamento (modo recuperação)' : 'Ajuste o orçamento',
    text: `Uma divisão que funciona: até ${pct(guide.n)} da renda (${brl(targetNeeds)}) para o essencial, ${pct(guide.w)} (${brl(targetWants)}) para o que não é essencial e ${pct(guide.s)} (${brl(income * guide.s)}) para quitar dívidas e guardar. Estes cortes liberam cerca de ${brl(savings)}/mês:`,
    items: cuts.map(c => `${c.name}: de ${brl(c.current)} para ${brl(c.suggested)}`),
  });
  if (r.expensive.length) steps.push({
    title: 'Renegocie as dívidas mais caras', text: 'Troque dívida cara por dívida barata. Ligue para o banco ou use o Desenrola/Serasa Limpa Nome/Registrato.',
    items: [
      ...order(r.expensive, 'avalanche').map(x => `${x.name}: ${fmtAm(x.rate)} — peça parcelamento com juros menores ou desconto à vista.`),
      'Considere trocar o cartão/cheque especial por um empréstimo mais barato — consignado (descontado do salário) ou com garantia, com juros de 1,5% a 3% ao mês — só se parar de usar o cartão e o cheque especial.',
      'Nunca aceite uma parcela que não caiba no orçamento ajustado.',
    ]});
  const surplus = Math.max(0, r.balance + savings);
  const reserveTarget1 = r.essentials + r.minPayments;
  if (r.expensive.length && r.totalAssets > 0) {
    const expDebt = r.expensive.reduce((s, x) => s + x.balance, 0);
    const spareLiquid = Math.max(0, r.liquidAssets + r.reserve - Math.min(1000, reserveTarget1 * 0.5));
    const idle = (d.assets || []).filter(a => !isLiquid(a) && a.type !== 'imovel' && a.type !== 'invest_longo');
    const items: string[] = [];
    if (spareLiquid > 0) items.push(`Você tem ${brl(spareLiquid)} disponível rápido (conta, poupança, investimento de resgate rápido) além de uma mini-reserva. Usar parte disso para quitar ${order(r.expensive, 'avalanche')[0].name} (${fmtAm(order(r.expensive, 'avalanche')[0].rate)}) costuma render mais do que qualquer investimento.`);
    if (idle.length) items.push(`Bens que talvez estejam parados: ${idle.map(a => `${a.name} (~${brl(a.value)})`).join(', ')}. Vender algum deles ou trocar por um mais barato quitaria parte das dívidas caras (${brl(expDebt)}).`);
    items.push('Isso é uma opção, não uma obrigação: avalie se o bem é essencial (ex.: carro para trabalhar) antes de decidir.');
    if (spareLiquid > 0 || idle.length) steps.push({ title: 'Opção: use patrimônio para matar dívidas caras', text: 'Juros de dívida cara são maiores que o rendimento de quase qualquer bem ou aplicação.', items });
  }
  if (r.effReserve < reserveTarget1 * 0.5 && d.debts.length) steps.push({
    title: 'Monte uma mini-reserva', text: `Separe ${brl(Math.min(1000, reserveTarget1 * 0.5))} para imprevistos antes de acelerar as dívidas — assim um pneu furado não vira dívida no cartão. Guarde onde dá para sacar no mesmo dia e que renda mais que a poupança (ex.: conta remunerada ou CDB com resgate diário).` });
  // receitas futuras: cada valor vai para dívida cara → reserva → objetivos (frases com o valor cheio; projeção com o valor do modo)
  const recv = recvPlan(d, r);
  if (recv.lumpsFull.length) steps.push({ id: 'recv', title: 'Use as receitas futuras com estratégia',
    text: `Nos próximos 12 meses você espera receber ${brl(Math.round(recv.fc.expected))}, dos quais ${brl(Math.round(recv.fc.guaranteed))} são certos. ${recv.mode === 'garantido' ? `O plano conta só com o dinheiro certo (${brl(Math.round(recv.fc.guaranteed))}).` : `Como nem tudo é certo, o plano conta com ${brl(Math.round(recv.fc.weighted))}: todo o dinheiro certo e só uma parte do que é provável ou incerto.`} Ordem sugerida para cada valor: dívida cara → reserva de emergência (1º mês de custos) → objetivos.`,
    items: [
      ...recv.lumpsFull.filter(l => l.occ.recv.recurrence !== 'monthly').slice(0, 6).map(l => lumpSentence(l)),
      ...(recv.lumpsFull.some(l => l.occ.recv.recurrence === 'monthly') ? ['Recebimentos mensais (comissões, repasses, aluguel) entram como reforço mês a mês, na mesma ordem.'] : []),
      '⚠️ Nunca gaste dinheiro incerto antes de ele cair na conta: não assuma parcelas nem compras contando com um valor provável ou incerto.',
    ] });
  let payoff = null as null | { budget: number; av: ReturnType<typeof simulate>; sb: ReturnType<typeof simulate>; extraTotal: number; rec: Strategy };
  if (d.debts.length) {
    const budget = r.minPayments + surplus * 0.8;
    const av = simulate(d.debts, 'avalanche', budget, recv.debtExtra), sb = simulate(d.debts, 'snowball', budget, recv.debtExtra);
    const rec = recommendStrategy(av, sb);
    payoff = { budget, av, sb, extraTotal: recv.debtExtraTotal, rec };
    const extra = budget - r.minPayments;
    const line = (s: Strategy, x: ReturnType<typeof simulate>) => `${order(d.debts, s).map(y => y.name).join(' → ')}. ${x.feasible ? `Termina em ${x.months} ${x.months === 1 ? 'mês' : 'meses'}, com ${brl(x.interest)} de juros` : 'Com o orçamento atual não termina'}`;
    const other: Strategy = rec === 'avalanche' ? 'snowball' : 'avalanche'; const R = rec === 'avalanche' ? av : sb, O = rec === 'avalanche' ? sb : av;
    const diff = O.interest - R.interest;
    steps.push({
      title: 'Quite as dívidas em ordem', text: `${extra >= 1 ? `Pague as parcelas de todas em dia e coloque ${brl(extra)} a mais por mês em uma dívida por vez (total para dívidas: ${brl(budget)}/mês)` : `Pague as parcelas de todas em dia (${brl(budget)}/mês). Quando sobrar dinheiro, coloque o extra em uma dívida por vez`}${recv.debtExtraTotal > 0 ? `, mais ${brl(Math.round(recv.debtExtraTotal))} de receitas futuras nos meses previstos (${recv.mode === 'garantido' ? 'só o dinheiro certo' : 'contando só parte do que não é certo'})` : ''}. O app escolheu a ordem por você:`,
      items: [
        `✅ Recomendado — ${STRATEGY[rec].name} (${STRATEGY[rec].how}): ${line(rec, R)}.${rec === 'snowball' && diff >= -1 ? ' Os juros ficam praticamente iguais, e você vê dívidas sumindo mais cedo — isso ajuda a manter o ritmo.' : ''}`,
        `Outra opção — ${STRATEGY[other].name} (${STRATEGY[other].how}): ${line(other, O)}${diff > 1 ? ` (${brl(diff)} a mais de juros)` : ''}.`,
        ...(!av.feasible ? ['⚠️ Com o orçamento atual a dívida NÃO diminui em 10 anos (os juros superam os pagamentos). Renegociar (etapa anterior) e aumentar a renda são obrigatórios.'] : []),
      ]});
  }
  if (r.reserveMonths < 6) steps.push({
    title: 'Construa a reserva de emergência', text: `Meta: 6 meses de custos essenciais = ${brl(reserveTarget1 * 6)}. Hoje: ${brl(r.effReserve)}${r.liquidAssets ? ' (reserva + disponível rápido)' : ''}. ${surplus > 0 ? `Após quitar as dívidas, guardando ${brl(surplus + r.minPayments)}/mês você chega lá em ~${Math.ceil(Math.max(0, reserveTarget1 * 6 - r.effReserve) / (surplus + r.minPayments))} meses.` : 'Primeiro crie folga no orçamento.'}` });
  steps.push({ title: 'Próximo nível', text: 'Com dívidas quitadas e reserva pronta: invista para objetivos (Tesouro Direto, CDBs), revise o orçamento a cada 3 meses e busque aumentar a renda.' });
  // Orçamento livre para objetivos: com dívidas, 80% da sobra vai para elas
  const freeForGoals = d.debts.length ? surplus * 0.2 : surplus;
  return { steps, cuts, savings, guide, payoff, surplus, freeForGoals, recv };
}

/** Receitas futuras no plano: frases (valor cheio) e projeção (valor ponderado ou só garantido). */
export function recvPlan(d: Data, r: ReturnType<typeof diagnose>, today = new Date()) {
  const mode: RecvMode = d.settings?.recvMode === 'garantido' ? 'garantido' : 'ponderado';
  const base = r.essentials + r.minPayments;
  const ctx = { expensiveIds: new Set(r.expensive.map(x => x.id)), reserveGap1: base - r.effReserve, reserveGap6: base * 6 - r.effReserve };
  const recvs = d.receivables || [];
  const lumpsFull: Lump[] = recvs.length ? planLumps(d, ctx, o => o.net, today) : [];
  const lumpsMode: Lump[] = recvs.length ? planLumps(d, ctx, o => modeValue(o, mode), today) : [];
  const debtExtra: Record<number, number> = {}; let debtExtraTotal = 0;
  const goalLump: Record<string, number> = {};
  for (const l of lumpsMode) for (const p of l.parts) {
    if (p.kind === 'debt') { debtExtra[l.month + 1] = (debtExtra[l.month + 1] || 0) + p.amount; debtExtraTotal += p.amount; }
    if (p.kind === 'goal') goalLump[p.id] = (goalLump[p.id] || 0) + p.amount;
  }
  return { mode, lumpsFull, lumpsMode, debtExtra, debtExtraTotal, goalLump, fc: forecast(d, today) };
}

/** Renda variável: base conservadora = média dos meses mais fracos (1/3 menores). */
export function varStats(values: number[]) {
  const v = values.map(Number).filter(x => x > 0); const n = v.length;
  if (n < 3) return { n, ok: false, avg: 0, min: 0, max: 0, base: 0, cv: 0, k: 0, label: '' };
  const sorted = [...v].sort((a, b) => a - b); const k = Math.ceil(n / 3);
  const avg = v.reduce((s, x) => s + x, 0) / n; const base = Math.round(sorted.slice(0, k).reduce((s, x) => s + x, 0) / k);
  const sd = Math.sqrt(v.reduce((s, x) => s + (x - avg) ** 2, 0) / n); const cv = avg ? sd / avg : 0;
  return { n, ok: true, avg, min: sorted[0], max: sorted[n - 1], base, cv, k, label: cv < 0.15 ? 'baixa' : cv < 0.35 ? 'média' : 'alta' };
}

// ---------- Objetivos ----------
export function monthsUntil(date: string) {
  if (!date) return 0;
  const [y, m] = date.split('-').map(Number); const t = new Date();
  return Math.max(1, (y - t.getFullYear()) * 12 + (m - 1 - t.getMonth()));
}
export function retirementCalc(r: Retire, saved: number) {
  const i = (r.rate || 0.5) / 100;
  const n = Math.max(1, (r.retireAge - r.age) * 12);
  const capital = r.monthlyIncome / i; // viver de renda (perpetuidade real)
  const fv = saved * Math.pow(1 + i, n);
  const monthly = Math.max(0, (capital - fv) * i / (Math.pow(1 + i, n) - 1));
  return { capital, monthly, months: n };
}
export type GoalResult = { goal: Goal; target: number; months: number; need: number; allocated: number; allocatedAfter: number; fits: boolean; progress: number; lump: number;
  prev?: { saved: number; monthly: number; outOfBudget: number };
  alt?: { extendTo: string; extendMonths: number; reduceTo: number; cut: number } };
const PR: Record<Priority, number> = { alta: 0, media: 1, baixa: 2 };
/** Previdências marcadas para a aposentadoria: saldo + aportes que estão no orçamento (gasto ligado). */
export function previdenciaForGoal(d: Data) {
  const ps = (d.assets || []).filter(a => a.type === 'previdencia' && a.forRetirement);
  const inBudget = (a: Asset) => !!a.expenseId && d.expenses.some(e => e.id === a.expenseId);
  return { saved: ps.reduce((t, a) => t + (a.value || 0), 0),
    monthly: ps.filter(inBudget).reduce((t, a) => t + (d.expenses.find(e => e.id === a.expenseId)?.amount || 0), 0),
    outOfBudget: ps.filter(a => !inBudget(a)).reduce((t, a) => t + (a.monthly || 0), 0) };
}
export function evaluateGoals(d: Data) {
  const plan = actionPlan(d); const r = diagnose(d); const goalLump = plan.recv.goalLump;
  const best = plan.payoff ? (plan.payoff.rec === 'snowball' ? plan.payoff.sb : plan.payoff.av) : null;
  const payoffMonths = best ? (best.feasible ? best.months : null) : 0;
  // depois de quitar as dívidas, o dinheiro das parcelas fica livre
  const freeAfter = d.debts.length ? plan.surplus + r.minPayments : plan.freeForGoals;
  let avail = plan.freeForGoals, availAfter = freeAfter;
  const results: GoalResult[] = [];
  const sorted = [...(d.goals || [])].sort((a, b) => PR[a.priority] - PR[b.priority]);
  const pv = previdenciaForGoal(d); const retireGoalId = sorted.find(g => g.type === 'aposentadoria' && g.retire)?.id;
  for (const g of sorted) {
    const usePrev = g.id === retireGoalId && (pv.saved > 0 || pv.monthly > 0 || pv.outOfBudget > 0);
    let target = g.target, months = monthsUntil(g.date), need: number;
    if (g.type === 'aposentadoria' && g.retire) {
      // previdência ligada: o saldo entra como já guardado e os aportes (que já estão nos gastos) reduzem o que falta por mês
      const rc = retirementCalc(g.retire, g.saved + (usePrev ? pv.saved : 0)); target = rc.capital; months = rc.months; need = Math.max(0, rc.monthly - (usePrev ? pv.monthly : 0));
    } else need = Math.max(0, target - g.saved - (goalLump[g.id] || 0)) / Math.max(1, months);
    const allocated = Math.min(need, Math.max(0, avail)); avail -= allocated;
    const allocatedAfter = Math.min(Math.max(need, allocated), Math.max(0, availAfter)); availAfter -= allocatedAfter;
    const fits = need <= allocated + 0.5;
    const progress = target ? Math.min(1, (g.saved + (usePrev ? pv.saved : 0)) / target) : 0;
    let alt: GoalResult['alt'];
    if (!fits) {
      const remaining = Math.max(0, target - g.saved - (usePrev ? pv.saved : 0) - (goalLump[g.id] || 0));
      // meses até completar: "allocated" durante as dívidas, "allocatedAfter" depois
      let extendMonths = 0;
      if (payoffMonths !== null) {
        const during = allocated * payoffMonths;
        if (during >= remaining) extendMonths = allocated > 0 ? Math.ceil(remaining / allocated) : 0;
        else if (allocatedAfter > 1) extendMonths = payoffMonths + Math.ceil((remaining - during) / allocatedAfter);
      }
      if (extendMonths > 600) extendMonths = 0;
      alt = { extendMonths, extendTo: extendMonths ? ym(extendMonths) : '', reduceTo: g.type === 'aposentadoria' && g.retire ? Math.max(0, allocated / need * g.retire.monthlyIncome) : g.saved + allocated * months, cut: need - allocated };
    }
    results.push({ goal: g, target, months, need, allocated, allocatedAfter, fits, progress, alt, lump: goalLump[g.id] || 0, ...(usePrev ? { prev: pv } : {}) });
  }
  return { results, free: plan.freeForGoals, freeAfter, payoffMonths, hasExpensive: r.expensive.length > 0, hasDebts: d.debts.length > 0, surplus: plan.surplus };
}
