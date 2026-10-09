import { useState } from 'react';
import { Income, Data, brl, dailyStats, setDailyDay, withDaily, dayKey, clampDays, DEFAULT_DAYS, DAILY_SAFETY, STATUS_TXT, isDaily } from './finance';
import { MoneyInput } from './ui';

const brl0 = (n: number) => brl(Math.round(n * 100) / 100);
const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const plural = (n: number, a: string, b: string) => `${n} ${n === 1 ? a : b}`;
const fmtN = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

/** Frase do mês atual: "Este mês: 12 dias, R$ 1.800,00 — dentro do esperado". */
export function monthLine(i: Income, now = new Date()) {
  const st = dailyStats(i, now);
  if (!st.loggedDays) return '';
  return `Este mês: ${plural(st.monthDays, 'dia', 'dias')}, ${brl0(st.monthTotal)}${st.status !== 'sem' ? ` — ${STATUS_TXT[st.status]}` : ''}`;
}

/** Campos da renda por dia + explicação do valor mensal + marcação opcional dos dias. */
export function DailyFields({ income: i, onChange, now = new Date() }: { income: Income; onChange: (i: Income) => void; now?: Date }) {
  const st = dailyStats(i, now);
  const set = (p: Partial<NonNullable<Income['daily']>>) => onChange(withDaily({ ...i, daily: { ...(i.daily ?? { rate: 0, days: DEFAULT_DAYS }), ...p } }, now));
  const [daysTxt, setDaysTxt] = useState<string | null>(null);
  return <div className="daily-box">
    <div className="daily-grid">
      <label className="f-money">Quanto ganha por dia<MoneyInput label="Quanto ganha por dia" value={i.daily?.rate} onChange={n => set({ rate: n ?? 0 })} /></label>
      <label className="f-days">Quantos dias costuma trabalhar por mês<input type="number" inputMode="numeric" min={1} max={31} aria-label="Quantos dias costuma trabalhar por mês"
        value={daysTxt ?? String(st.days)} onChange={e => { setDaysTxt(e.target.value); const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 31) set({ days: n }); }} onBlur={() => setDaysTxt(null)} /></label>
    </div>
    {st.rate > 0 && <p className="daily-calc">{brl0(st.rate)} × {plural(st.days, 'dia', 'dias')} ≈ <b>{brl0(st.estimate)} por mês</b></p>}
    {st.learnedRate && <p className="daily-learn">Pelo que você marcou: média de <b>{brl0(st.avgRate)} por dia</b>{st.learnedDays ? <> e <b>{fmtN(st.avgDays)} dias por mês</b></> : ''} ≈ {brl0(st.expected)} por mês.{!st.learnedDays ? ' Os dias por mês o app aprende quando um mês inteiro estiver marcado.' : ''}</p>}
    {st.expected > 0 && <p className="daily-plan">Para o plano, contamos <b>{brl0(st.base)} por mês</b>. {st.usesHistory
      ? <>É a média dos seus meses mais fracos ({st.weak.k} de {st.weak.n}) — assim o orçamento não depende dos meses bons.</>
      : <>São {Math.round(DAILY_SAFETY * 100)}% a menos que o esperado, por segurança: tem mês com menos trabalho, chuva, doença ou feriado.</>}</p>}
    <DailyCalendar income={i} onChange={onChange} now={now} />
  </div>;
}

/** Calendário do mês: toque num dia para marcar que trabalhou; toque de novo para mudar o valor ou desmarcar. Opcional. */
export function DailyCalendar({ income: i, onChange, now = new Date() }: { income: Income; onChange: (i: Income) => void; now?: Date }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const st = dailyStats(i, now); const log = i.daily?.log ?? {};
  const y = now.getFullYear(), m = now.getMonth(); const dim = new Date(y, m + 1, 0).getDate(); const first = new Date(y, m, 1).getDay();
  const keys = Array.from({ length: dim }, (_, k) => dayKey(new Date(y, m, k + 1)));
  const line = monthLine(i, now);
  return <div className={`daily-cal-wrap ${open ? 'open' : ''}`}>
    <button type="button" className="adv-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}><span>Marcar dias trabalhados (opcional)</span>{!open && <small>{line || 'o app aprende com o que você marca'}</small>}<span className="adv-chev" aria-hidden="true">▾</span></button>
    {open && <>
      <p className="fhint">Marque os dias em que trabalhou. Com isso, o app aprende quanto você ganha de verdade por dia e quantos dias trabalha por mês. Não quer marcar? Tudo bem — usamos a sua estimativa.</p>
      <div className="daily-cal" role="group" aria-label="Dias deste mês">
        {WD.map((w, k) => <span key={'w' + k} className="dc-wd" aria-hidden="true">{w}</span>)}
        {Array.from({ length: first }, (_, k) => <span key={'e' + k} />)}
        {keys.map((k, idx) => { const on = log[k] !== undefined; const fut = k > st.today;
          return <button key={k} type="button" disabled={fut} className={`dc-day ${on ? 'on' : ''} ${k === st.today ? 'today' : ''} ${sel === k ? 'sel' : ''}`} aria-pressed={on}
            aria-label={`Dia ${idx + 1}${on ? `: trabalhou, ${brl0(log[k])}` : ''}`}
            onClick={() => { if (!on) { onChange(setDailyDay(i, k, st.rate || st.avgRate)); setSel(k); } else setSel(sel === k ? null : k); }}>{idx + 1}</button>; })}
      </div>
      {sel && log[sel] !== undefined && <div className="dc-edit">
        <label className="f-money">Quanto ganhou no dia {Number(sel.slice(8))}<MoneyInput label={`Quanto ganhou no dia ${Number(sel.slice(8))}`} value={log[sel]} onChange={n => onChange(setDailyDay(i, sel, n ?? 0))} /></label>
        <button type="button" className="link" onClick={() => { onChange(setDailyDay(i, sel, undefined)); setSel(null); }}>desmarcar este dia</button>
      </div>}
      {line && <p className={`daily-month st-${st.status}`}>{line}.{st.status === 'abaixo' ? ` Num mês normal, até hoje seriam uns ${brl0(st.expSoFar)}.` : ''}</p>}
    </>}
  </div>;
}

/** Início: atalho "Trabalhei hoje" para cada renda por dia. */
export function DailyToday({ data, setIncome }: { data: Data; setIncome: (i: Income) => void }) {
  const list = data.incomes.filter(isDaily);
  const [edit, setEdit] = useState<string | null>(null);
  if (!list.length) return null;
  return <div className="card daily-today"><h3>Diárias</h3>
    {list.map(i => { const st = dailyStats(i); const val = i.daily?.log?.[st.today]; const line = monthLine(i);
      return <div key={i.id} className="dt-row">
        <div className="dt-head"><b>{i.name || 'Diária'}</b>{line ? <small className={`st-${st.status}`}>{line}</small> : <small>Marque os dias para o app aprender o seu ritmo (opcional).</small>}</div>
        {st.workedToday ? <div className="dt-done"><span>✓ Hoje: {brl0(val ?? 0)}</span>
          <button type="button" className="link" onClick={() => setEdit(edit === i.id ? null : i.id)}>outro valor</button>
          <button type="button" className="link" onClick={() => { setIncome(setDailyDay(i, st.today, undefined)); setEdit(null); }}>desmarcar</button></div>
          : <button type="button" className="btn sm" onClick={() => setIncome(setDailyDay(i, st.today, st.rate || st.avgRate))}>Trabalhei hoje</button>}
        {edit === i.id && st.workedToday && <label className="f-money dt-val">Quanto ganhou hoje<MoneyInput label="Quanto ganhou hoje" value={val} onChange={n => setIncome(setDailyDay(i, st.today, n ?? 0))} /></label>}
      </div>; })}
  </div>;
}
export { clampDays };
