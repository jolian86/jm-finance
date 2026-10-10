// Leitura da fatura do cartão por foto/PDF (via /api/fatura). Nada fica guardado no servidor.
import { AI_ENDPOINT_URL } from './ai/prompt';
import { deviceId } from './ai/remote';
import type { SplitKey, CardSplit, BillInfo } from './finance';

export const FATURA_URL = AI_ENDPOINT_URL ? AI_ENDPOINT_URL.replace(/chat\/?$/, 'fatura') : '';
export const MAX_BYTES = 10 * 1024 * 1024;
export type BillCat = SplitKey | 'outros';
export type Purchase = { date?: string; description: string; amount: number; installment?: string; category: BillCat };
export type Bill = { cardName?: string; dueDate?: string; total?: number; charges?: number; fees?: number; purchases: Purchase[] };
export const BILL_CATS: { k: BillCat; label: string }[] = [
  { k: 'mercado', label: 'Mercado' }, { k: 'delivery', label: 'Delivery e lanches' }, { k: 'compras', label: 'Compras e roupas' }, { k: 'assinaturas', label: 'Assinaturas e apps' },
  { k: 'combustivel', label: 'Combustível e transporte' }, { k: 'saude', label: 'Farmácia e saúde' }, { k: 'lazer', label: 'Saídas e lazer' }, { k: 'contas', label: 'Contas da casa' }, { k: 'outros', label: 'Outros' }];

/** fotos: reduz para no máx. 1600 px e JPEG ~0,72 (menos dados, mesma leitura); PDF vai como está */
async function prep(f: File): Promise<{ mime: string; data: string; size: number }> {
  const b64 = (buf: ArrayBuffer) => { let s = ''; const u = new Uint8Array(buf); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
  if (f.type === 'application/pdf') { const buf = await f.arrayBuffer(); return { mime: f.type, data: b64(buf), size: buf.byteLength }; }
  try {
    const bmp = await createImageBitmap(f); const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob = await new Promise((ok, no) => c.toBlob(b => b ? ok(b) : no(new Error('x')), 'image/jpeg', 0.72));
    const buf = await blob.arrayBuffer(); return { mime: 'image/jpeg', data: b64(buf), size: buf.byteLength };
  } catch { const buf = await f.arrayBuffer(); return { mime: f.type || 'image/jpeg', data: b64(buf), size: buf.byteLength }; }
}

export class FaturaError extends Error { constructor(public code: string, msg: string) { super(msg); } }
const MSG: Record<string, string> = {
  too_large: 'Os arquivos ficaram grandes demais (máx. 10 MB). Tente menos páginas ou fotos menores.',
  daily_limit: 'Você já usou as 3 leituras de fatura de hoje. Amanhã tem mais! Enquanto isso, dá para separar por alto aqui embaixo.',
  not_bill: 'Não encontrei uma fatura de cartão nessa imagem. Tente uma foto mais nítida, de frente e com boa luz, ou envie o PDF do banco.',
  offline: 'Sem conexão agora. Tente de novo quando a internet voltar, ou separe por alto aqui embaixo.',
  generic: 'Não consegui ler a fatura desta vez. Tente de novo, com uma foto mais nítida ou o PDF, ou separe por alto aqui embaixo.',
};
export const faturaMsg = (code: string) => MSG[code] || MSG.generic;

export async function readBill(files: File[]): Promise<{ bill: Bill; remaining?: number }> {
  if (!FATURA_URL) throw new FaturaError('generic', MSG.generic);
  const ok = files.filter(f => /^image\//.test(f.type) || f.type === 'application/pdf' || /\.(pdf|jpe?g|png|heic|webp)$/i.test(f.name));
  if (!ok.length) throw new FaturaError('generic', 'Escolha fotos (JPG/PNG) ou o PDF da fatura.');
  const prepped = await Promise.all(ok.slice(0, 8).map(prep));
  if (prepped.reduce((s, p) => s + p.size, 0) > MAX_BYTES) throw new FaturaError('too_large', MSG.too_large);
  let r: Response;
  try { r = await fetch(FATURA_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deviceId: deviceId(), files: prepped.map(({ mime, data }) => ({ mime, data })) }) }); }
  catch { throw new FaturaError('offline', MSG.offline); }
  const j = await r.json().catch(() => ({})) as { bill?: Bill & { notABill?: boolean }; error?: string; remaining?: number };
  if (!r.ok || !j.bill) { const c = j.error || 'generic'; throw new FaturaError(c, faturaMsg(c)); }
  if (j.bill.notABill || !j.bill.purchases?.length) throw new FaturaError('not_bill', MSG.not_bill);
  const cats = BILL_CATS.map(c => c.k) as string[];
  const purchases = j.bill.purchases.map(p => ({ ...p, description: String(p.description || '').slice(0, 80), amount: Math.round((Number(p.amount) || 0) * 100) / 100, category: (cats.includes(p.category) ? p.category : 'outros') as BillCat })).filter(p => p.amount);
  return { bill: { ...j.bill, purchases }, remaining: j.remaining };
}

export const isParcela = (p: Purchase) => /^\s*\d{1,2}\s*\/\s*\d{1,2}\s*$/.test(p.installment || '');
/** fatura revisada → separação por categoria (parcelas vão para "Parcelas de compras") + notas para o Consultor */
export function billToSplit(b: Bill): { split: CardSplit; info: BillInfo; total: number; dueDay?: number } {
  const split: CardSplit = {};
  for (const p of b.purchases) { const k: SplitKey | null = isParcela(p) ? 'parcelas' : p.category === 'outros' ? null : p.category; if (k) split[k] = Math.round(((split[k] || 0) + p.amount) * 100) / 100; }
  Object.keys(split).forEach(k => { if ((split[k as SplitKey] || 0) <= 0) delete split[k as SplitKey]; });
  const sum = b.purchases.reduce((s, p) => s + p.amount, 0) + (b.charges || 0) + (b.fees || 0);
  const total = Math.round((b.total && b.total > 0 ? b.total : sum) * 100) / 100;
  const d = Number((b.dueDate || '').split('/')[0]);
  return { split, total, dueDay: d >= 1 && d <= 31 ? d : undefined, info: {
    at: new Date().toISOString().slice(0, 10), card: b.cardName?.slice(0, 40), charges: b.charges || 0,
    parcelas: b.purchases.filter(isParcela).map(p => ({ n: p.description, a: p.amount, i: p.installment!.replace(/\s/g, '') })).slice(0, 30),
    subs: b.purchases.filter(p => p.category === 'assinaturas').map(p => ({ n: p.description, a: p.amount })).slice(0, 30) } };
}
