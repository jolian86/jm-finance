import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Portal } from './overlay';
import { MoneyInput } from './ui';
import { brl, Expense } from './finance';
import { readBill, billToSplit, Bill, BillCat, BILL_CATS, isParcela, FATURA_URL, FaturaError, faturaMsg } from './fatura';

/** "Fotografar fatura (ou enviar PDF)": lê com IA, mostra para conferir e só então preenche a separação */
export function FaturaReader({ e, set }: { e: Expense; set: (p: Partial<Expense>) => void }) {
  const inp = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [err, setErr] = useState(''); const [bill, setBill] = useState<Bill | null>(null); const [done, setDone] = useState('');
  if (!FATURA_URL) return null;
  const pick = async (fl: FileList | null) => {
    if (!fl?.length) return; setErr(''); setDone(''); setBusy(true);
    try { const { bill } = await readBill([...fl]); setBill(bill); }
    catch (x) { if (!(x instanceof FaturaError)) console.warn('fatura', x); setErr(x instanceof FaturaError ? x.message : faturaMsg('generic')); }
    finally { setBusy(false); if (inp.current) inp.current.value = ''; }
  };
  const apply = () => {
    if (!bill) return; const r = billToSplit(bill);
    set({ amount: r.total, split: Object.keys(r.split).length ? r.split : undefined, bill: r.info, ...(r.dueDay ? { dueDay: r.dueDay } : {}) });
    setBill(null); setDone(`Pronto! Fatura de ${brl(r.total)} separada. Confira os valores aqui embaixo.`);
  };
  return <div className="fat-read">
    <button type="button" className="btn sm photo-bill" disabled={busy} onClick={() => inp.current?.click()}>{busy ? <><span className="spin" aria-hidden="true" /> Lendo a fatura…</> : '📷 Fotografar fatura (ou enviar PDF)'}</button>
    <input ref={inp} type="file" accept="image/*,application/pdf" multiple hidden onChange={ev => pick(ev.target.files)} aria-label="Fotos ou PDF da fatura" />
    <p className="fhint">Pode mandar várias fotos (uma por página) ou o PDF do banco. A imagem vai para a IA só para ler e não fica guardada.</p>
    {e.bill?.at && !done && <p className="fhint">Última leitura: {e.bill.at.split('-').reverse().join('/')}.</p>}
    {err && <p className="fat-err" role="alert">{err}</p>}
    {done && <p className="fat-ok" role="status">{done}</p>}
    {bill && <Review bill={bill} setBill={setBill} onCancel={() => setBill(null)} onApply={apply} />}
  </div>;
}

function Review({ bill, setBill, onCancel, onApply }: { bill: Bill; setBill: (b: Bill) => void; onCancel: () => void; onApply: () => void }) {
  const up = (i: number, p: Partial<Bill['purchases'][0]>) => setBill({ ...bill, purchases: bill.purchases.map((x, k) => k === i ? { ...x, ...p } : x) });
  const sum = bill.purchases.reduce((s, p) => s + p.amount, 0);
  const by = BILL_CATS.map(c => ({ ...c, v: bill.purchases.filter(p => !isParcela(p) && p.category === c.k).reduce((s, p) => s + p.amount, 0) })).filter(c => c.v);
  const parc = bill.purchases.filter(isParcela), subs = bill.purchases.filter(p => p.category === 'assinaturas');
  return <Portal><motion.div className="sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onCancel}>
    <motion.div className="sheet fat-sheet" role="dialog" aria-modal="true" aria-label="Confira a fatura" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={ev => ev.stopPropagation()}>
      <h3>Confira a fatura</h3>
      <p className="fhint">Li {bill.purchases.length} lançamentos{bill.cardName ? ` do ${bill.cardName}` : ''}{bill.dueDate ? `, vencimento ${bill.dueDate}` : ''}. Ajuste o que estiver errado antes de usar.</p>
      <label className="fat-total"><span>Total da fatura</span><MoneyInput label="Total da fatura" value={bill.total || 0} onChange={n => setBill({ ...bill, total: n ?? 0 })} /></label>
      {Math.abs((bill.total || 0) - sum - (bill.charges || 0) - (bill.fees || 0)) > 1 && bill.total ? <p className="fhint">Os lançamentos somam {brl(sum)}{bill.charges ? ` + ${brl(bill.charges)} de juros/encargos` : ''}{bill.fees ? ` + ${brl(bill.fees)} de anuidade` : ''}. O que não bater fica como “sem separar”.</p> : null}
      {bill.charges ? <p className="fat-warn">⚠️ Esta fatura tem {brl(bill.charges)} de juros/encargos — sinal de que algo ficou para trás (rotativo). Vale olhar com o Consultor.</p> : null}
      <div className="fat-cats">{by.map(c => <span key={c.k}>{c.label}: <b>{brl(c.v)}</b></span>)}{parc.length ? <span>Parcelas: <b>{brl(parc.reduce((s, p) => s + p.amount, 0))}</b></span> : null}</div>
      {(parc.length > 0 || subs.length > 0) && <p className="fhint">{parc.length ? `${parc.length} parcelamento${parc.length > 1 ? 's' : ''}` : ''}{parc.length && subs.length ? ' e ' : ''}{subs.length ? `${subs.length} assinatura${subs.length > 1 ? 's' : ''}` : ''} — o Consultor vai levar isso em conta.</p>}
      <ul className="fat-list">{bill.purchases.map((p, i) => <li key={i}>
        <div className="fat-l1"><span className="fat-desc">{p.date ? <small>{p.date} </small> : null}{p.description}{isParcela(p) && <em className="fat-tag">parcela {p.installment}</em>}</span>
          <button className="x" aria-label={`Tirar ${p.description}`} onClick={() => setBill({ ...bill, purchases: bill.purchases.filter((_, k) => k !== i) })}>✕</button></div>
        <div className="fat-l2"><select aria-label={`Categoria de ${p.description}`} value={p.category} onChange={ev => up(i, { category: ev.target.value as BillCat })}>{BILL_CATS.map(c => <option key={c.k} value={c.k}>{c.label}</option>)}</select>
          <MoneyInput label={`Valor de ${p.description}`} value={p.amount} onChange={n => up(i, { amount: n ?? 0 })} /></div></li>)}</ul>
      <div className="modal-actions"><button className="btn ghost" onClick={onCancel}>Cancelar</button><button className="btn" onClick={onApply}>Usar estes valores</button></div>
    </motion.div></motion.div></Portal>;
}
