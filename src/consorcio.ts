/** Comparação simples: juntar e comprar à vista × financiamento × consórcio (sem indicar empresa ou produto). */
export type BuyKind = 'imovel' | 'veiculo';
export type BuyParams = { rate: number; finTerm: number; adm: number; fr: number; consTerm: number; ret: number };
export const buyKind = (name: string, price: number): BuyKind => /casa|apart|apto|im[oó]vel|terreno|lote|ch[aá]cara/i.test(name) || price >= 150_000 ? 'imovel' : 'veiculo';
export const BUY_DEFAULTS: Record<BuyKind, BuyParams> = {
  veiculo: { rate: 1.9, finTerm: 48, adm: 15, fr: 2, consTerm: 60, ret: 0.5 },
  imovel: { rate: 0.95, finTerm: 240, adm: 18, fr: 2, consTerm: 180, ret: 0.5 },
};
const pmt = (pv: number, i: number, k: number) => i === 0 ? pv / k : pv * i / (1 - Math.pow(1 + i, -k));
export type BuyCompare = { price: number; fin: { monthly: number; total: number; extra: number; months: number }; cons: { monthly: number; total: number; extra: number; months: number; avgWait: number }; save: { monthly: number; months: number | null; earned: number } };
export function compareBuy(price: number, p: BuyParams): BuyCompare {
  const fm = pmt(price, p.rate / 100, p.finTerm), ft = fm * p.finTerm;
  const ct = price * (1 + (p.adm + p.fr) / 100), cm = ct / p.consTerm;
  // juntar o mesmo valor da parcela do consórcio, com rendimento seguro
  let bal = 0, m = 0; const r = p.ret / 100; while (bal < price && m < 600) { bal = bal * (1 + r) + cm; m++; }
  const months = bal >= price ? m : null;
  return { price, fin: { monthly: fm, total: ft, extra: ft - price, months: p.finTerm }, cons: { monthly: cm, total: ct, extra: ct - price, months: p.consTerm, avgWait: Math.round(p.consTerm / 2) },
    save: { monthly: cm, months, earned: months ? Math.max(0, bal - cm * months) : 0 } };
}
