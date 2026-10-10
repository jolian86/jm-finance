import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { Data, brl } from './finance';
import { cashflow, dayRanges } from './cashflow';
import { AX, AXY, TT, CH } from './chartTheme';

/** "O mês dia a dia": só aparece quando alguma renda tem "dia que recebe". */
export function FlowCard({ data, goData }: { data: Data; goData?: () => void }) {
  const f = cashflow(data);
  if (!f) return <div className="card flow-card"><h3>O mês dia a dia</h3>
    <p className="hint">Quer saber se alguma conta vence antes do dinheiro cair? Informe o <b>dia que recebe</b> em “Meus dados › Rendas mensais” (opcional).</p>
    {goData && <button className="btn ghost sm" onClick={goData}>Informar o dia que recebo</button>}</div>;
  const pts = f.days.map(x => ({ d: `dia ${x.day}`, v: x.bal }));
  return <div className="card flow-card"><h3>O mês dia a dia</h3>
    <p className="hint">Contando a partir do dia {f.start}, quando cai {f.paydays.length > 1 ? 'a maior renda' : 'a renda'}: quanto sobra (ou falta) em cada dia, com as contas nos dias em que vencem e os outros gastos espalhados pelo mês.</p>
    <div className="chart-box" style={{ height: 190 }}><ResponsiveContainer><AreaChart data={pts} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
      <CartesianGrid stroke="rgba(255,255,255,.06)" vertical={false} /><XAxis dataKey="d" {...AX} interval={6} /><YAxis {...AXY} width={52} />
      <Tooltip {...TT} formatter={(v) => [brl(Number(v)), 'Saldo do dia']} /><ReferenceLine y={0} stroke="#ef4444" strokeDasharray="4 4" />
      <Area type="stepAfter" dataKey="v" stroke={CH.gold} fill={CH.gold} fillOpacity={0.18} strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
    {f.deficit > 0 && <p className="flow-warn">O mês, no total, não fecha: faltam {brl(f.deficit)}. Isso se resolve ajustando gastos e dívidas (veja o Plano). Abaixo, olhamos só as datas.</p>}
    {f.tight.length ? <p className="flow-warn">⚠️ Dias de aperto: {dayRanges(f.tight)}. No pior dia ({f.minDay}) faltam {brl(-f.minBal)}.</p>
      : <p className="flow-ok">✓ {f.deficit > 0 ? 'As datas estão bem encaixadas' : 'Nenhum dia de aperto'}: o dinheiro chega antes das contas.</p>}
    {f.early.slice(0, 4).map(e => <p key={e.id} className="flow-warn">“{e.name}” ({brl(e.amount)}) vence dia {e.day}, quando o dinheiro já acabou. Dá para pedir à empresa ou ao banco para mudar o vencimento para o <b>dia {e.suggest}</b>, logo depois que você recebe.</p>)}
    <ul className="flow-list">{[...f.events].sort((a, b) => ((a.day - f.start + 30) % 30) - ((b.day - f.start + 30) % 30)).slice(0, 12).map((e, i) =>
      <li key={i}><span>dia {e.day} · {e.name}</span><span className={e.kind === 'entra' ? 'in' : 'neg'}>{e.kind === 'entra' ? '+' : '−'} {brl(e.amount)}</span></li>)}</ul>
    {f.undated > 0 && <p className="hint" style={{ marginTop: 8 }}>Gastos sem dia de vencimento ({brl(f.undated)}) foram espalhados pelo mês.</p>}
  </div>;
}
