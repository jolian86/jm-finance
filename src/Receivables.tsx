import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Portal } from './overlay';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { Data, Income, DISCLAIMER, brl, varStats } from './finance';
import { ymShort, ymAdd } from './history';
import { CH, AX, AXY, TT, legendFmt } from './chartTheme';
import {
  Receivable, RecvInstallment, RecvType, Certainty, Recurrence, Occ, CERT, RECV_TYPES, REC_LABEL, STATUS_LABEL, PRESETS, MONTHS_SHORT,
  occurrences, forecast, precision, newReceivable, certFromProb, fmtOccDate, isoDay, netOf, modeValue,
} from './recv';

const Disc = () => <p className="jm-disc">{DISCLAIMER}</p>;
const brl0 = (n: number) => brl(Math.round(n));
const num = (v: string) => Number(String(v).replace(',', '.')) || 0;
const GROUPS = [...new Set(Object.values(RECV_TYPES).map(t => t.group))];
const CertDot = ({ c }: { c: Certainty }) => <span className="cdot" style={{ background: CERT[c].color }} />;

// ================= Lista de receitas futuras =================
export function ReceivablesCard({ data, upd }: { data: Data; upd: (p: Partial<Data>) => void }) {
  const [form, setForm] = useState<null | { draft: Receivable; isNew: boolean; note?: string }>(null);
  const mark = (receivables: Receivable[]) => upd({ receivables, isExample: false });
  const openPreset = (k: string) => { const p = PRESETS.find(x => x.key === k)!; const dr = p.build(data); setForm({ draft: newReceivable(dr), isNew: true, note: dr.note }); };
  const openBlank = () => { const t = new Date(); t.setMonth(t.getMonth() + 1);
    setForm({ draft: newReceivable({ name: '', type: 'outro', certainty: 'provavel', prob: 70, discountPct: 0, recurrence: 'once', installments: [{ id: Math.random().toString(36).slice(2, 10), date: `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`, gross: 0 }] }), isNew: true }); };
  const save = (r: Receivable) => { mark(form?.isNew ? [...data.receivables, r] : data.receivables.map(x => x.id === r.id ? r : x)); setForm(null); };
  const remove = (id: string) => { if (confirm('Excluir esta receita futura e o histórico dela?')) { mark(data.receivables.filter(x => x.id !== id)); setForm(null); } };
  return <>
    <div className="card" id="receitas">
      <h3>Receitas futuras</h3>
      <p className="hint">Dinheiro que deve entrar além da renda do mês: 13º, PLR, férias, honorários, notas, repasses, safra, restituição… Não repita aqui o que já está em “Rendas mensais”.</p>
      <div className="presets" role="group" aria-label="Atalhos">
        {PRESETS.map(p => <button key={p.key} className="chip" onClick={() => openPreset(p.key)}>+ {p.label}</button>)}
        <button className="chip ghost" onClick={openBlank}>+ Outro tipo</button>
      </div>
      {data.receivables.length === 0 ? <p className="empty-recv">Nenhuma receita futura ainda. Toque num atalho acima — por exemplo, <b>13º salário</b> sugere as duas parcelas a partir do seu salário.</p>
        : <div className="recv-list">{data.receivables.map(r => <RecvItem key={r.id} r={r} onEdit={() => setForm({ draft: structuredClone(r), isNew: false })}
          onChange={nr => mark(data.receivables.map(x => x.id === nr.id ? nr : x))} />)}</div>}
      <Disc />
    </div>
    <AnimatePresence>{form && <RecvForm key="f" initial={form.draft} isNew={form.isNew} note={form.note} onCancel={() => setForm(null)} onSave={save} onDelete={() => remove(form.draft.id)} />}</AnimatePresence>
  </>;
}

function RecvItem({ r, onEdit, onChange }: { r: Receivable; onEdit: () => void; onChange: (r: Receivable) => void }) {
  const [all, setAll] = useState(false);
  const [recv, setRecv] = useState<null | { key: string; amount: string; date: string }>(null);
  const occ = useMemo(() => occurrences(r), [r]);
  const late = occ.filter(o => o.status === 'atrasado'), next = occ.filter(o => o.status === 'previsto'), done = occ.filter(o => o.record);
  const shown = all ? occ : [...late, ...next.slice(0, Math.max(1, 3 - late.length))];
  const total12 = next.concat(late).reduce((s, o) => s + o.net, 0);
  const setRecord = (key: string, rec?: Receivable['records'][string]) => { const records = { ...r.records }; if (rec) records[key] = rec; else delete records[key]; onChange({ ...r, records }); };
  const T = RECV_TYPES[r.type];
  return <div className="recv">
    <div className="recv-head">
      <div className="recv-title"><b>{r.name}</b><small>{T.label} · {REC_LABEL[r.recurrence]}{r.discountPct ? ` · desconto ~${r.discountPct}%` : ''}</small></div>
      <span className={`cert ${r.certainty}`}><CertDot c={r.certainty} />{CERT[r.certainty].label}{r.certainty !== 'garantido' ? ` ${r.prob}%` : ''}</span>
      <button className="icon-btn" onClick={onEdit} aria-label={`Editar ${r.name}`}>✎</button>
    </div>
    {total12 > 0 && <small className="recv-sum">Em aberto (12 meses): <b>{brl0(total12)}</b> líquido · ponderado {brl0(total12 * r.prob / 100)}</small>}
    <div className="occ-list">{shown.map(o => <div key={o.key} className={`occ ${o.status}`}>
      <div className="occ-main"><span className="occ-date">{fmtOccDate(o.ym, o.day)}{o.inst.label ? <small> · {o.inst.label}</small> : null}</span>
        <span className="occ-val">{o.record?.status === 'recebido' ? brl0(o.record.amount ?? o.net) : brl0(o.net)}</span>
        <span className={`st ${o.status}`}>{STATUS_LABEL[o.status]}</span></div>
      {o.record?.status === 'recebido' && <small className="occ-note">Previsto {brl0(o.net)} · recebido em {o.record.date ? new Date(o.record.date + 'T12:00:00').toLocaleDateString('pt-BR') : '—'} <button className="link" onClick={() => setRecord(o.key)}>desfazer</button></small>}
      {o.record?.status === 'cancelado' && <small className="occ-note">Não vai entrar. <button className="link" onClick={() => setRecord(o.key)}>desfazer</button></small>}
      {!o.record && recv?.key !== o.key && <div className="occ-actions">
        <button className="btn sm" onClick={() => setRecv({ key: o.key, amount: String(Math.round(o.net * 100) / 100), date: isoDay(new Date()) })}>Marcar como recebido</button>
        <button className="link" onClick={() => setRecord(o.key, { status: 'cancelado' })}>Não vai entrar</button></div>}
      {recv?.key === o.key && <div className="occ-form">
        <label>Valor recebido<input type="number" inputMode="decimal" value={recv.amount} onChange={e => setRecv({ ...recv, amount: e.target.value })} /></label>
        <label>Data<input type="date" value={recv.date} onChange={e => setRecv({ ...recv, date: e.target.value })} /></label>
        <div className="occ-form-btns"><button className="btn sm" onClick={() => { setRecord(o.key, { status: 'recebido', amount: num(recv.amount), date: recv.date }); setRecv(null); }}>Confirmar</button>
          <button className="link" onClick={() => setRecv(null)}>cancelar</button></div></div>}
    </div>)}</div>
    {occ.length > shown.length && <button className="link more" onClick={() => setAll(true)}>Ver todas ({occ.length}{done.length ? `, ${done.length} com registro` : ''})</button>}
    {all && occ.length > 3 && <button className="link more" onClick={() => setAll(false)}>Mostrar menos</button>}
  </div>;
}

// ================= Formulário (folha) =================
type Row = { id: string; label: string; y: number; m: number; day: string; gross: string; net: string; origYm?: string };
const toRows = (r: Receivable): Row[] => r.installments.map(i => { const [y, m, d] = i.date.split('-').map(Number); return { id: i.id, label: i.label ?? '', y, m, day: d ? String(d) : '', gross: i.gross ? String(i.gross) : '', net: i.net !== undefined ? String(i.net) : '', origYm: i.date.slice(0, 7) }; });
const nextYearFor = (m: number) => { const t = new Date(); return m < t.getMonth() + 1 ? t.getFullYear() + 1 : t.getFullYear(); };

function RecvForm({ initial, isNew, note, onCancel, onSave, onDelete }: { initial: Receivable; isNew: boolean; note?: string; onCancel: () => void; onSave: (r: Receivable) => void; onDelete: () => void }) {
  const [r, setR] = useState<Receivable>(initial);
  const [rows, setRows] = useState<Row[]>(() => toRows(initial));
  const [until, setUntil] = useState(initial.until ?? '');
  const [err, setErr] = useState('');
  const T = RECV_TYPES[r.type]; const yearNow = new Date().getFullYear();
  const years = Array.from({ length: 8 }, (_, i) => yearNow - 1 + i);
  const setRow = (id: string, p: Partial<Row>) => setRows(rs => rs.map(x => x.id === id ? { ...x, ...p } : x));
  const setType = (type: RecvType) => { const t = RECV_TYPES[type]; setR(x => ({ ...x, type, ...(isNew ? { certainty: t.cert, prob: CERT[t.cert].prob, discountPct: t.discount } : {}) })); };
  const setCert = (c: Certainty) => setR(x => ({ ...x, certainty: c, prob: CERT[c].prob }));
  const addRow = () => { const last = rows[rows.length - 1]; const m = last ? (last.m % 12) + 1 : new Date().getMonth() + 1; setRows([...rows, { id: Math.random().toString(36).slice(2, 10), label: `${rows.length + 1}ª parcela`, y: last ? (last.m === 12 ? last.y + 1 : last.y) : yearNow, m, day: '', gross: last?.gross ?? '', net: '' }]); };
  const netRow = (x: Row) => num(x.gross) > 0 ? (x.net.trim() !== '' ? num(x.net) : num(x.gross) * (1 - r.discountPct / 100)) : 0;
  const firstVal = useRef<HTMLInputElement>(null);
  // valor vazio (ex.: sem salário cadastrado) → já foca o campo de valor
  useEffect(() => { if (!rows.some(x => num(x.gross) > 0)) setTimeout(() => firstVal.current?.focus({ preventScroll: false }), 350); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const sample = rows[0] ? (rows[0].net ? num(rows[0].net) : num(rows[0].gross) * (1 - r.discountPct / 100)) : 0;
  const submit = () => {
    if (!r.name.trim()) return setErr('Dê um nome (ex.: “PLR”, “Honorários — cliente X”).');
    if (!rows.some(x => num(x.gross) > 0)) { firstVal.current?.focus(); return setErr('Informe o valor bruto (campo “Valor bruto”) de pelo menos uma parcela.'); }
    const insts: RecvInstallment[] = rows.filter(x => num(x.gross) > 0).map(x => {
      const mm = String(x.m).padStart(2, '0'); let y = x.y;
      if (r.recurrence === 'yearly' && (!x.origYm || Number(x.origYm.slice(5, 7)) !== x.m)) y = nextYearFor(x.m);
      const day = Math.round(num(x.day)); const date = day >= 1 && day <= 31 ? `${y}-${mm}-${String(day).padStart(2, '0')}` : `${y}-${mm}`;
      return { id: x.id, label: x.label.trim() || undefined, date, gross: num(x.gross), net: x.net.trim() === '' ? undefined : num(x.net) };
    });
    const single = r.recurrence === 'once' || r.recurrence === 'monthly';
    onSave({ ...r, name: r.name.trim(), prob: r.certainty === 'garantido' ? 100 : r.prob, installments: single ? insts.slice(0, 1) : insts, until: r.recurrence === 'monthly' && until ? until : undefined });
  };
  const shownRows = r.recurrence === 'once' || r.recurrence === 'monthly' ? rows.slice(0, 1) : rows;
  return <Portal><motion.div className="sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
    <motion.div className="sheet recv-form" role="dialog" aria-label="Receita futura" initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: 0.25 }} onClick={e => e.stopPropagation()}>
      <div className="sheet-head"><h3 style={{ margin: 0 }}>{isNew ? 'Nova receita futura' : 'Editar receita futura'}</h3><button className="chat-back" onClick={onCancel} aria-label="Fechar">✕</button></div>
      {note && <p className="form-note">{note}</p>}
      <label>Nome<input value={r.name} placeholder="Ex.: PLR, Honorários — cliente X" onChange={e => setR({ ...r, name: e.target.value })} /></label>
      <label>Tipo<select value={r.type} onChange={e => setType(e.target.value as RecvType)}>
        {GROUPS.map(g => <optgroup key={g} label={g}>{(Object.keys(RECV_TYPES) as RecvType[]).filter(k => RECV_TYPES[k].group === g).map(k => <option key={k} value={k}>{RECV_TYPES[k].label}</option>)}</optgroup>)}</select></label>
      <div className="lbl">Certeza de receber</div>
      <div className="cert-pick">{(Object.keys(CERT) as Certainty[]).map(c => <button key={c} className={r.certainty === c ? 'on' : ''} onClick={() => setCert(c)}><CertDot c={c} />{CERT[c].label}<small>{c === 'garantido' ? '100%' : `${CERT[c].prob}% padrão`}</small></button>)}</div>
      {r.certainty !== 'garantido' && <label>Chance de receber (%)<input type="number" inputMode="numeric" min={1} max={99} value={r.prob} onChange={e => setR({ ...r, prob: Math.max(1, Math.min(99, Math.round(num(e.target.value)))) })} /></label>}
      <label>Desconto estimado (%) <small className="opt">— vale para as parcelas sem líquido</small><input type="number" inputMode="decimal" min={0} max={100} value={r.discountPct || ''} placeholder="0" onChange={e => setR({ ...r, discountPct: Math.max(0, Math.min(100, num(e.target.value))) })} />
        <small className="fhint">{T.hint || 'IR, INSS, impostos, glosas, taxas…'} Se souber o valor líquido exato, preencha “líquido” na parcela.</small></label>
      <label>Recorrência<select value={r.recurrence} onChange={e => setR({ ...r, recurrence: e.target.value as Recurrence })}>
        <option value="once">Uma vez</option><option value="monthly">Todo mês</option><option value="yearly">Todo ano (ex.: 13º, férias, PLR)</option><option value="custom">Parcelas com datas diferentes</option></select></label>
      <div className="lbl">{r.recurrence === 'monthly' ? 'A partir de' : r.recurrence === 'yearly' ? 'Parcelas de cada ano' : r.recurrence === 'custom' ? 'Parcelas' : 'Quando'}</div>
      {shownRows.map((x, i) => { const g = num(x.gross); const est = x.net.trim() !== '' ? num(x.net) : g * (1 - r.discountPct / 100);
        const multi = r.recurrence !== 'once' && r.recurrence !== 'monthly';
        return <div key={x.id} className={`inst-row ${err && !(g > 0) ? 'need' : ''}`}>
        <div className="inst-head">{multi ? <input className="inst-label" aria-label={`Descrição da parcela ${i + 1}`} value={x.label} placeholder={`${i + 1}ª parcela`} onChange={e => setRow(x.id, { label: e.target.value })} />
          : <b className="inst-title">{r.recurrence === 'monthly' ? 'Valor de cada mês' : 'Valor e data'}</b>}
          {shownRows.length > 1 && <button className="x" aria-label={`Remover parcela ${i + 1}`} onClick={() => setRows(rows.filter(y => y.id !== x.id))}>✕</button>}</div>
        <div className="inst-vals">
          <label className="mini val">Valor bruto (R$)<input ref={i === 0 ? firstVal : undefined} aria-label={multi ? `Valor bruto da ${x.label || `${i + 1}ª parcela`}` : 'Valor bruto'} data-val="bruto" type="number" inputMode="decimal" min={0} placeholder="Digite o valor" value={x.gross} onChange={e => setRow(x.id, { gross: e.target.value })} /></label>
          <label className="mini">Líquido (opcional)<input aria-label={multi ? `Valor líquido da ${x.label || `${i + 1}ª parcela`} (opcional)` : 'Valor líquido (opcional)'} data-val="liquido" type="number" inputMode="decimal" min={0} placeholder={g > 0 ? String(Math.round(est)) : 'auto'} value={x.net} onChange={e => setRow(x.id, { net: e.target.value })} /></label>
        </div>
        {g > 0 && <small className="inst-est">{x.net.trim() !== '' ? <>Líquido informado: <b>{brl0(est)}</b></> : <>≈ <b>{brl0(est)}</b> líquido{r.discountPct ? ` (desconto estimado de ${r.discountPct}%)` : ''}</>}</small>}
        <div className="inst-grid">
          <label className="mini">Mês<select aria-label={multi ? `Mês da ${x.label || `${i + 1}ª parcela`}` : 'Mês'} value={x.m} onChange={e => setRow(x.id, { m: Number(e.target.value) })}>{MONTHS_SHORT.map((mm, k) => <option key={k} value={k + 1}>{mm}</option>)}</select></label>
          {r.recurrence !== 'yearly' ? <label className="mini">Ano<select aria-label="Ano" value={x.y} onChange={e => setRow(x.id, { y: Number(e.target.value) })}>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></label> : <span className="mini yearly">todo ano</span>}
          <label className="mini">Dia (opcional)<input aria-label="Dia (opcional)" type="number" inputMode="numeric" min={1} max={31} placeholder="—" value={x.day} onChange={e => setRow(x.id, { day: e.target.value })} /></label>
        </div></div>; })}
      {(r.recurrence === 'custom' || r.recurrence === 'yearly') && <button className="btn ghost sm" onClick={addRow}>+ Parcela</button>}
      {r.recurrence === 'monthly' && <label>Até (opcional)<input type="month" value={until} onChange={e => setUntil(e.target.value)} /></label>}
      <p className="fhint">Dia em branco = em algum dia do mês (consideramos o fim do mês para atrasos).</p>
      {sample > 0 && <div className="form-preview">{shownRows.length > 1 ? <>Líquido estimado: {shownRows.filter(x => num(x.gross) > 0).map((x, i) => <span key={x.id}>{i ? ' · ' : ''}{MONTHS_SHORT[x.m - 1]} <b>{brl0(netRow(x))}</b></span>)}
        {' '}= <b>{brl0(shownRows.reduce((t, x) => t + netRow(x), 0))}</b>{r.recurrence === 'yearly' ? ' por ano' : ''}</> : <>Líquido estimado: <b>{brl0(sample)}</b>{r.recurrence === 'monthly' ? ' por mês' : ''}</>}
        {r.certainty !== 'garantido' && <> · no plano (ponderado pela chance de {r.prob}%): <b>{brl0((shownRows.length > 1 ? shownRows.reduce((t, x) => t + netRow(x), 0) : sample) * r.prob / 100)}</b></>}</div>}
      <Disc />
      {err && <p className="backup-msg err" role="alert">{err}</p>}
      <div className="modal-actions sticky-actions">{!isNew && <button className="link danger-link" onClick={onDelete}>Excluir</button>}<span style={{ flex: 1 }} /><button className="btn ghost" onClick={onCancel}>Cancelar</button><button className="btn" onClick={submit}>Salvar</button></div>
    </motion.div>
  </motion.div></Portal>;
}

// ================= Previsão de recebimentos + precisão =================
export function ForecastCard({ data, upd }: { data: Data; upd: (p: Partial<Data>) => void }) {
  const fc = useMemo(() => forecast(data), [data]);
  const pr = useMemo(() => precision(data), [data]);
  const mode = data.settings.recvMode === 'garantido' ? 'garantido' : 'ponderado';
  if (!data.receivables.length) return null;
  const inPlan = mode === 'garantido' ? fc.guaranteed : fc.weighted;
  const apply = (type: RecvType, p: number) => upd({ isExample: false, receivables: data.receivables.map(r => r.type === type ? { ...r, prob: p, certainty: certFromProb(p) } : r) });
  return <div className="card" id="previsao">
    <h3>Previsão de recebimentos</h3>
    <ModeToggle mode={mode} onChange={m => upd({ settings: { ...data.settings, recvMode: m } })} />
    <div className="grid3 fc-tot">
      <div className="stat"><small>Previsto · 12 meses</small><b>{brl0(fc.expected)}</b></div>
      <div className="stat"><small>Ponderado</small><b>{brl0(fc.weighted)}</b></div>
      <div className="stat"><small>Garantido</small><b>{brl0(fc.guaranteed)}</b></div>
    </div>
    <p className="hint">“Ponderado” = valor × chance de receber. O plano usa <b>{brl0(inPlan)}</b> ({mode === 'garantido' ? 'só o garantido' : 'ponderado'}) nos meses previstos.</p>
    <ResponsiveContainer width="100%" height={240}><ComposedChart data={fc.buckets} margin={{ top: 8, right: 4 }}>
      <CartesianGrid vertical={false} stroke="rgba(247,183,49,.08)" /><XAxis dataKey="label" {...AX} interval={1} /><YAxis width={56} {...AXY} />
      <Tooltip {...TT} formatter={v => brl0(Number(v))} cursor={{ fill: 'rgba(247,183,49,.06)' }} /><Legend formatter={legendFmt} wrapperStyle={{ paddingTop: 6 }} />
      <Bar dataKey="garantido" name="Garantido" stackId="a" fill={CERT.garantido.color} animationDuration={900} />
      <Bar dataKey="provavel" name="Provável" stackId="a" fill={CERT.provavel.color} animationDuration={900} />
      <Bar dataKey="incerto" name="Incerto" stackId="a" fill={CERT.incerto.color} radius={[5, 5, 0, 0]} animationDuration={900} />
      <Line dataKey="ponderado" name="Ponderado" stroke={CH.champagne} strokeDasharray="5 4" strokeWidth={2} dot={{ r: 2.5 }} animationDuration={1100} />
    </ComposedChart></ResponsiveContainer>
    {fc.overdue > 0 && <div className="finding warn"><b>{fc.overdue} recebimento{fc.overdue > 1 ? 's' : ''} atrasado{fc.overdue > 1 ? 's' : ''} ({brl0(fc.overdueValue)})</b><p>Contam no mês atual até você marcar como recebido, ajustar a data ou cancelar.</p></div>}
    <div className="precision">
      <h4>Precisão das suas previsões</h4>
      {pr.n ? <>
        <div className="prec-top"><div className={`prec-score ${pr.level}`}><b>{pr.score}</b><small>/100</small></div>
          <div><span className={`prec-level ${pr.level}`}>Precisão {pr.level}</span>
            <p>Valor recebido: <b>{Math.round(pr.valueRatio * 100)}%</b> do previsto · atraso médio: <b>{pr.avgDelay <= 3 ? 'em dia' : `${pr.avgDelay} dias`}</b> · {pr.n} registro{pr.n > 1 ? 's' : ''}</p></div></div>
        {pr.list.map(t => <div key={t.type} className="prec-type"><p>{t.text}</p>
          {t.n < 3 && <small className="fhint">Com {t.n} registro{t.n > 1 ? 's' : ''} ainda é pouco histórico — trate como pista, não como regra.</small>}
          {t.suggestedProb !== undefined && <div className="prec-sug">Sugestão: usar <b>{t.suggestedProb}%</b> de chance para {t.label} (hoje: {t.currentProb}%). <button className="btn sm ghost" onClick={() => apply(t.type, t.suggestedProb!)}>Aplicar {t.suggestedProb}%</button></div>}
          {t.avgDelay > 15 && <div className="prec-sug">Como costumam atrasar ~{t.avgDelay} dias, considere prever as próximas datas de {t.label} cerca de {(Math.round(t.avgDelay / 30) || 1) > 1 ? `${Math.round(t.avgDelay / 30)} meses` : '1 mês'} depois.</div>}
        </div>)}
      </> : <p className="hint">Ainda sem histórico. Quando um valor cair, toque em <b>Marcar como recebido</b> (com o valor e a data reais): o app compara com o previsto e sugere ajustes nas chances.</p>}
    </div>
    <div className="finding bad"><b>Nunca gaste dinheiro incerto antes de ele cair na conta.</b><p>Provável não é garantido. Não assuma parcelas nem compras contando com PLR, êxito, venda ou safra que ainda não entraram.</p></div>
    <Disc />
  </div>;
}

export function ModeToggle({ mode, onChange }: { mode: 'ponderado' | 'garantido'; onChange: (m: 'ponderado' | 'garantido') => void }) {
  return <div className="seg seg-sm" role="tablist" aria-label="Valor usado no plano">{([['ponderado', 'Ponderado pela chance'], ['garantido', 'Só garantido']] as const).map(([k, l]) =>
    <button key={k} role="tab" aria-selected={mode === k} className={mode === k ? 'on' : ''} onClick={() => onChange(k)}>
      {mode === k && <motion.span layoutId="recvmode" className="segpill" />}<span>{l}</span></button>)}</div>;
}

// ================= Renda variável =================
export function VarIncome({ income, month, onChange }: { income: Income; month: string; onChange: (i: Income) => void }) {
  const h = income.history ?? [];
  const st = varStats(h);
  const set = (hist: number[]) => { const s = varStats(hist); onChange({ ...income, history: hist, amount: s.ok ? s.base : income.amount }); };
  const n = h.length; const max = Math.max(1, ...h);
  return <div className="var-box">
    <div className="var-head"><b>Últimos {n} meses</b><small>do mais antigo ao mais recente</small></div>
    <div className="var-grid">{h.map((v, i) => <label key={i}><span>{ymShort(ymAdd(month, i - n))}</span>
      <input type="number" inputMode="decimal" value={v || ''} placeholder="R$" onChange={e => { const nh = [...h]; nh[i] = num(e.target.value); set(nh); }} /></label>)}</div>
    <div className="var-btns">{n < 12 && <button className="btn ghost sm" onClick={() => set([0, ...h])}>+ mês anterior</button>}{n > 3 && <button className="link" onClick={() => set(h.slice(1))}>remover o mais antigo</button>}</div>
    {st.ok ? <>
      <div className="var-bars" aria-hidden>{h.map((v, i) => <div key={i} className="vb"><div className={v <= st.base ? 'low' : ''} style={{ height: `${Math.max(4, v / max * 100)}%` }} /></div>)}
        <div className="var-base" style={{ bottom: `${st.base / max * 100}%` }}><span>base {brl0(st.base)}</span></div></div>
      <div className="var-stats"><span>Média <b>{brl0(st.avg)}</b></span><span>Mínimo <b>{brl0(st.min)}</b></span><span>Máximo <b>{brl0(st.max)}</b></span><span>Variação <b className={`var-${st.label}`}>{st.label} (±{Math.round(st.cv * 100)}%)</b></span></div>
      <p className="var-explain">Para renda variável, planejamos com a <b>média dos meses mais fracos</b>: {brl0(st.base)}/mês (média dos {st.k} menores de {st.n}). Assim o orçamento não depende dos meses bons — quando vier mais, a diferença vai para dívidas, reserva ou objetivos.</p>
    </> : <p className="hint">Preencha pelo menos 3 meses para calcular a base conservadora.</p>}
  </div>;
}
export type { Occ };
export { modeValue, netOf };
