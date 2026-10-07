import { useEffect, useMemo, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, Legend, CartesianGrid } from 'recharts';
import { Data, Category, DebtType, AssetType, GoalType, Priority, Goal, CATEGORIES, DEBT_TYPES, ASSET_TYPES, GOAL_TYPES, PRIORITIES, DISCLAIMER, brl, pct, uid, emptyData, exampleData, diagnose, actionPlan, order, migrate, evaluateGoals } from './finance';

type Tab = 'inicio' | 'dados' | 'diagnostico' | 'plano' | 'objetivos';
const KEY = 'jmfinance:data';
const COLORS = ['#0f766e', '#2563eb', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#64748b', '#84cc16'];
const LEVEL_COLOR: Record<string, string> = { 'crítico': '#dc2626', 'atenção': '#f59e0b', 'estável': '#2563eb', 'saudável': '#16a34a' };

function load(): Data { try { return migrate(JSON.parse(localStorage.getItem(KEY) || '')) } catch { return emptyData() } }
const Disc = () => <p className="jm-disc">{DISCLAIMER}</p>;

export default function App() {
  const [data, setData] = useState<Data>(load);
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') as Tab) || 'inicio');
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(data)), [data]);
  const upd = (p: Partial<Data>) => setData(d => ({ ...d, ...p, isExample: p.isExample ?? d.isExample }));
  const hasData = data.incomes.length > 0;
  return (
    <div className="app">
      <header><div className="logo">JM<span>Finance</span></div>
        {data.isExample && <span className="badge-ex">DADOS DE EXEMPLO</span>}</header>
      <main>
        {tab === 'inicio' && <Home data={data} hasData={hasData} go={setTab} setData={setData} />}
        {tab === 'dados' && <Inputs data={data} upd={upd} setData={setData} />}
        {tab === 'diagnostico' && (hasData ? <Diagnosis data={data} /> : <Empty go={setTab} />)}
        {tab === 'plano' && (hasData ? <Plan data={data} /> : <Empty go={setTab} />)}
        {tab === 'objetivos' && <Goals data={data} upd={upd} />}
      </main>
      <nav>
        {([['inicio', '🏠', 'Início'], ['dados', '✏️', 'Meus dados'], ['diagnostico', '🩺', 'Diagnóstico'], ['plano', '🧭', 'Plano'], ['objetivos', '🎯', 'Objetivos']] as const).map(([k, i, l]) =>
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><span>{i}</span>{l}</button>)}
      </nav>
    </div>
  );
}

function Empty({ go }: { go: (t: Tab) => void }) {
  return <div className="card center"><p>Cadastre pelo menos uma renda para ver esta tela.</p><button className="btn" onClick={() => go('dados')}>Cadastrar meus dados</button></div>;
}

function Home({ data, hasData, go, setData }: { data: Data; hasData: boolean; go: (t: Tab) => void; setData: (d: Data) => void }) {
  const r = useMemo(() => diagnose(data), [data]);
  return <>
    <section className="hero">
      <h1>Saia do vermelho com um plano claro.</h1>
      <p>O JM Finance analisa sua renda, gastos e dívidas, explica sua situação em linguagem simples e diz exatamente o que fazer, passo a passo.</p>
    </section>
    {hasData ? <>
      <ScoreCard r={r} />
      <div className="grid2">
        <Stat label="Renda mensal" v={brl(r.income)} />
        <Stat label="Saldo do mês" v={brl(r.balance)} bad={r.balance < 0} />
        <Stat label="Dívida total" v={brl(r.totalDebt)} />
        <Stat label="Reserva" v={`${r.reserveMonths.toFixed(1)} meses`} />
      </div>
      <button className="btn full" onClick={() => go('plano')}>Ver meu plano de ação →</button>
    </> : <div className="card">
      <h3>Como funciona</h3>
      <ol className="steps-mini"><li>Cadastre renda, gastos e dívidas</li><li>Receba um diagnóstico com nota de saúde financeira</li><li>Siga o plano de ação ordenado</li></ol>
      <button className="btn full" onClick={() => go('dados')}>Começar com meus dados</button>
    </div>}
    <div className="card ex">
      <p><b>Quer só conhecer?</b> Carregue um caso fictício para ver como o app funciona.</p>
      <button className="btn ghost full" onClick={() => { if (!hasData || confirm('Isso substitui seus dados atuais. Continuar?')) { setData(exampleData()); go('diagnostico'); } }}>📋 Carregar dados de EXEMPLO (fictícios)</button>
    </div>
    <p className="disc">O JM Finance é uma ferramenta educativa e não substitui orientação de um profissional certificado. Seus dados ficam apenas neste aparelho.</p>
  </>;
}

const Stat = ({ label, v, bad }: { label: string; v: string; bad?: boolean }) => <div className="stat"><small>{label}</small><b className={bad ? 'neg' : ''}>{v}</b></div>;

function ScoreCard({ r }: { r: ReturnType<typeof diagnose> }) {
  const c = LEVEL_COLOR[r.level];
  return <div className="card score" style={{ borderColor: c }}>
    <div className="ring" style={{ background: `conic-gradient(${c} ${r.score * 3.6}deg, #e5e7eb 0)` }}><div><b>{r.score}</b><small>/100</small></div></div>
    <div><small>Saúde financeira</small><h2 style={{ color: c }}>{r.level.toUpperCase()}</h2><p>{r.levelText}</p><Disc /></div>
  </div>;
}

function num(v: string) { return Number(v.replace(',', '.')) || 0; }

function Inputs({ data, upd, setData }: { data: Data; upd: (p: Partial<Data>) => void; setData: (d: Data) => void }) {
  const mark = (p: Partial<Data>) => upd({ ...p, isExample: false });
  return <>
    {data.isExample && <div className="card ex">Você está vendo <b>dados de exemplo fictícios</b>. Edite ou <button className="link" onClick={() => setData(emptyData())}>limpe tudo</button> para usar os seus.</div>}
    <div className="card"><h3>💰 Rendas mensais</h3>
      {data.incomes.map(i => <div className="row" key={i.id}>
        <input value={i.name} onChange={e => mark({ incomes: data.incomes.map(x => x.id === i.id ? { ...x, name: e.target.value } : x) })} />
        <input type="number" inputMode="decimal" value={i.amount || ''} placeholder="R$" onChange={e => mark({ incomes: data.incomes.map(x => x.id === i.id ? { ...x, amount: num(e.target.value) } : x) })} />
        <button className="x" onClick={() => mark({ incomes: data.incomes.filter(x => x.id !== i.id) })}>✕</button></div>)}
      <button className="btn ghost" onClick={() => mark({ incomes: [...data.incomes, { id: uid(), name: 'Salário', amount: 0 }] })}>+ Adicionar renda</button>
    </div>
    <div className="card"><h3>🧾 Gastos mensais</h3>
      {data.expenses.map(i => <div className="row wrap" key={i.id}>
        <input value={i.name} onChange={e => mark({ expenses: data.expenses.map(x => x.id === i.id ? { ...x, name: e.target.value } : x) })} />
        <input type="number" inputMode="decimal" value={i.amount || ''} placeholder="R$" onChange={e => mark({ expenses: data.expenses.map(x => x.id === i.id ? { ...x, amount: num(e.target.value) } : x) })} />
        <select value={i.category} onChange={e => mark({ expenses: data.expenses.map(x => x.id === i.id ? { ...x, category: e.target.value as Category } : x) })}>
          {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select value={i.kind} onChange={e => mark({ expenses: data.expenses.map(x => x.id === i.id ? { ...x, kind: e.target.value as 'fixa' } : x) })}>
          <option value="fixa">Fixo</option><option value="variavel">Variável</option></select>
        <button className="x" onClick={() => mark({ expenses: data.expenses.filter(x => x.id !== i.id) })}>✕</button></div>)}
      <button className="btn ghost" onClick={() => mark({ expenses: [...data.expenses, { id: uid(), name: 'Novo gasto', amount: 0, category: 'outros', kind: 'variavel' }] })}>+ Adicionar gasto</button>
    </div>
    <div className="card"><h3>💳 Dívidas</h3>
      <p className="hint">Juros ao mês (a.m.) aparecem na fatura/contrato. Rotativo do cartão costuma passar de 12% a.m.</p>
      {data.debts.map(i => <div className="debt" key={i.id}>
        <div className="row"><input value={i.name} onChange={e => mark({ debts: data.debts.map(x => x.id === i.id ? { ...x, name: e.target.value } : x) })} />
          <button className="x" onClick={() => mark({ debts: data.debts.filter(x => x.id !== i.id) })}>✕</button></div>
        <div className="row wrap">
          <label>Tipo<select value={i.type} onChange={e => mark({ debts: data.debts.map(x => x.id === i.id ? { ...x, type: e.target.value as DebtType } : x) })}>
            {Object.entries(DEBT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>Saldo devedor<input type="number" value={i.balance || ''} onChange={e => mark({ debts: data.debts.map(x => x.id === i.id ? { ...x, balance: num(e.target.value) } : x) })} /></label>
          <label>Juros % a.m.<input type="number" value={i.rate || ''} onChange={e => mark({ debts: data.debts.map(x => x.id === i.id ? { ...x, rate: num(e.target.value) } : x) })} /></label>
          <label>Parcela mínima<input type="number" value={i.minPayment || ''} onChange={e => mark({ debts: data.debts.map(x => x.id === i.id ? { ...x, minPayment: num(e.target.value) } : x) })} /></label>
        </div></div>)}
      <button className="btn ghost" onClick={() => mark({ debts: [...data.debts, { id: uid(), name: 'Nova dívida', type: 'outro', balance: 0, rate: 0, minPayment: 0 }] })}>+ Adicionar dívida</button>
    </div>
    <div className="card"><h3>🏠 Patrimônio (bens e aplicações)</h3>
      <p className="hint">O que você tem: imóvel, carro, investimentos, dinheiro em conta. "Líquido" = dá para usar rápido sem perder valor.</p>
      {data.assets.map(i => <div className="debt" key={i.id}>
        <div className="row"><input value={i.name} onChange={e => mark({ assets: data.assets.map(x => x.id === i.id ? { ...x, name: e.target.value } : x) })} />
          <button className="x" onClick={() => mark({ assets: data.assets.filter(x => x.id !== i.id) })}>✕</button></div>
        <div className="row wrap">
          <label>Tipo<select value={i.type} onChange={e => { const t = e.target.value as AssetType; mark({ assets: data.assets.map(x => x.id === i.id ? { ...x, type: t, liquid: ASSET_TYPES[t].liquid } : x) }); }}>
            {Object.entries(ASSET_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
          <label>Valor estimado<input type="number" inputMode="decimal" value={i.value || ''} onChange={e => mark({ assets: data.assets.map(x => x.id === i.id ? { ...x, value: num(e.target.value) } : x) })} /></label>
          <label>Liquidez<select value={i.liquid ? 'l' : 'i'} onChange={e => mark({ assets: data.assets.map(x => x.id === i.id ? { ...x, liquid: e.target.value === 'l' } : x) })}>
            <option value="l">Líquido</option><option value="i">Ilíquido</option></select></label>
        </div></div>)}
      <button className="btn ghost" onClick={() => mark({ assets: [...data.assets, { id: uid(), name: 'Novo bem', type: 'outros', value: 0, liquid: false }] })}>+ Adicionar bem</button>
    </div>
    <div className="card"><h3>🛟 Reserva de emergência</h3>
      <label>Quanto você tem guardado hoje<input type="number" value={data.reserve || ''} onChange={e => mark({ reserve: num(e.target.value) })} /></label>
    </div>
  </>;
}

function Diagnosis({ data }: { data: Data }) {
  const r = useMemo(() => diagnose(data), [data]);
  const byCat: Record<string, number> = {};
  data.expenses.forEach(e => byCat[CATEGORIES[e.category].label] = (byCat[CATEGORIES[e.category].label] || 0) + e.amount);
  if (r.minPayments) byCat['Parcelas de dívidas'] = r.minPayments;
  const pie = Object.entries(byCat).map(([name, value]) => ({ name, value }));
  const bars = [{ name: 'Renda', valor: r.income }, { name: 'Gastos', valor: r.expenses }, { name: 'Dívidas', valor: r.minPayments }, { name: 'Saldo', valor: r.balance }];
  return <>
    <ScoreCard r={r} />
    <div className="grid2">
      <Stat label="Renda comprometida" v={pct(r.commitment)} bad={r.commitment > 1} />
      <Stat label="Dívida / renda (parcelas)" v={pct(r.dti)} bad={r.dti > 0.3} />
      <Stat label="Juros pagos/mês" v={brl(r.monthlyInterest)} bad={r.monthlyInterest > 0} />
      <Stat label="Reserva de emergência" v={`${r.reserveMonths.toFixed(1)} meses`} bad={r.reserveMonths < 1} />
    </div>
    <div className="card"><h3>🏠 Patrimônio</h3>
      <div className="grid3">
        <Stat label="Patrimônio total" v={brl(r.totalAssets + r.reserve)} />
        <Stat label="Patrimônio líquido" v={brl(r.netWorth)} bad={r.netWorth < 0} />
        <Stat label="Ativos líquidos" v={brl(r.liquidAssets + r.reserve)} />
      </div>
      <p className="hint">Patrimônio líquido = tudo o que você tem − tudo o que deve. Ativos líquidos (incluindo a reserva) contam para a reserva de emergência.</p>
      <Disc /></div>
    <div className="card"><h3>O que isso significa</h3>
      {r.findings.map((f, i) => <div key={i} className={`finding ${f.tone}`}><b>{f.title}</b><p>{f.text}</p></div>)}<Disc /></div>
    <div className="card"><h3>Para onde vai seu dinheiro</h3>
      <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}>
        {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip formatter={(v) => brl(Number(v))} /><Legend /></PieChart></ResponsiveContainer><Disc /></div>
    <div className="card"><h3>Entradas x saídas</h3>
      <ResponsiveContainer width="100%" height={220}><BarChart data={bars}><XAxis dataKey="name" /><YAxis width={50} /><Tooltip formatter={(v) => brl(Number(v))} />
        <Bar dataKey="valor">{bars.map((b, i) => <Cell key={i} fill={b.valor < 0 ? '#dc2626' : COLORS[i]} />)}</Bar></BarChart></ResponsiveContainer><Disc /></div>
  </>;
}

function Plan({ data }: { data: Data }) {
  const p = useMemo(() => actionPlan(data), [data]);
  const line = p.payoff ? p.payoff.av.timeline.map((t, i) => ({ mes: t.mes, Avalanche: Math.round(t.saldo), 'Bola de neve': Math.round(p.payoff!.sb.timeline[i]?.saldo ?? 0) })) : [];
  return <>
    <div className="card"><h3>🧭 Seu plano de ação</h3><p className="hint">Siga na ordem. Cada etapa prepara a próxima.</p></div>
    {p.steps.map((s, i) => <div className="card step" key={i}><div className="n">{i + 1}</div><div><h3>{s.title}</h3><p>{s.text}</p>
      {s.items && <ul>{s.items.map((x, j) => <li key={j}>{x}</li>)}</ul>}<Disc /></div></div>)}
    {p.payoff && <div className="card"><h3>Projeção de quitação das dívidas</h3>
      <p className="hint">Saldo devedor total mês a mês, com {brl(p.payoff.budget)}/mês para dívidas.</p>
      <ResponsiveContainer width="100%" height={240}><LineChart data={line}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" /><YAxis width={55} />
        <Tooltip formatter={(v) => brl(Number(v))} labelFormatter={l => `Mês ${l}`} /><Legend />
        <Line dataKey="Avalanche" stroke="#0f766e" dot={false} strokeWidth={2} /><Line dataKey="Bola de neve" stroke="#f59e0b" dot={false} strokeWidth={2} /></LineChart></ResponsiveContainer>
      <table><thead><tr><th>Dívida (avalanche)</th><th>Juros</th><th>Quitada no mês</th></tr></thead><tbody>
        {order(data.debts, 'avalanche').map(d => <tr key={d.id}><td>{d.name}</td><td>{d.rate}%</td><td>{p.payoff!.av.payoff[d.id] ?? '—'}</td></tr>)}</tbody></table><Disc />
    </div>}
    <p className="disc">Estimativas simplificadas (juros compostos mensais, sem IOF/multas). Confirme valores com seu banco.</p>
  </>;
}

const fmtYm = (s: string) => { if (!s) return '—'; const [y, m] = s.split('-'); return `${m}/${y}`; };

function Goals({ data, upd }: { data: Data; upd: (p: Partial<Data>) => void }) {
  const ev = useMemo(() => evaluateGoals(data), [data]);
  const set = (id: string, p: Partial<Goal>) => upd({ isExample: false, goals: data.goals.map(g => g.id === id ? { ...g, ...p } : g) });
  const add = () => { const t = new Date(); t.setFullYear(t.getFullYear() + 1);
    upd({ isExample: false, goals: [...data.goals, { id: uid(), name: 'Novo objetivo', type: 'compra', target: 0, date: t.toISOString().slice(0, 7), saved: 0, priority: 'media' }] }); };
  return <>
    <div className="card"><h3>🎯 Meus objetivos</h3>
      <p className="hint">Liste o que você quer conquistar. Calculamos quanto guardar por mês e se cabe no seu orçamento depois do plano de dívidas.</p>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <Stat label="Livre para objetivos/mês" v={brl(ev.free)} bad={ev.free <= 0} />
        <Stat label="Necessário p/ todos" v={brl(ev.results.reduce((s, x) => s + x.need, 0))} />
      </div>
      {ev.hasDebts && <p className="hint" style={{ marginTop: 8 }}>{ev.payoffMonths ? `Depois de quitar as dívidas (em ~${ev.payoffMonths} meses), sobrarão cerca de ${brl(ev.freeAfter)}/mês para objetivos.` : 'Com o orçamento atual as dívidas não terminam — renegociar é o primeiro passo para liberar dinheiro para objetivos.'}</p>}
      {ev.hasExpensive && <div className="finding bad"><b>Atenção: você tem dívidas caras</b><p>Enquanto existirem dívidas como rotativo ou cheque especial, a prioridade é quitá-las — os juros delas crescem mais rápido do que qualquer objetivo. Por isso só 20% da sua sobra é considerada para objetivos agora.</p></div>}
      {!ev.hasExpensive && ev.hasDebts && <div className="finding warn"><b>Dívidas primeiro</b><p>Enquanto quita as dívidas, 80% da sobra vai para elas e 20% para objetivos.</p></div>}
      <Disc /></div>
    {ev.results.map(({ goal: g, target, months, need, allocated, allocatedAfter, fits, progress, alt }) => <div className="card" key={g.id}>
      <div className="row"><input value={g.name} onChange={e => set(g.id, { name: e.target.value })} />
        <button className="x" onClick={() => upd({ isExample: false, goals: data.goals.filter(x => x.id !== g.id) })}>✕</button></div>
      <div className="row wrap">
        <label>Tipo<select value={g.type} onChange={e => { const t = e.target.value as GoalType; set(g.id, { type: t, retire: t === 'aposentadoria' ? (g.retire ?? { monthlyIncome: 3000, age: 30, retireAge: 65, rate: 0.5 }) : g.retire }); }}>
          {Object.entries(GOAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Prioridade<select value={g.priority} onChange={e => set(g.id, { priority: e.target.value as Priority })}>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Já guardado<input type="number" inputMode="decimal" value={g.saved || ''} onChange={e => set(g.id, { saved: num(e.target.value) })} /></label>
      </div>
      {g.type === 'aposentadoria' && g.retire ? <div className="row wrap">
        <label>Renda mensal desejada<input type="number" value={g.retire.monthlyIncome || ''} onChange={e => set(g.id, { retire: { ...g.retire!, monthlyIncome: num(e.target.value) } })} /></label>
        <label>Idade atual<input type="number" value={g.retire.age || ''} onChange={e => set(g.id, { retire: { ...g.retire!, age: num(e.target.value) } })} /></label>
        <label>Aposentar aos<input type="number" value={g.retire.retireAge || ''} onChange={e => set(g.id, { retire: { ...g.retire!, retireAge: num(e.target.value) } })} /></label>
        <label>Rendimento real % a.m.<input type="number" step="0.1" value={g.retire.rate || ''} onChange={e => set(g.id, { retire: { ...g.retire!, rate: num(e.target.value) } })} /></label>
      </div> : <div className="row wrap">
        <label>Valor do objetivo<input type="number" inputMode="decimal" value={g.target || ''} onChange={e => set(g.id, { target: num(e.target.value) })} /></label>
        <label>Data alvo<input type="month" value={g.date} onChange={e => set(g.id, { date: e.target.value })} /></label>
      </div>}
      <div className="progress"><div style={{ width: `${progress * 100}%` }} /></div>
      <small className="hint">{brl(g.saved)} de {brl(target)} ({pct(progress)})</small>
      <div className={`finding ${fits ? 'good' : 'warn'}`}>
        {g.type === 'aposentadoria' && g.retire && <p>Para viver de {brl(g.retire.monthlyIncome)}/mês (valores de hoje) você precisa juntar cerca de <b>{brl(target)}</b> até os {g.retire.retireAge} anos ({Math.round(months / 12)} anos).</p>}
        <b>Guardar {brl(need)}/mês {g.type !== 'aposentadoria' && `por ${months} meses`}</b>
        <p>{fits ? '✅ Cabe no seu orçamento livre atual.' : `⚠️ Não cabe agora: sobram ${brl(allocated)}/mês para este objetivo (pela ordem de prioridade).`}</p>
        {alt && <ul>
          {g.type === 'aposentadoria'
            ? (ev.hasDebts && allocatedAfter >= need ? <li>Depois de quitar as dívidas, aportar {brl(need)}/mês já cabe — comece com o que puder agora e aumente depois.</li>
              : alt.extendMonths > 0 && <li>Com seus aportes possíveis, leva cerca de {Math.round(alt.extendMonths / 12)} anos — considere adiar um pouco a aposentadoria.</li>)
            : alt.extendMonths > 0 ? <li>Estender o prazo para {fmtYm(alt.extendTo)} ({alt.extendMonths} meses){ev.hasDebts && ev.payoffMonths ? ', usando a folga que aparece depois de quitar as dívidas' : ''}.</li>
            : <li>Adiar este objetivo até sair das dívidas.</li>}
          {alt.reduceTo > g.saved + 1 && <li>{g.type === 'aposentadoria' ? `Reduzir a renda desejada para ~${brl(alt.reduceTo)}/mês.` : `Reduzir o valor para ~${brl(alt.reduceTo)} mantendo a data.`}</li>}
          <li>Cortar mais {brl(alt.cut)}/mês em gastos ou aumentar a renda nesse valor.</li>
        </ul>}
      </div>
      <Disc />
    </div>)}
    <button className="btn full" onClick={add}>+ Adicionar objetivo</button>
  </>;
}
