import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceArea } from 'recharts';
import { Data, CATEGORIES, Category, DISCLAIMER, brl, thisMonth } from './finance';
import { series, deltas, ymTitle, ymShort, needsClosing } from './history';
import { CH, COLORS, AX, AXY, TT, legendFmt } from './chartTheme';

const Disc = () => <p className="jm-disc">{DISCLAIMER}</p>;
const GRID = <CartesianGrid vertical={false} stroke="rgba(247,183,49,.08)" />;
const Card = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) =>
  <motion.div className="card" initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-30px' }} transition={{ duration: 0.4 }}>
    <h3>{title}</h3>{hint && <p className="hint">{hint}</p>}{children}<Disc /></motion.div>;

export default function Evolucao({ data, onCloseMonth }: { data: Data; onCloseMonth: () => void }) {
  const pts = useMemo(() => series(data), [data]);
  const ds = useMemo(() => deltas(data), [data]);
  const cats = useMemo(() => {
    const set = new Set<string>(); data.history.forEach(h => Object.keys(h.spent).forEach(c => set.add(c))); data.expenses.forEach(e => set.add(e.category));
    return [...set].map(c => CATEGORIES[c as Category]?.label).filter(Boolean) as string[];
  }, [data]);
  const pending = needsClosing(data, thisMonth());
  const brlTT = { ...TT, formatter: (v: unknown) => brl(Number(v)) };
  return <>
    <div className="card month-card">
      <div><small className="eyebrow">Mês atual</small><h3 style={{ margin: 0 }}>{ymTitle(data.month)}</h3>
        <p className="hint" style={{ margin: '4px 0 0' }}>{data.history.length ? `${data.history.length} ${data.history.length === 1 ? 'mês fechado' : 'meses fechados'} no histórico` : 'Nenhum mês fechado ainda'}</p></div>
      <button className={`btn ${pending ? '' : 'ghost'} sm`} onClick={onCloseMonth}>Fechar mês</button>
    </div>
    {data.isExample && <div className="card ex" style={{ padding: 12 }}><b>EXEMPLO</b> — histórico de 6 meses fictício, só para demonstrar os gráficos.</div>}
    {!data.history.length ? <div className="card center">
      <h3>Sua evolução começa aqui</h3>
      <p className="hint">Ao fechar cada mês, o JM Finance guarda uma foto da sua situação (nota, dívidas, patrimônio, reserva, gastos e objetivos). Com 2 ou mais meses, você verá gráficos e comparações aqui.</p>
      <button className="btn" onClick={onCloseMonth}>Fechar {ymShort(data.month)}</button><Disc /></div> : <>
      <Card title="O que mudou" hint={`Mês atual (parcial) comparado a ${ymShort(data.history[data.history.length - 1].month)}.`}>
        {ds.map((x, i) => <div key={i} className={`delta ${x.tone}`}><span>{x.tone === 'good' ? '▲' : x.tone === 'bad' ? '▼' : '•'}</span>{x.text}</div>)}
      </Card>
      <Card title="Nota de saúde financeira">
        <ResponsiveContainer width="100%" height={190}><LineChart data={pts} margin={{ top: 8, right: 8 }}>
          <ReferenceArea y1={0} y2={40} fill="#ef4444" fillOpacity={0.05} /><ReferenceArea y1={40} y2={60} fill="#f59e0b" fillOpacity={0.05} /><ReferenceArea y1={80} y2={100} fill="#22c55e" fillOpacity={0.05} />
          {GRID}<XAxis dataKey="label" {...AX} /><YAxis domain={[0, 100]} width={34} {...AX} /><Tooltip {...TT} />
          <Line dataKey="score" name="Nota" stroke={CH.gold} strokeWidth={2.5} dot={{ r: 3, fill: CH.gold }} animationDuration={1200} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title="Patrimônio líquido" hint="Tudo o que você tem menos tudo o que deve.">
        <ResponsiveContainer width="100%" height={190}><AreaChart data={pts} margin={{ top: 8, right: 8 }}>
          <defs><linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={CH.gold} stopOpacity={0.45} /><stop offset="1" stopColor={CH.gold} stopOpacity={0.02} /></linearGradient></defs>
          {GRID}<XAxis dataKey="label" {...AX} /><YAxis width={58} {...AXY} /><Tooltip {...brlTT} />
          <Area dataKey="netWorth" name="Patrimônio líquido" stroke={CH.gold} strokeWidth={2.5} fill="url(#nwG)" animationDuration={1200} /></AreaChart></ResponsiveContainer>
      </Card>
      <Card title="Dívida total">
        <ResponsiveContainer width="100%" height={190}><BarChart data={pts} margin={{ top: 8, right: 8 }}>
          <defs><linearGradient id="dbG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e5e7ea" /><stop offset="1" stopColor={CH.steel} /></linearGradient></defs>
          {GRID}<XAxis dataKey="label" {...AX} /><YAxis width={58} {...AXY} /><Tooltip {...brlTT} cursor={{ fill: 'rgba(247,183,49,.06)' }} />
          <Bar dataKey="totalDebt" name="Dívida total" fill="url(#dbG)" radius={[6, 6, 0, 0]} animationDuration={1000} /></BarChart></ResponsiveContainer>
      </Card>
      <Card title="Reserva de emergência" hint="Em meses de custos essenciais. Meta: 3 a 6 meses.">
        <ResponsiveContainer width="100%" height={170}><LineChart data={pts} margin={{ top: 8, right: 8 }}>
          {GRID}<XAxis dataKey="label" {...AX} /><YAxis width={38} {...AX} tickFormatter={(n: number) => n.toLocaleString('pt-BR')} /><Tooltip {...TT} formatter={(v) => `${Number(v).toLocaleString('pt-BR')} meses`} />
          <Line dataKey="reserveMonths" name="Reserva" stroke={CH.champagne} strokeWidth={2.5} dot={{ r: 3, fill: CH.champagne }} animationDuration={1200} /></LineChart></ResponsiveContainer>
      </Card>
      <Card title="Gastos por categoria" hint="Usa o “Gasto até agora” anotado no mês; sem anotação, o planejado.">
        <ResponsiveContainer width="100%" height={260}><BarChart data={pts} margin={{ top: 8, right: 8 }}>
          {GRID}<XAxis dataKey="label" {...AX} /><YAxis width={58} {...AXY} /><Tooltip {...brlTT} cursor={{ fill: 'rgba(247,183,49,.06)' }} />
          <Legend iconType="circle" iconSize={9} itemSorter={null} formatter={legendFmt} wrapperStyle={{ lineHeight: '20px', paddingTop: 6 }} />
          {cats.map((c, i) => <Bar key={c} dataKey={c} stackId="s" fill={COLORS[i % COLORS.length]} stroke="#0d0b09" strokeWidth={1} animationDuration={1000} />)}</BarChart></ResponsiveContainer>
      </Card>
      <p className="disc">* mês atual, ainda em andamento.</p>
    </>}
  </>;
}
