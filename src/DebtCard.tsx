import { useState } from 'react';
import { motion } from 'framer-motion';
import { Debt, DebtType, DEBT_TYPES, DEBT_INFO, RateUnit, RateMode, AVG_RATES, AUTO_PAY, autoPay, amToAa, aaToAm, fmtRateBoth, fmtAm, fmtAa, parseRate, solveRate, lastInstallmentYm, thisMonth } from './finance';
import { MoneyInput, DayInput } from './ui';
import { MONTHS_FULL } from './recv';

const shown = (n: number) => (Math.round(n * 10000) / 10000).toLocaleString('pt-BR', { maximumFractionDigits: 4 });

/** Taxa: texto livre com vírgula ou ponto ("0,79", "0,0125", "12,5"); guarda sempre AO MÊS. */
export function RateInput({ rate, unit, onChange, label }: { rate: number; unit: RateUnit; onChange: (am: number) => void; label: string }) {
  const [txt, setTxt] = useState<string | null>(null);
  const val = unit === 'aa' ? amToAa(rate) : rate;
  const display = txt ?? (rate || rate === 0 ? shown(val) : '');
  return <span className="rate-in"><input type="text" inputMode="decimal" autoComplete="off" step="any" aria-label={label} title={label} placeholder="ex.: 0,79" value={display}
    onFocus={e => { const raw = rate ? shown(val) : ''; setTxt(raw); const el = e.currentTarget; setTimeout(() => { if (el.value === raw && document.activeElement === el) el.select(); }, 0); }}
    onChange={e => {
      const t = e.target.value.replace(/[^\d.,]/g, '');
      if (!/^\d*([.,]\d{0,6})?$/.test(t)) return; // só bloqueia o que não é número; "0," e "0,0" passam
      setTxt(t); const v = parseRate(t); onChange(v === undefined ? 0 : unit === 'aa' ? aaToAm(v) : v);
    }}
    onBlur={() => setTxt(null)} /><span className="rate-suf" aria-hidden="true">%</span></span>;
}

function Seg<T extends string>({ value, options, onChange, id, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; id: string; label: string }) {
  return <div className="seg seg-xs" role="radiogroup" aria-label={label}>{options.map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={value === k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>
    {value === k && <motion.span layoutId={`seg-${id}`} className="segpill" />}<span>{l}</span></button>)}</div>;
}

export function DebtCard({ d, set, remove }: { d: Debt; set: (p: Partial<Debt>) => void; remove: () => void }) {
  const info = DEBT_INFO[d.type] ?? DEBT_INFO.outro;
  const avg = AVG_RATES[d.type];
  const mode: RateMode = info.parcelado ? (d.rateMode === 'calc' ? 'calc' : 'sei') : (avg && d.rateMode === 'media' ? 'media' : 'sei');
  const unit: RateUnit = d.rateUnit ?? info.unit;
  const solved = mode === 'calc' ? solveRate(d.balance, d.minPayment, d.installments ?? 0) : null;
  // no modo "não sei", a taxa guardada acompanha o cálculo
  // no modo "taxa média", a taxa guardada é a média do tipo; no cartão/cheque sem pagamento informado, o app estima o pagamento mensal
  const upd = (p: Partial<Debt>) => {
    const nx = { ...d, ...p }; const ti = DEBT_INFO[nx.type] ?? DEBT_INFO.outro; const av = AVG_RATES[nx.type];
    const m = ti.parcelado ? (nx.rateMode === 'calc' ? 'calc' : 'sei') : (av && nx.rateMode === 'media' ? 'media' : 'sei');
    if (m === 'calc') { const r = solveRate(nx.balance, nx.minPayment, nx.installments ?? 0); if (r.ok) p = { ...p, rate: r.rate }; }
    if (m === 'media' && av) p = { ...p, rate: av.rate };
    if (AUTO_PAY[nx.type] && (nx.payAuto || !(nx.minPayment > 0)) && !('minPayment' in p && !p.payAuto)) p = { ...p, minPayment: autoPay(nx.type, nx.balance), payAuto: true };
    set(p);
  };
  const end = d.installments ? lastInstallmentYm(d.installments, thisMonth()) : null;
  const endTxt = end ? `${MONTHS_FULL[Number(end.slice(5, 7)) - 1]} de ${end.slice(0, 4)}` : '';
  return <div className="debt">
    <div className="row"><input className="row-name" aria-label="Nome da dívida" placeholder="Nome da dívida" value={d.name} onChange={e => set({ name: e.target.value })} />
      <button className="x" aria-label={`Remover ${d.name || 'dívida'}`} onClick={remove}>✕</button></div>
    <div className="fgrid debt-grid">
      <label className="f-type">Tipo<select value={d.type} onChange={e => { const t = e.target.value as DebtType; const ti = DEBT_INFO[t]; upd({ type: t, rateUnit: ti.unit, ...(ti.parcelado ? (d.rateMode === 'media' ? { rateMode: 'calc' as const } : {}) : { rateMode: AVG_RATES[t] && (d.rateMode !== 'sei' || !d.rate) ? 'media' as const : 'sei' as const }) }); }}>
        {Object.entries(DEBT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="f-money">Quanto falta pagar<MoneyInput label="Quanto falta pagar hoje (saldo da dívida)" value={d.balance} onChange={n => upd({ balance: n ?? 0 })} /></label>
      <label className="f-money">{info.parcelado ? 'Valor da parcela' : 'Quanto paga por mês'}<MoneyInput label={info.parcelado ? 'Valor da parcela' : d.type === 'cartao_rotativo' ? 'Quanto você costuma pagar da fatura por mês' : 'Quanto você paga por mês'} value={d.minPayment}
        onChange={n => upd(!n ? (AUTO_PAY[d.type] ? { payAuto: true } : { minPayment: 0 }) : { minPayment: n, payAuto: false })} /></label>
      {info.parcelado && <label className="f-n">Parcelas que faltam<input type="text" inputMode="numeric" autoComplete="off" placeholder={mode === 'calc' ? 'ex.: 24' : 'opcional'} aria-label="Quantas parcelas faltam"
        value={d.installments ?? ''} onChange={e => { const t = e.target.value.replace(/\D/g, '').slice(0, 3); upd({ installments: t ? Math.max(1, Number(t)) : undefined }); }} /></label>}
      <label className="f-day">Vence dia<DayInput prefix={false} label="Dia de vencimento da dívida (opcional)" value={d.dueDay} onChange={v => { const n = Math.round(Number(v)); set({ dueDay: n >= 1 && n <= 31 ? n : undefined }); }} /></label>
    </div>
    {!info.parcelado && <small className="fhint pay-hint">{d.type === 'cartao_rotativo' ? 'Quanto você costuma pagar da fatura por mês.' : 'Quanto você consegue devolver por mês.'}{d.payAuto && d.minPayment > 0 ? ` Não informou? Usamos ${Math.round((AUTO_PAY[d.type] ?? 0) * 100)}% do que falta pagar (${d.minPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}) — ${d.type === 'cartao_rotativo' ? 'o mínimo comum da fatura' : 'uma estimativa'}.` : ''}</small>}
    <div className="rate-box">
      <div className="rate-top"><b>Juros</b>
        {info.parcelado && <Seg id={`mode-${d.id}`} label="Você sabe a taxa de juros?" value={mode} onChange={m => upd({ rateMode: m })} options={[['calc', 'Não sei a taxa'], ['sei', 'Sei a taxa']]} />}
        {!info.parcelado && avg && <Seg id={`mode-${d.id}`} label="Você sabe a taxa de juros?" value={mode} onChange={m => upd({ rateMode: m })} options={[['media', 'Usar taxa média'], ['sei', 'Sei a taxa']]} />}</div>
      {mode === 'media' && avg ? <>
        <p className="rate-calc ok">Usando <b>{fmtAm(avg.rate)}</b> (≈ {fmtAa(avg.rate)})<small>É uma estimativa: {avg.ref}. Se souber a sua taxa, toque em “Sei a taxa”.</small></p>
      </> : mode === 'sei' ? <>
        <div className="rate-row"><RateInput label={`Taxa de juros ${unit === 'aa' ? 'ao ano' : 'ao mês'}`} rate={d.rate} unit={unit} onChange={am => set({ rate: am })} />
          <Seg id={`unit-${d.id}`} label="Unidade da taxa" value={unit} onChange={u => set({ rateUnit: u })} options={[['am', '% ao mês'], ['aa', '% ao ano']]} /></div>
        <p className="rate-eq">{d.rate === 0 ? 'Sem juros (0%)' : fmtRateBoth(d.rate, unit)}</p>
        <small className="fhint">{info.hint}{avg ? ` A média do mercado é ${fmtAm(avg.rate)}.` : ''}</small>
      </> : <>
        {solved?.ok ? <p className="rate-calc ok">Taxa calculada: <b>{solved.zero ? 'sem juros (0%)' : fmtRateBoth(solved.rate, unit)}</b>
          <small>Calculada a partir de {d.installments} parcelas de {d.minPayment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} para um saldo de {d.balance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.</small></p>
          : <p className="rate-calc warn" role="status">{solved?.ok === false ? solved.msg : ''}</p>}
        <small className="fhint">Informe o que você sabe — saldo, parcela e quantas faltam — e o app calcula os juros.</small>
      </>}
    </div>
    {end && <p className="debt-end">Última parcela em <b>{endTxt}</b> ({d.installments === 1 ? 'falta 1 parcela' : `faltam ${d.installments} parcelas`}).</p>}
  </div>;
}
