import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { Data, DISCLAIMER, brl, uid } from './finance';
import { SIMS, SimId, simById, onDebtChange, Values, SimResult, Field } from './sim';
import { Adv } from './ui';
import { CH, AX, AXY, TT, legendFmt } from './chartTheme';

const Disc = () => <p className="jm-disc">{DISCLAIMER}</p>;
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ICONS: Record<SimId, JSX.Element> = {
  financiar: <svg viewBox="0 0 24 24" {...P}><path d="M3 13l2-5h14l2 5v5H3z" /><circle cx="7.5" cy="16" r="1.3" /><circle cx="16.5" cy="16" r="1.3" /></svg>,
  'quitar-investir': <svg viewBox="0 0 24 24" {...P}><path d="M12 4v16M5 8h14" /><path d="M5 8l-3 6h6zM19 8l-3 6h6z" /></svg>,
  antecipar: <svg viewBox="0 0 24 24" {...P}><path d="M4 6l7 6-7 6zM13 6l7 6-7 6z" /></svg>,
  consolidar: <svg viewBox="0 0 24 24" {...P}><path d="M4 6h5l3 6-3 6H4M20 12h-8" /></svg>,
  cortar: <svg viewBox="0 0 24 24" {...P}><circle cx="6" cy="7" r="2.5" /><circle cx="6" cy="17" r="2.5" /><path d="M8 8.5 20 18M8 15.5 20 6" /></svg>,
};
const COL = { gold: CH.gold, silver: CH.silver, bronze: CH.bronze, champagne: CH.champagne };

export default function Simulador({ data, upd, initial, onBack, goGoals }: { data: Data; upd: (p: Partial<Data>) => void; initial?: SimId; onBack: () => void; goGoals: () => void }) {
  const [sel, setSel] = useState<SimId | null>(initial ?? null);
  return <>
    <div className="sim-top"><button className="chat-back" onClick={sel ? () => setSel(null) : onBack} aria-label="Voltar">←</button>
      <div><small className="eyebrow">Plano</small><h2 style={{ margin: 0 }}>Simulador de decisões</h2></div></div>
    {!sel ? <>
      <p className="hint">Compare caminhos lado a lado usando seus números reais. Você vê custos, prazos, prós, contras e riscos — a escolha é sua.</p>
      <div className="sim-list">{SIMS.map((s, i) => <motion.button key={s.id} className="card sim-item" onClick={() => setSel(s.id)} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} whileTap={{ scale: 0.98 }}>
        <span className="sim-ico">{ICONS[s.id]}</span><span><b>{s.title}</b><small>{s.desc}</small></span><span className="sim-go">›</span></motion.button>)}</div>
      <Disc />
    </> : <Scenario key={sel} id={sel} data={data} upd={upd} goGoals={goGoals} />}
  </>;
}

function Scenario({ id, data, upd, goGoals }: { id: SimId; data: Data; upd: (p: Partial<Data>) => void; goGoals: () => void }) {
  const sim = simById(id);
  const [v, setV] = useState<Values>(() => sim.defaults(data));
  const [saved, setSaved] = useState(false);
  const res = useMemo(() => sim.run(data, v), [sim, data, v]);
  const set = (k: string, val: string) => setV(prev => k === 'debt' ? onDebtChange(id, data, { ...prev, debt: val }) : { ...prev, [k]: val });
  const fields = sim.fields(data);
  const renderField = (f: Field) => f.type === 'multi'
        ? <div key={f.key} className="sim-multi"><span className="lbl">{f.label}</span>{f.options!.map(o => { const on = (v[f.key] || '').split(',').includes(o.value);
            return <label key={o.value} className={`chk ${on ? 'on' : ''}`}><input type="checkbox" checked={on} onChange={() => { const s = new Set((v[f.key] || '').split(',').filter(Boolean)); if (on) s.delete(o.value); else s.add(o.value); set(f.key, [...s].join(',')); }} />{o.label}</label>; })}</div>
        : <label key={f.key}>{f.label}{f.suffix && <span className="suf"> ({f.suffix})</span>}
          {f.type === 'select' ? <select value={v[f.key]} onChange={e => set(f.key, e.target.value)}>{f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
            : <input type="text" inputMode="decimal" autoComplete="off" value={f.suffix?.startsWith('%') ? String(v[f.key] ?? '').replace(/^(\d+)\.(\d+)$/, '$1,$2') : v[f.key] ?? ''} onChange={e => { const t = e.target.value.replace(/[^\d.,]/g, ''); set(f.key, t); }} />}
          {f.hint && <small className="fhint">{f.hint}</small>}</label>;
  return <>
    <div className="card"><div className="sim-head"><span className="sim-ico">{ICONS[id]}</span><h3 style={{ margin: 0 }}>{sim.title}</h3></div>
      <div className="sim-form">{fields.filter(f => !f.advanced).map(renderField)}</div>
      {fields.some(f => f.advanced) && <Adv note="juros já preenchidos"><div className="sim-form">{fields.filter(f => f.advanced).map(renderField)}</div>
        <small className="fhint">Já vem preenchido com um valor comum. Só mude se souber o seu.</small></Adv>}
    </div>
    {'error' in res ? <div className="card"><div className="finding warn"><b>{res.error}</b></div></div> : <Result r={res} onSave={res.goal && !saved ? () => {
      const g = res.goal!; const t = new Date(); t.setMonth(t.getMonth() + g.months);
      upd({ isExample: false, goals: [...data.goals, { id: uid(), name: g.name, type: g.type, target: Math.round(g.target), date: t.toISOString().slice(0, 7), saved: Math.round(Number(v.down) || 0), priority: 'media' }] });
      setSaved(true);
    } : undefined} saved={saved} goGoals={goGoals} />}
  </>;
}

function Result({ r, onSave, saved, goGoals }: { r: SimResult; onSave?: () => void; saved: boolean; goGoals: () => void }) {
  const brlTT = { ...TT, formatter: (x: unknown) => brl(Number(x)) };
  const C = r.chart;
  return <>
    <motion.div className="card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h3>Lado a lado</h3>
      <div className="cmp" role="table">
        <div className="cmp-row head" role="row"><span /><b>{r.cols[0]}</b><b>{r.cols[1]}</b></div>
        {r.rows.map((x, i) => <div key={i} className="cmp-row" role="row"><span>{x.label}</span>
          <em className={x.better === 'a' ? 'best' : ''}>{x.a}</em><em className={x.better === 'b' ? 'best' : ''}>{x.b}</em></div>)}
      </div>
      <p className="hint" style={{ marginTop: 8 }}>Destaque dourado = melhor número naquela linha (não necessariamente a melhor escolha para você).</p>
      <Disc />
    </motion.div>
    <div className="card"><h3>Resumo</h3><p>{r.summary}</p><Disc /></div>
    <div className="card"><h3>{C.title}</h3>
      <ResponsiveContainer width="100%" height={230}>{C.kind === 'line'
        ? <LineChart data={C.data} margin={{ top: 8, right: 8 }}><CartesianGrid vertical={false} stroke="rgba(247,183,49,.08)" /><XAxis dataKey={C.xKey} {...AX} /><YAxis width={58} {...AXY} />
          <Tooltip {...brlTT} labelFormatter={l => C.xLabel ? `${C.xLabel} ${l}` : String(l)} /><Legend formatter={legendFmt} wrapperStyle={{ paddingTop: 6 }} />
          {C.series.map(s => <Line key={s.key} dataKey={s.key} name={s.name} stroke={COL[s.color]} strokeWidth={s.dash ? 2.25 : 2.5} strokeDasharray={s.dash ? '6 4' : undefined} dot={false} animationDuration={1100} />)}</LineChart>
        : <BarChart data={C.data} margin={{ top: 8, right: 8 }}><CartesianGrid vertical={false} stroke="rgba(247,183,49,.08)" /><XAxis dataKey={C.xKey} {...AX} /><YAxis width={58} {...AXY} />
          <Tooltip {...brlTT} cursor={{ fill: 'rgba(247,183,49,.06)' }} /><Legend formatter={legendFmt} wrapperStyle={{ paddingTop: 6 }} />
          {C.series.map(s => <Bar key={s.key} dataKey={s.key} name={s.name} fill={COL[s.color]} radius={[6, 6, 0, 0]} animationDuration={1000} />)}</BarChart>}
      </ResponsiveContainer><Disc /></div>
    <div className="card"><h3>Prós, contras e riscos</h3>
      <div className="pc-grid">{r.options.map(o => <div key={o.name} className="pc"><b>{o.name}</b>
        <ul>{o.pros.map((x, i) => <li key={'p' + i} className="pro">{x}</li>)}{o.cons.map((x, i) => <li key={'c' + i} className="con">{x}</li>)}</ul></div>)}</div>
      <div className="finding warn" style={{ marginTop: 12 }}><b>Riscos e cuidados</b><ul>{r.risks.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      <p className="hint">Os números são estimativas. A decisão é sua — o simulador só mostra os caminhos.</p>
      {onSave && <button className="btn full" onClick={onSave}>Salvar como objetivo</button>}
      {saved && <button className="btn ghost full" onClick={goGoals}>Objetivo salvo · ver em Objetivos →</button>}
      <Disc /></div>
  </>;
}
