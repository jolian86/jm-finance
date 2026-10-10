import { useTheme, ThemeButton } from './theme';
import { FlowCard } from './FlowCard';
import { MovedBanner } from './MovedBanner';
import { exportBackup } from './backup';
import { ThemePicker, ThemeTip, pickerDone } from './ThemePicker';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import Chat from './Chat';
import Evolucao from './Evolucao';
import Simulador from './Simulador';
import { DebtCard } from './DebtCard';
import { AssetCard } from './AssetCard';
import Backup from './Backup';
import { ReceivablesCard, ForecastCard, VarIncome, ModeToggle } from './Receivables';
import { isDaily, withDaily, dailyStats, DEFAULT_DAYS, SPLIT, splitSum, SplitKey } from './finance';
import { DailyFields, DailyToday } from './Daily';
import { varStats, fmtAm, STRATEGY, inferKind, withAutoKind, newRetire, amToAa, aaToAm, DEFAULT_REAL_AA, DEFAULT_REAL_AM, Expense } from './finance';
import { Welcome, TermsSheet, deleteAllData } from './Terms';
import { TERMS_VERSION, hasAccepted } from './terms';
import type { SimId } from './sim';
import { Bell, AlertsPanel, Modal } from './AlertsCenter';
import { computeAlerts, notifyNew, saveReminders, AlertTab } from './alerts';
import { closeMonth, needsClosing, fullExample, ymLong, ymTitle, ymShort, deltas, plannedByCategory } from './history';
import { AnimatedNumber, ScoreGauge, ProgressRing, BrandLockup, Splash, Icon, MoneyInput, DayInput, Adv } from './ui';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line, Legend, CartesianGrid } from 'recharts';
import { Data, Category, GoalType, Priority, Goal, CATEGORIES, GOAL_TYPES, PRIORITIES, DISCLAIMER, brl, pct, uid, emptyData, thisMonth, diagnose, actionPlan, order, migrate, evaluateGoals } from './finance';

type Tab = 'inicio' | 'dados' | 'diagnostico' | 'plano' | 'objetivos' | 'simulador';
const KEY = 'jmfinance:data';
// Paleta derivada do logo (dourados) para gráficos; vermelho/verde/âmbar só para status
import { CH, COLORS, legendFmt, AX, AXY, TT, LEVEL_COLOR } from './chartTheme';
const brl0 = (n: number) => brl(Math.round(n));

function load(): Data { try { return migrate(JSON.parse(localStorage.getItem(KEY) || '')) } catch { return emptyData() } }
const Disc = () => <p className="jm-disc">{DISCLAIMER}</p>;
const scrollToId = (id: string) => setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 450);
function ExportBtn({ data }: { data: Data }) {
  const [st, setSt] = useState<'idle' | 'busy' | 'done' | 'err'>('idle');
  const run = async () => {
    setSt('busy');
    try { const m = await import('./report'); await m.exportReport(data); setSt('done'); setTimeout(() => setSt('idle'), 4000); }
    catch (e) { console.error(e); setSt('err'); }
  };
  return <button className="btn ghost full export-btn" onClick={run} disabled={st === 'busy'}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
    {st === 'busy' ? 'Gerando PDF…' : st === 'done' ? 'Relatório gerado ✓' : st === 'err' ? 'Não foi possível gerar — tente de novo' : 'Exportar relatório (PDF)'}</button>;
}

export default function App() {
  const [data, setData] = useState<Data>(load);
  const [tab, setTab] = useState<Tab>(() => (new URLSearchParams(location.search).get('tab') as Tab) || 'inicio');
  useEffect(() => localStorage.setItem(KEY, JSON.stringify(data)), [data]);
  const { theme, toggle: toggleTheme, set: setThemeTo } = useTheme();
  const upd = (p: Partial<Data>) => setData(d => ({ ...d, ...p, isExample: p.isExample ?? d.isExample }));
  const hasData = data.incomes.length > 0;
  // trocar os dados (exemplo / limpar) mantém aceite dos termos e preferências do aparelho
  const replaceData = (nd: Data) => setData(prev => ({ ...nd, settings: { ...nd.settings, terms: prev.settings.terms, alertTime: prev.settings.alertTime, firstSeenAt: prev.settings.firstSeenAt, lastBackupAt: prev.settings.lastBackupAt, recvMode: prev.settings.recvMode } }));
  const [chat, setChat] = useState(() => new URLSearchParams(location.search).get('chat') === '1');
  const [splash, setSplash] = useState(() => !sessionStorage.getItem('jm:splash') && !new URLSearchParams(location.search).has('nosplash'));
  const q0 = new URLSearchParams(location.search).get('tab');
  const [diagView, setDiagView] = useState<'hoje' | 'evolucao'>(q0 === 'evolucao' ? 'evolucao' : 'hoje');
  const [simId, setSimId] = useState<SimId | undefined>(() => (new URLSearchParams(location.search).get('sim') as SimId) || undefined);
  // Consultor: entra no histórico (voltar do Android/navegador fecha), marca body.chat-open (barra de abas fica por cima e fecha o chat)
  const openChat = () => { try { history.pushState({ ...(history.state || {}), jmChat: 1 }, ''); } catch { /* */ } setChat(true); };
  const closeChat = () => { setChat(false); try { if (history.state?.jmChat) history.back(); } catch { /* */ } };
  useEffect(() => { const f = () => setChat(false); window.addEventListener('popstate', f); return () => window.removeEventListener('popstate', f); }, []);
  useEffect(() => { document.body.classList.toggle('chat-open', chat); }, [chat]);
  useEffect(() => { const n = document.querySelector('nav'); if (!n) return; const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--navh', `${n.getBoundingClientRect().height}px`)); ro.observe(n); return () => ro.disconnect(); }, []);
  const openSim = (s?: SimId) => { setSimId(s); closeChat(); setTab('simulador'); window.scrollTo({ top: 0 }); };
  const go = (t: Tab | AlertTab) => { if (chat) closeChat(); if (t === 'evolucao') { setDiagView('evolucao'); setTab('diagnostico'); } else { if (t === 'diagnostico') setDiagView('hoje'); setTab(t); } window.scrollTo({ top: 0 }); };
  // termos de uso (aceite obrigatório no 1º uso, para usuários antigos e quando a versão muda)
  const accepted = hasAccepted(data.settings.terms);
  const [pick, setPick] = useState<'' | 'pick' | 'tip'>('');
  const [termsOpen, setTermsOpen] = useState(false);
  const acceptTerms = () => { if (!data.settings.terms && !pickerDone()) setPick('pick'); setData(d => ({ ...d, settings: { ...d.settings, terms: { version: TERMS_VERSION, acceptedAt: new Date().toISOString() } } })); window.scrollTo({ top: 0 }); };
  const acceptedOn = data.settings.terms ? new Date(data.settings.terms.acceptedAt).toLocaleDateString('pt-BR') : '';
  // alertas
  const alerts = useMemo(() => computeAlerts(data), [data]);
  const unread = alerts.filter(a => !data.dismissedAlerts.includes(a.id)).length;
  const [alertsOpen, setAlertsOpen] = useState(() => new URLSearchParams(location.search).get('alertas') === '1');
  useEffect(() => { const base = import.meta.env.BASE_URL; notifyNew(alerts.filter(a => !data.dismissedAlerts.includes(a.id)), base, data.settings.alertTime).catch(() => {}); saveReminders(alerts, data, base).catch(() => {}); }, [alerts, data.settings.alertTime]); // eslint-disable-line
  // fechar mês
  const [askClose, setAskClose] = useState(false);
  const [newMonthPrompt, setNewMonthPrompt] = useState(() => needsClosing(load(), thisMonth()) && !sessionStorage.getItem('jm:nm'));
  const doClose = () => { setData(d => closeMonth(d, thisMonth())); setAskClose(false); setNewMonthPrompt(false); sessionStorage.setItem('jm:nm', '1'); setAlertsOpen(false); go('evolucao'); };
  return (
    <MotionConfig reducedMotion="user">
    <AnimatePresence>{splash && <Splash onDone={() => { sessionStorage.setItem('jm:splash', '1'); setSplash(false); }} />}</AnimatePresence>
    <AnimatePresence>{!accepted && <Welcome key="welcome" prev={data.settings.terms} hasData={hasData || data.debts.length > 0 || data.goals.length > 0 || data.history.length > 0} onAccept={acceptTerms} />}</AnimatePresence>
    {accepted && <div className="app">
      <header><BrandLockup small />
        <div className="head-right">{data.isExample && <span className="badge-ex">EXEMPLO</span>}<ThemeButton theme={theme} onToggle={toggleTheme} /><Bell count={unread} onClick={() => setAlertsOpen(true)} /></div></header>
      <main>
        <MovedBanner onBackup={() => { exportBackup(data, true); }} />
        <AnimatePresence mode="wait">
          <motion.div key={tab === 'simulador' ? 'sim' + (simId ?? '') : tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}>
            {tab === 'inicio' && <Home data={data} hasData={hasData} go={go} upd={upd} setData={replaceData} onCloseMonth={() => setAskClose(true)} onTerms={() => setTermsOpen(true)} />}
            {tab === 'dados' && <><Inputs data={data} upd={upd} setData={replaceData} onCloseMonth={() => setAskClose(true)} goGoals={() => go('objetivos')} /><Backup data={data} setData={setData} />
              <p className="terms-foot"><button className="link" onClick={() => setTermsOpen(true)}>Termos e privacidade</button>{acceptedOn && <> · aceitos em {acceptedOn} (versão {data.settings.terms!.version})</>}</p></>}
            {tab === 'diagnostico' && (hasData ? <>
              <ExportBtn data={data} />
              <div className="seg" role="tablist">{(['hoje', 'evolucao'] as const).map(v => <button key={v} role="tab" aria-selected={diagView === v} className={diagView === v ? 'on' : ''} onClick={() => setDiagView(v)}>
                {diagView === v && <motion.span layoutId="segpill" className="segpill" />}<span>{v === 'hoje' ? 'Hoje' : 'Evolução'}</span></button>)}</div>
              {diagView === 'hoje' ? <Diagnosis data={data} /> : <Evolucao data={data} onCloseMonth={() => setAskClose(true)} />}</> : <Empty go={go} />)}
            {tab === 'plano' && (hasData ? <Plan data={data} openSim={() => openSim()} upd={upd} goForecast={() => { go('dados'); scrollToId('previsao'); }} /> : <Empty go={go} />)}
            {tab === 'simulador' && (hasData ? <Simulador data={data} upd={upd} initial={simId} onBack={() => go('plano')} goGoals={() => go('objetivos')} /> : <Empty go={go} />)}
            {tab === 'objetivos' && <Goals data={data} upd={upd} />}
          </motion.div>
        </AnimatePresence>
      </main>
      {!chat && <motion.button className="fab" onClick={openChat} aria-label="Consultor JM" whileTap={{ scale: 0.92 }} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 18 }}>
        <Icon.chat /><span>Consultor</span></motion.button>}
      {/* portal no <body>: dentro de um ancestral com transform o position:fixed rolava junto com a página (iPhone: cabeçalho sumia) */}
      {createPortal(<AnimatePresence>{chat && <Chat data={data} upd={upd} onClose={closeChat} goGoals={() => { go('objetivos'); }} openSim={s => openSim(s)} goTab={t => go(t)} />}</AnimatePresence>, document.body)}
      <AnimatePresence>{alertsOpen && <AlertsPanel alerts={alerts} dismissed={data.dismissedAlerts}
        onDismiss={id => upd({ dismissedAlerts: [...data.dismissedAlerts, id] })} onRestore={() => upd({ dismissedAlerts: [] })}
        onGo={(t, anchor) => { setAlertsOpen(false); go(t); if (anchor) scrollToId(anchor); }} onCloseMonth={() => { setAlertsOpen(false); setAskClose(true); }} onClose={() => setAlertsOpen(false)}
        onBackup={() => { setAlertsOpen(false); go('dados'); setTimeout(() => document.getElementById('backup')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 450); }}
        alertTime={data.settings.alertTime} onTime={t => upd({ settings: { ...data.settings, alertTime: t } })} />}</AnimatePresence>
      <AnimatePresence>{(askClose || newMonthPrompt) && <Modal title={newMonthPrompt && !askClose ? 'Começou um novo mês!' : `Fechar ${ymLong(data.month)}?`} confirm="Fechar mês"
        onConfirm={doClose} onCancel={() => { setAskClose(false); setNewMonthPrompt(false); sessionStorage.setItem('jm:nm', '1'); }}>
        {newMonthPrompt && !askClose && <p>Seus dados ainda estão em <b>{ymLong(data.month)}</b>. Quer fechar esse mês para guardar no histórico?</p>}
        <p className="hint">Vamos guardar uma foto de {ymShort(data.month)}: renda, gastos por categoria, dívidas, patrimônio, reserva, nota e objetivos. Depois:</p>
        <ul className="steps-mini"><li>o app passa para o mês seguinte;</li><li>os gastos reais lançados são zerados (o orçamento planejado continua);</li><li>atualize saldos de dívidas, reserva e bens quando mudarem.</li></ul>
      </Modal>}</AnimatePresence>
      <AnimatePresence>{pick === 'pick' && <ThemePicker key="tp" theme={theme} onPick={setThemeTo} onDone={() => setPick('tip')} />}{pick === 'tip' && <ThemeTip key="tt" onClose={() => setPick('')} />}</AnimatePresence>
      <AnimatePresence>{termsOpen && <TermsSheet acceptance={data.settings.terms} onClose={() => setTermsOpen(false)} onDeleteAll={async () => { await deleteAllData(); location.replace(location.pathname); }} />}</AnimatePresence>
      <nav>
        {([['inicio', Icon.home, 'Início'], ['dados', Icon.edit, 'Meus dados'], ['diagnostico', Icon.pulse, 'Diagnóstico'], ['objetivos', Icon.target, 'Objetivos'], ['plano', Icon.compass, 'Plano']] as const).map(([k, I, l]) =>
          <button key={k} className={tab === k || (tab === 'simulador' && k === 'plano') ? 'on' : ''} onClick={() => go(k)} aria-current={tab === k ? 'page' : undefined}>
            {(tab === k || (tab === 'simulador' && k === 'plano')) && <motion.span layoutId="navpill" className="navpill" transition={{ type: 'spring', stiffness: 400, damping: 32 }} />}
            <span className="ni"><I /></span>{l}</button>)}
      </nav>
    </div>}
    </MotionConfig>
  );
}

function Empty({ go }: { go: (t: Tab) => void }) {
  return <div className="card center"><p>Cadastre pelo menos uma renda para ver esta tela.</p><button className="btn" onClick={() => go('dados')}>Cadastrar meus dados</button></div>;
}

function Home({ data, hasData, go, upd, setData, onCloseMonth, onTerms }: { data: Data; hasData: boolean; go: (t: Tab | AlertTab) => void; upd: (p: Partial<Data>) => void; setData: (d: Data) => void; onCloseMonth: () => void; onTerms: () => void }) {
  const r = useMemo(() => diagnose(data), [data]);
  const ds = useMemo(() => deltas(data).slice(0, 2), [data]);
  return <>
    <section className="hero">
      <BrandLockup />
      <h1>Saia do vermelho com <span className="gold-text">um plano claro</span>.</h1>
      <p>O JM Finance analisa sua renda, gastos e dívidas, explica sua situação em linguagem simples e diz exatamente o que fazer, passo a passo.</p>
    </section>
    {hasData ? <>
      <ScoreCard r={r} />
      <DailyToday data={data} setIncome={ni => upd({ incomes: data.incomes.map(x => x.id === ni.id ? ni : x) })} />
      <div className="grid2">
        <Stat label="Renda mensal" n={r.income} f={brl0} />
        <Stat label="Saldo do mês" n={r.balance} f={brl0} bad={r.balance < 0} />
        <Stat label="Dívida total" n={r.totalDebt} f={brl0} />
        <Stat label="Reserva" n={r.reserveMonths} f={months} />
      </div>
      <button className="btn full" onClick={() => go('plano')}>Ver meu plano de ação →</button>
      <ExportBtn data={data} />
      <div className="card evo-mini">
        <div className="evo-mini-head"><h3 style={{ margin: 0 }}>Sua evolução</h3><button className="link" onClick={() => go('evolucao')}>Ver gráficos →</button></div>
        {ds.length ? ds.map((x, i) => <div key={i} className={`delta ${x.tone}`}><span>{x.tone === 'good' ? '▲' : x.tone === 'bad' ? '▼' : '•'}</span>{x.text}</div>)
          : <p className="hint">Feche o mês de {ymShort(data.month)} para começar seu histórico e acompanhar a evolução.</p>}
        {needsClosing(data, thisMonth()) && <button className="btn sm" onClick={onCloseMonth}>Fechar {ymShort(data.month)}</button>}
        <Disc /></div>
    </> : <div className="card">
      <h3>Como funciona</h3>
      <ol className="steps-mini"><li>Cadastre renda, gastos e dívidas</li><li>Receba um diagnóstico com nota de saúde financeira</li><li>Siga o plano de ação ordenado</li></ol>
      <button className="btn full" onClick={() => go('dados')}>Começar com meus dados</button>
    </div>}
    <div className="card ex">
      <p><b>Quer só conhecer?</b> Carregue um caso fictício para ver como o app funciona.</p>
      <button className="btn ghost full" onClick={() => { if (!hasData || confirm('Isso substitui seus dados atuais. Continuar?')) { setData(fullExample()); go('diagnostico'); } }}>Carregar dados de EXEMPLO (fictícios)</button>
    </div>
    <p className="disc">O JM Finance é uma ferramenta educativa e não substitui orientação de um profissional certificado. Seus dados ficam apenas neste aparelho. <button className="link" onClick={onTerms}>Termos e privacidade</button></p>
  </>;
}

const months = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} meses`;
const pct1 = (n: number) => pct(n);
const Stat = ({ label, v, n, f, bad, sub }: { label: string; v?: string; n?: number; f?: (n: number) => string; bad?: boolean; sub?: string }) =>
  <motion.div className="stat" whileHover={{ y: -2 }}><small>{label}</small><b className={bad ? 'neg' : ''}>{n !== undefined && f ? <AnimatedNumber value={n} format={f} /> : v}</b>{sub && <small className="stat-sub">{sub}</small>}</motion.div>;

function ScoreCard({ r }: { r: ReturnType<typeof diagnose> }) {
  const c = LEVEL_COLOR[r.level];
  return <div className="card score shimmer">
    <div className="score-top"><ScoreGauge score={r.score} level={r.level} />
      <div><small className="eyebrow">Saúde financeira</small><h2 style={{ color: c }}><span className="status-dot" style={{ background: c }} />{r.level.toUpperCase()}</h2>
        <small className="score-scale">0–39 crítico · 40–59 atenção · 60–79 estável · 80+ saudável</small></div></div>
    <p>{r.levelText}</p><Disc />
  </div>;
}

function num(v: string) { return Number(v.replace(',', '.')) || 0; }

function Inputs({ data, upd, setData, onCloseMonth, goGoals }: { data: Data; upd: (p: Partial<Data>) => void; setData: (d: Data) => void; onCloseMonth: () => void; goGoals?: () => void }) {
  const mark = (p: Partial<Data>) => upd({ ...p, isExample: false });
  const planned = plannedByCategory(data);
  const day = (v: string) => { const n = Math.round(num(v)); return n >= 1 && n <= 31 ? n : undefined; };
  return <>
    <div className="card month-card"><div><small className="eyebrow">Mês atual</small><h3 style={{ margin: 0 }}>{ymTitle(data.month)}</h3></div>
      <button className={`btn sm ${needsClosing(data, thisMonth()) ? '' : 'ghost'}`} onClick={onCloseMonth}>Fechar mês</button></div>
    {data.isExample && <div className="card ex">Você está vendo <b>dados de exemplo fictícios</b>. Edite ou <button className="link" onClick={() => setData(emptyData())}>limpe tudo</button> para usar os seus.</div>}
    <div className="card"><h3>Rendas mensais</h3>
      {data.incomes.map(i => { const setI = (ni: typeof i) => mark({ incomes: data.incomes.map(x => x.id === i.id ? ni : x) }); const vs = i.variable ? varStats(i.history ?? []) : null; const dly = isDaily(i);
        return <div className="income" key={i.id}><div className="row money-row">
        <input className="row-name" aria-label="Nome da renda" placeholder="Nome da renda" value={i.name} onChange={e => setI({ ...i, name: e.target.value })} />
        <MoneyInput label={dly ? 'Por mês, para o plano (calculado pela diária)' : vs?.ok ? 'Valor mensal (base conservadora calculada pelos últimos meses)' : 'Valor mensal da renda'} value={i.amount} readOnly={dly || !!vs?.ok} className={dly || vs?.ok ? 'derived' : ''} onChange={n => setI({ ...i, amount: n ?? 0 })} />
        <button className="x" aria-label="Remover renda" onClick={() => mark({ incomes: data.incomes.filter(x => x.id !== i.id) })}>✕</button></div>
        <label className="chk-line var-toggle"><input type="checkbox" checked={dly} onChange={e => setI(e.target.checked
          ? withDaily({ ...i, kind: 'diaria', variable: false, daily: i.daily ? { ...i.daily, rate: i.daily.rate || Math.round(i.amount / DEFAULT_DAYS) } : { rate: Math.round(i.amount / DEFAULT_DAYS), days: DEFAULT_DAYS, log: {} } })
          : { ...i, kind: 'mensal', amount: Math.round(dailyStats(i).expected) })} />Recebo por dia (diária)</label>
        {!dly && <div className="pay-line"><span>Dia que recebe</span><DayInput value={i.payDay} label={`Dia que recebe ${i.name || 'esta renda'} (opcional)`} onChange={v => setI({ ...i, payDay: day(v) })} /><small>opcional</small></div>}
        {dly ? <DailyFields income={i} onChange={setI} /> : <>
        <label className="chk-line var-toggle"><input type="checkbox" checked={!!i.variable} onChange={e => setI(e.target.checked ? { ...i, variable: true, history: i.history?.length ? i.history : [i.amount, i.amount, i.amount] } : { ...i, variable: false })} />Renda variável (comissão, plantões, freelas…)</label>
        {i.variable && <VarIncome income={i} month={data.month} onChange={setI} />}</>}</div>; })}
      <p className="hint pay-hint2">Recebe em duas vezes (adiantamento + salário)? Lance como duas rendas, cada uma com o seu valor e o dia que cai. Com o dia, o app mostra os dias de aperto do mês.</p>
      <div className="add-row"><button className="btn ghost" onClick={() => mark({ incomes: [...data.incomes, { id: uid(), name: 'Salário', amount: 0 }] })}>+ Adicionar renda</button>
        <button className="btn ghost" onClick={() => mark({ incomes: [...data.incomes, withDaily({ id: uid(), name: 'Diárias', amount: 0, kind: 'diaria', daily: { rate: 0, days: DEFAULT_DAYS, log: {} } })] })}>+ Recebo por dia</button></div>
    </div>
    <ReceivablesCard data={data} upd={upd} />
    <ForecastCard data={data} upd={upd} />
    <div className="card" id="gastos"><h3>Gastos mensais</h3>
      <p className="hint">Planeje quanto quer gastar e anote quanto já gastou para ver se está dentro do plano.</p>
      {(Object.keys(CATEGORIES) as Category[]).filter(c => data.expenses.some(e => e.category === c)).map(c => {
        const label = CATEGORIES[c].label; const items = data.expenses.filter(e => e.category === c);
        const p = planned[c] || 0; const a = data.actuals[c]; const has = a !== undefined;
        const allFixed = items.every(e => e.kind === 'fixa'); const ratio = has && p > 0 ? a / p : has && a > 0 ? 2 : 0; const pc = Math.round(ratio * 100);
        const paid = allFixed && has && p > 0 && Math.abs(a - p) < 0.005;
        const cls = !has ? 'none' : ratio > 1.005 ? 'over' : paid ? 'paid' : ratio >= 0.8 ? 'near' : 'ok';
        const setA = (v?: number) => { const nx = { ...data.actuals }; if (v === undefined) delete nx[c]; else nx[c] = v; mark({ actuals: nx }); };
        const r0 = (n: number) => brl(Math.round(n));
        const sentence = !has ? <>{label}: {r0(p)} planejados. Anote quanto já gastou (opcional) para acompanhar.</>
          : paid ? <>{label}: {items.length > 1 ? 'contas pagas' : 'conta paga'} — {r0(a)} de {r0(p)} planejados (100%).</>
          : <>{label}: você já usou <b>{r0(a)}</b> dos {r0(p)} planejados (<b>{pc}%</b>){cls === 'over' ? <> — <b>{r0(a - p)} acima</b> do plano.</> : cls === 'near' ? <> — restam {r0(p - a)}.</> : '.'}</>;
        return <section className={`cat-card ${cls}`} key={c} aria-label={`Categoria ${label}`}>
          <div className="cat-head"><b>{label}</b><small>{items.length} {items.length === 1 ? 'gasto' : 'gastos'} · {allFixed ? (items.length === 1 ? 'conta fixa' : 'contas fixas') : items.some(e => e.kind === 'fixa') ? 'fixos e que variam' : 'valor varia'}</small></div>
          {items.map(i => <ExpRow key={i.id} e={i} set={pp => mark({ expenses: data.expenses.map(x => x.id === i.id ? withAutoKind({ ...x, ...pp }) : x) })}
            remove={() => mark({ expenses: data.expenses.filter(x => x.id !== i.id) })} day={day} />)}
          <button className="link add-in-cat" onClick={() => mark({ expenses: [...data.expenses, { id: uid(), name: 'Novo gasto', amount: 0, category: c, kind: inferKind(c), kindSet: false }] })}>+ gasto em {label}</button>
          <div className="cat-budget">
            <div className="cat-cells">
              <div className="cat-cell"><small>Planejado</small><b>{brl(p)}</b></div>
              <label className="cat-cell">Gasto até agora<MoneyInput placeholder="opcional" label={`Gasto até agora em ${label}`} value={a} onChange={setA} /></label>
            </div>
            <div className="bbar" role="progressbar" aria-label={`${label}: gasto em relação ao planejado`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, pc)}>
              <motion.div className={cls} initial={{ width: 0 }} animate={{ width: `${Math.min(100, ratio * 100)}%` }} transition={{ duration: 0.6 }} /></div>
            <p className={`cat-sentence ${cls}`}>{sentence}</p>
            {allFixed && p > 0 && <label className="chk-line paid-toggle"><input type="checkbox" checked={paid} onChange={e => setA(e.target.checked ? p : undefined)} />Já paguei {items.length > 1 ? 'as contas' : 'a conta'} deste mês</label>}
          </div>
        </section>; })}
      <button className="btn ghost" onClick={() => mark({ expenses: [...data.expenses, { id: uid(), name: 'Novo gasto', amount: 0, category: 'outros', kind: inferKind('outros'), kindSet: false }] })}>+ Adicionar gasto</button>
    </div>
    <div className="card"><h3>Dívidas</h3>
      <p className="hint">Informe o que você sabe: quanto falta pagar, o valor da parcela e quantas faltam. Se não souber os juros, o app calcula.</p>
      {data.debts.map(i => <DebtCard key={i.id} d={i} set={pp => mark({ debts: data.debts.map(x => x.id === i.id ? { ...x, ...pp } : x) })} remove={() => mark({ debts: data.debts.filter(x => x.id !== i.id) })} />)}
      <button className="btn ghost" onClick={() => mark({ debts: [...data.debts, { id: uid(), name: 'Nova dívida', type: 'outro', balance: 0, rate: 0, minPayment: 0, rateMode: 'calc', rateUnit: 'am' }] })}>+ Adicionar dívida</button>
    </div>
    <div className="card"><h3>Patrimônio (bens e aplicações)</h3>
      <p className="hint">O que você tem: dinheiro em conta, investimentos, previdência, imóvel, carro. Escolha o tipo — o app separa sozinho o que é <b>disponível rápido</b> (conta para emergências).</p>
      {data.assets.map(i => <AssetCard key={i.id} a={i} data={data} mark={mark} goGoals={goGoals} />)}
      <button className="btn ghost" onClick={() => mark({ assets: [...data.assets, { id: uid(), name: 'Novo bem', type: 'outros', value: 0, liquid: false }] })}>+ Adicionar bem</button>
    </div>
    <div className="card"><h3>Reserva de emergência</h3>
      <label className="f-money solo">Quanto você tem guardado hoje<MoneyInput label="Reserva de emergência guardada hoje" value={data.reserve} onChange={n => mark({ reserve: n ?? 0 })} /></label>
    </div>
  </>;
}

/** Uma linha de gasto. "Fixo ou varia" é decidido pelo app; o ajuste manual fica escondido e é opcional. */
function CardSplitBox({ e, set }: { e: Expense; set: (p: Partial<Expense>) => void }) {
  const want = (() => { try { return sessionStorage.getItem('jm:openCard') === e.id; } catch { return false; } })();
  const [open, setOpen] = useState(want); const [soon, setSoon] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (want) { try { sessionStorage.removeItem('jm:openCard'); } catch { /* ok */ } setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const tot = splitSum(e); const rest = e.amount - tot;
  return <div className={`card-split ${open ? 'open' : ''}`} ref={ref}>
    <button type="button" className="adv-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}><span>O que entra na fatura? (opcional)</span>{!open && <small>{tot ? `${brl(tot)} separados` : 'separe por alto'}</small>}<span className="adv-chev" aria-hidden="true">▾</span></button>
    {open && <div className="adv-body">
      <button type="button" className="btn ghost sm photo-bill" onClick={() => setSoon(v => !v)} aria-expanded={soon}>📷 Fotografar fatura (ou enviar PDF) <span className="soon-tag">em breve</span></button>
      {soon && <p className="soon-note" role="status">Em breve o app vai ler a sua fatura e preencher tudo sozinho — você só confere. Por enquanto, coloque os valores aqui embaixo, por alto mesmo. 😉</p>}
      <p className="fhint">Coloque, por alto, quanto da fatura vai para cada coisa. Não precisa fechar certinho. Assim o app enxerga para onde o dinheiro vai.</p>
      <div className="split-grid">{SPLIT.map(x => <label key={x.k}><span>{x.label}</span>
        <MoneyInput label={`${x.label} na fatura`} value={e.split?.[x.k] || 0} onChange={n => { const sp = { ...e.split, [x.k]: n ?? 0 }; Object.keys(sp).forEach(k => { if (!sp[k as SplitKey]) delete sp[k as SplitKey]; }); set({ split: Object.keys(sp).length ? sp : undefined }); }} /></label>)}</div>
      <p className={`split-rest ${rest < -0.5 ? 'over' : ''}`}>{rest < -0.5 ? `As partes somam ${brl(tot)}, mais que a fatura (${brl(e.amount)}). Quer usar ${brl(tot)} como valor da fatura? ` : rest > 0.5 ? `Separados: ${brl(tot)} · sem separar: ${brl(rest)}` : 'Tudo separado. 👍'}
        {rest < -0.5 && <button className="link" onClick={() => set({ amount: Math.round(tot * 100) / 100 })}>Usar {brl(tot)}</button>}</p>
      {(e.split?.parcelas || 0) > 0 && <p className="fhint">Parcelas de compras já estão comprometidas — evite parcelar coisas novas até terminarem.</p>}
    </div>}
  </div>;
}
function ExpRow({ e: i, set: setE, remove, day }: { e: Expense; set: (p: Partial<Expense>) => void; remove: () => void; day: (v: string) => number | undefined }) {
  const [adj, setAdj] = useState(false);
  const auto = inferKind(i.category, i.name);
  return <div className="exp">
    <div className="exp-l1">
      <input className="row-name" aria-label="Nome do gasto" placeholder="Nome do gasto" value={i.name} onChange={e => setE({ name: e.target.value })} />
      <MoneyInput label={`Valor planejado de ${i.name || 'gasto'}`} value={i.amount} onChange={n => setE({ amount: n ?? 0 })} />
      <button className="x" aria-label={`Remover ${i.name || 'gasto'}`} onClick={remove}>✕</button></div>
    <div className="exp-l2">
      <select className="exp-cat" aria-label="Categoria" title="Categoria" value={i.category} onChange={e => setE({ category: e.target.value as Category })}>
        {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k} title={v.label}>{v.short ?? v.label}</option>)}</select>
      <button type="button" className={`kind-chip ${i.kindSet ? 'set' : ''}`} aria-expanded={adj} aria-label={`${i.kind === 'fixa' ? 'Conta fixa' : 'Valor varia'} — ajustar (opcional)`} title="Ajustar (opcional)" onClick={() => setAdj(a => !a)}>{i.kind === 'fixa' ? 'fixo' : 'varia'}</button>
      <DayInput value={i.dueDay} onChange={v => setE({ dueDay: day(v) })} />
    </div>
    {adj && <div className="kind-adj" role="group" aria-label="Este gasto muda de valor?">
      <small>{i.kindSet ? 'Você ajustou:' : 'O app decidiu pelo tipo de gasto:'}</small>
      <label className="chk-line"><input type="radio" name={`k-${i.id}`} checked={i.kind === 'fixa'} onChange={() => setE({ kind: 'fixa', kindSet: auto !== 'fixa' })} />Sempre o mesmo valor (conta fixa)</label>
      <label className="chk-line"><input type="radio" name={`k-${i.id}`} checked={i.kind === 'variavel'} onChange={() => setE({ kind: 'variavel', kindSet: auto !== 'variavel' })} />O valor muda de um mês para outro</label>
      {i.kindSet && <button className="link" onClick={() => setE({ kindSet: false })}>voltar ao automático</button>}
    </div>}
    {i.category === 'cartao' && <CardSplitBox e={i} set={setE} />}
  </div>;
}

function Diagnosis({ data }: { data: Data }) {
  const r = useMemo(() => diagnose(data), [data]);
  const byCat: Record<string, number> = {};
  data.expenses.forEach(e => byCat[CATEGORIES[e.category].label] = (byCat[CATEGORIES[e.category].label] || 0) + e.amount);
  if (r.minPayments) byCat['Parcelas de dívidas'] = r.minPayments;
  const pie = Object.entries(byCat).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const bars = [{ name: 'Renda', valor: r.income }, { name: 'Gastos', valor: r.expenses }, { name: 'Dívidas', valor: r.minPayments }, { name: 'Saldo', valor: r.balance }];
  return <>
    <ScoreCard r={r} />
    <div className="grid2">
      <Stat label="Renda já comprometida" sub="com gastos e parcelas" n={r.commitment} f={pct1} bad={r.commitment > 1} />
      <Stat label="Renda que vai para parcelas" sub="de dívidas" n={r.dti} f={pct1} bad={r.dti > 0.3} />
      <Stat label="Juros pagos por mês" n={r.monthlyInterest} f={brl0} bad={r.monthlyInterest > 0} />
      <Stat label="Reserva de emergência" n={r.reserveMonths} f={months} bad={r.reserveMonths < 1} />
    </div>
    <FlowCard data={data} />
    <div className="card"><h3>O que você tem</h3>
      <div className="grid3">
        <Stat label="Tudo o que você tem" sub="bens + reserva" n={r.totalAssets + r.reserve} f={brl0} />
        <Stat label="Quanto você tem de verdade" sub="bens − dívidas" n={r.netWorth} f={brl0} bad={r.netWorth < 0} />
        <Stat label="Disponível rápido" sub="dinheiro que você consegue usar em poucos dias" n={r.liquidAssets + r.reserve} f={brl0} />
      </div>
      <p className="hint">“Quanto você tem de verdade” é o que sobraria se você vendesse tudo e pagasse todas as dívidas. “Disponível rápido” é a reserva + conta/poupança + investimentos de resgate rápido — é o que conta para emergências.</p>
      <Disc /></div>
    <div className="card"><h3>O que isso significa</h3>
      {r.findings.map((f, i) => <div key={i} className={`finding ${f.tone}`}><b>{f.title}</b><p>{f.text}</p></div>)}<Disc /></div>
    <div className="card"><h3>Para onde vai seu dinheiro</h3>
      <ResponsiveContainer width="100%" height={260}><PieChart><Pie data={pie} dataKey="value" nameKey="name" outerRadius={92} innerRadius={56} paddingAngle={2} stroke="#0d0b09" strokeWidth={2} animationDuration={1100} animationEasing="ease-out">
        {pie.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}</Pie><Tooltip {...TT} formatter={(v) => brl(Number(v))} /><Legend iconType="circle" iconSize={9} itemSorter={null} formatter={legendFmt} wrapperStyle={{ lineHeight: '20px', paddingTop: 6 }} /></PieChart></ResponsiveContainer><Disc /></div>
    <div className="card"><h3>Entradas x saídas</h3>
      <ResponsiveContainer width="100%" height={220}><BarChart data={bars}><CartesianGrid vertical={false} stroke="rgba(247,183,49,.08)" /><XAxis dataKey="name" {...AX} /><YAxis width={58} {...AXY} /><Tooltip {...TT} cursor={{ fill: 'rgba(247,183,49,.06)' }} formatter={(v) => brl(Number(v))} />
        <Bar dataKey="valor" radius={[8, 8, 0, 0]} animationDuration={1000}>{bars.map((b, i) => <Cell key={i} fill={b.valor < 0 ? '#ef4444' : ['url(#barGold)', 'url(#barSilver)', CH.bronze, '#22c55e'][i]} />)}</Bar>
        <defs><linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fdef89" /><stop offset="1" stopColor="#c17925" /></linearGradient>
          <linearGradient id="barSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e5e7ea" /><stop offset="1" stopColor="#7f8b99" /></linearGradient></defs></BarChart></ResponsiveContainer><Disc /></div>
  </>;
}

function Plan({ data, openSim, upd, goForecast }: { data: Data; openSim: () => void; upd: (p: Partial<Data>) => void; goForecast: () => void }) {
  const p = useMemo(() => actionPlan(data), [data]);
  const rec = p.payoff?.rec ?? 'avalanche'; const other = rec === 'avalanche' ? 'snowball' : 'avalanche';
  const tl = (s: 'avalanche' | 'snowball') => (s === 'avalanche' ? p.payoff!.av : p.payoff!.sb).timeline;
  const N1 = `${STRATEGY[rec].name} (recomendado)`, N2 = STRATEGY[other].name;
  const line = p.payoff ? Array.from({ length: Math.max(tl(rec).length, tl(other).length) }, (_, i) => ({ mes: i, [N1]: Math.round(tl(rec)[i]?.saldo ?? 0), [N2]: Math.round(tl(other)[i]?.saldo ?? 0) })) : [];
  const recRes = p.payoff ? (rec === 'avalanche' ? p.payoff.av : p.payoff.sb) : null;
  return <>
    <div className="card"><h3>Seu plano de ação</h3><p className="hint">Siga na ordem. Cada etapa prepara a próxima.</p></div>
    <motion.button className="card sim-item" onClick={openSim} whileTap={{ scale: 0.98 }}><span className="sim-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 18V9M10 18V5M16 18v-6M22 18H2" /></svg></span>
      <span><b>Simulador de decisões</b><small>Financiar ou juntar? Quitar ou investir? Antecipar, consolidar, cortar um gasto — compare lado a lado.</small></span><span className="sim-go">›</span></motion.button>
    {p.steps.map((s, i) => <motion.div className="card step" key={i} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }} transition={{ duration: 0.4, delay: Math.min(i, 3) * 0.05 }}><div className="n">{i + 1}</div><div><h3>{s.title}</h3><p>{s.text}</p>
      {s.items && <ul>{s.items.map((x, j) => <li key={j}>{x}</li>)}</ul>}
      {s.id === 'recv' && <div className="recv-step"><ModeToggle mode={data.settings.recvMode === 'garantido' ? 'garantido' : 'ponderado'} onChange={m => upd({ settings: { ...data.settings, recvMode: m } })} />
        <button className="link" onClick={goForecast}>Ver previsão de recebimentos →</button></div>}<Disc /></div></motion.div>)}
    {p.payoff && <div className="card"><h3>Quando suas dívidas acabam</h3>
      <p className="hint">Quanto falta pagar (somando todas as dívidas) mês a mês, com {brl(p.payoff.budget)}/mês para dívidas. O app recomenda <b>{STRATEGY[rec].name.toLowerCase()}</b>: {STRATEGY[rec].how}.</p>
      <ResponsiveContainer width="100%" height={240}><LineChart data={line}><CartesianGrid strokeDasharray="3 3" stroke="rgba(247,183,49,.08)" /><XAxis dataKey="mes" {...AX} /><YAxis width={58} {...AXY} />
        <Tooltip {...TT} formatter={(v) => brl(Number(v))} labelFormatter={l => `Mês ${l}`} /><Legend formatter={legendFmt} wrapperStyle={{ paddingTop: 6 }} />
        <Line dataKey={N1} stroke="#f7b731" dot={false} strokeWidth={2.5} animationDuration={1400} /><Line dataKey={N2} stroke={CH.silver} strokeDasharray="6 4" dot={false} strokeWidth={2.25} animationDuration={1400} /></LineChart></ResponsiveContainer>
      <table><thead><tr><th>Ordem recomendada</th><th>Juros</th><th>Quitada em</th></tr></thead><tbody>
        {order(data.debts, rec).map(d => <tr key={d.id}><td>{d.name}</td><td>{fmtAm(d.rate)}</td><td>{recRes!.payoff[d.id] ? `mês ${recRes!.payoff[d.id]}` : '—'}</td></tr>)}</tbody></table><Disc />
    </div>}
    <p className="disc">Estimativas simplificadas (juros mês a mês, sem impostos, tarifas ou multas). Confirme os valores com seu banco.</p>
  </>;
}

const fmtYm = (s: string) => { if (!s) return '—'; const [y, m] = s.split('-'); return `${m}/${y}`; };

function Goals({ data, upd }: { data: Data; upd: (p: Partial<Data>) => void }) {
  const ev = useMemo(() => evaluateGoals(data), [data]);
  const set = (id: string, p: Partial<Goal>) => upd({ isExample: false, goals: data.goals.map(g => g.id === id ? { ...g, ...p } : g) });
  const add = () => { const t = new Date(); t.setFullYear(t.getFullYear() + 1);
    upd({ isExample: false, goals: [...data.goals, { id: uid(), name: 'Novo objetivo', type: 'compra', target: 0, date: t.toISOString().slice(0, 7), saved: 0, priority: 'media' }] }); };
  return <>
    <div className="card"><h3>Meus objetivos</h3>
      <p className="hint">Liste o que você quer conquistar. Calculamos quanto guardar por mês e se cabe no seu orçamento depois do plano de dívidas.</p>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <Stat label="Livre para objetivos/mês" n={ev.free} f={brl0} bad={ev.free <= 0} />
        <Stat label="Necessário p/ todos" n={ev.results.reduce((s, x) => s + x.need, 0)} f={brl0} />
      </div>
      {ev.hasDebts && <p className="hint" style={{ marginTop: 8 }}>{ev.payoffMonths ? `Depois de quitar as dívidas (em ~${ev.payoffMonths} meses), sobrarão cerca de ${brl(ev.freeAfter)}/mês para objetivos.` : 'Com o orçamento atual as dívidas não terminam — renegociar é o primeiro passo para liberar dinheiro para objetivos.'}</p>}
      {ev.hasExpensive && <div className="finding bad"><b>Atenção: você tem dívidas caras</b><p>Enquanto existirem dívidas como rotativo ou cheque especial, a prioridade é quitá-las — os juros delas crescem mais rápido do que qualquer objetivo. Por isso só 20% da sua sobra é considerada para objetivos agora.</p></div>}
      {!ev.hasExpensive && ev.hasDebts && <div className="finding warn"><b>Dívidas primeiro</b><p>Enquanto quita as dívidas, 80% da sobra vai para elas e 20% para objetivos.</p></div>}
      <Disc /></div>
    {ev.results.map(({ goal: g, target, months, need, allocated, allocatedAfter, fits, progress, alt, lump, prev }) => <div className="card goal" key={g.id}>
      <div className="goal-head"><ProgressRing value={progress} label={`Progresso ${pct(progress)}`} />
        <div><b className="goal-name">{g.name || 'Objetivo'}</b><small>{brl(g.saved + (prev?.saved || 0))} de {brl(target)}</small>
          <span className={`pill ${fits ? 'ok' : 'warn'}`}>{fits ? 'Cabe no orçamento' : 'Não cabe hoje'}</span></div></div>
      <div className="row"><input value={g.name} onChange={e => set(g.id, { name: e.target.value })} />
        <button className="x" onClick={() => upd({ isExample: false, goals: data.goals.filter(x => x.id !== g.id) })}>✕</button></div>
      <div className="row wrap">
        <label>Tipo<select value={g.type} onChange={e => { const t = e.target.value as GoalType; set(g.id, { type: t, retire: t === 'aposentadoria' ? (g.retire ?? newRetire(30)) : g.retire }); }}>
          {Object.entries(GOAL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Prioridade<select value={g.priority} onChange={e => set(g.id, { priority: e.target.value as Priority })}>
          {Object.entries(PRIORITIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label>Já guardado<MoneyInput label="Já guardado" value={g.saved} onChange={n => set(g.id, { saved: n ?? 0 })} /></label>
      </div>
      {g.type === 'aposentadoria' && g.retire ? <div className="row wrap">
        <label>Renda mensal desejada<MoneyInput label="Renda mensal desejada" value={g.retire.monthlyIncome} onChange={n => set(g.id, { retire: { ...g.retire!, monthlyIncome: n ?? 0 } })} /></label>
        <label>Idade atual<input type="number" value={g.retire.age || ''} onChange={e => set(g.id, { retire: { ...g.retire!, age: num(e.target.value) } })} /></label>
        <label>Aposentar aos<input type="number" value={g.retire.retireAge || ''} onChange={e => set(g.id, { retire: { ...g.retire!, retireAge: num(e.target.value) } })} /></label>
      </div> : <div className="row wrap">
        <label>Valor do objetivo<MoneyInput label="Valor do objetivo" value={g.target} onChange={n => set(g.id, { target: n ?? 0 })} /></label>
        <label>Data alvo<input type="month" value={g.date} onChange={e => set(g.id, { date: e.target.value })} /></label>
      </div>}
      {g.type === 'aposentadoria' && g.retire && <Adv note="rendimento">
        <label className="f-n">Quanto o dinheiro rende acima da inflação (% ao ano)<input type="text" inputMode="decimal" autoComplete="off" aria-label="Rendimento acima da inflação, % ao ano"
          defaultValue={(Math.round(amToAa(g.retire.rate) * 10) / 10).toLocaleString('pt-BR')} key={`${g.id}-${g.retire.rateSet ? 's' : 'd'}`}
          onChange={e => { const v = num(e.target.value); if (v > 0 && v <= 30) set(g.id, { retire: { ...g.retire!, rate: Math.round(aaToAm(v) * 10000) / 10000, rateSet: true } }); }} /></label>
        <small className="fhint">Padrão: {DEFAULT_REAL_AA}% ao ano, conservador. Quanto maior, menos você precisa guardar — mas promete mais do que talvez aconteça.</small>
        {g.retire.rateSet && <button className="link" onClick={() => set(g.id, { retire: { ...g.retire!, rate: DEFAULT_REAL_AM, rateSet: false } })}>voltar ao padrão ({DEFAULT_REAL_AA}% ao ano)</button>}
      </Adv>}
      <div className={`finding ${fits ? 'good' : 'warn'}`}>
        {g.type === 'aposentadoria' && g.retire && <p>Para viver de {brl(g.retire.monthlyIncome)}/mês (valores de hoje) você precisa juntar cerca de <b>{brl(target)}</b> até os {g.retire.retireAge} anos ({Math.round(months / 12)} anos).</p>}
        {g.type === 'aposentadoria' && g.retire && <p className="prev-note rate-note">{g.retire.rateSet ? `Consideramos que o dinheiro guardado rende ${(Math.round(amToAa(g.retire.rate) * 10) / 10).toLocaleString('pt-BR')}% ao ano acima da inflação (valor que você ajustou).` : `Consideramos que o dinheiro guardado rende cerca de ${DEFAULT_REAL_AA}% ao ano acima da inflação — uma estimativa conservadora, para não prometer demais.`}</p>}
        <b>Guardar {brl(need)}/mês {g.type !== 'aposentadoria' && `por ${months} meses`}</b>
        {prev && <p className="prev-note">Já considera {brl(prev.saved)} da sua previdência{prev.monthly > 0 ? ` e os ${brl(prev.monthly)}/mês que você já põe nela, que já estão nos seus gastos — por isso “guardar” é só o que falta além disso` : ''}.{prev.outOfBudget > 0 ? ` Os ${brl(prev.outOfBudget)}/mês que você põe nela ainda não contam: marque “Lançar também em Gastos” em Meus dados › Patrimônio para entrar no plano.` : ''}</p>}
        {lump > 0 && <p className="lump-note">Já considera {brl(Math.round(lump))} de receitas futuras até a data ({data.settings.recvMode === 'garantido' ? 'só o dinheiro certo' : 'contando só parte do que não é certo'}). Só conte com elas quando o dinheiro cair.</p>}
        <p>{fits ? '✅ Cabe no seu orçamento livre atual.' : `⚠️ Não cabe agora: sobram ${brl(allocated)}/mês para este objetivo (pela ordem de prioridade).`}</p>
        {alt && <ul>
          {g.type === 'aposentadoria'
            ? (ev.hasDebts && allocatedAfter >= need ? <li>Depois de quitar as dívidas, guardar {brl(need)}/mês já cabe — comece com o que puder agora e aumente depois.</li>
              : alt.extendMonths > 0 && <li>Guardando o que cabe hoje, leva cerca de {Math.round(alt.extendMonths / 12)} anos — considere adiar um pouco a aposentadoria.</li>)
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
