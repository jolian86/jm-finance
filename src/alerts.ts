import { allOccurrences, fmtOccDate, CERT } from './recv';
import { Data, Category, CATEGORIES, diagnose, evaluateGoals, brl, thisMonth, fmtAm, isDaily, dailyStats } from './finance';
import { plannedByCategory, ymShort, needsClosing } from './history';
import { billStage, BillStage, iso, br, upcomingReminders, nonBusinessReason } from './businessDays';

const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
/** Textos dos dois estágios de lembrete de uma conta. */
export function billAlert(name: string, value: number, day: number, st: BillStage) {
  const why = st.shiftReason?.startsWith('feriado') ? `é ${st.shiftReason}` : `cai num ${st.shiftReason}`;
  const shift = st.shiftTo ? ` Como ${br(st.due)} ${why}, o pagamento pode ficar para o próximo dia útil (${WD[st.shiftTo.getDay()]}, ${br(st.shiftTo)}) — confirme com o banco ou a empresa.` : '';
  const base = `Valor previsto: ${brl(value)} (dia ${day}).`;
  const when = `${WD[st.due.getDay()]}, ${br(st.due)}`;
  if (st.stage === 'today') return { title: `${name} vence hoje`, text: `${base}${shift || ' Se ainda não pagou, hoje é o dia.'}` };
  if (st.stage === 'business') {
    if (st.todayIsS2) return { title: st.days === 1 ? `${name} vence amanhã` : `${name}: último dia útil antes do vencimento`,
      text: `${base} Vence ${st.days === 1 ? 'amanhã' : when}; hoje é o último dia útil antes do vencimento.${shift} Pagar em dia evita multa e juros.` };
    return { title: `${name} vence ${st.days === 1 ? 'amanhã' : `em ${st.days} dias`}`,
      text: `${base} Vence ${when} e não há dia útil até lá (o último foi ${WD[st.s2.getDay()]}, ${br(st.s2)}). Se o pagamento for online, ainda dá tempo.${shift}` };
  }
  return { title: `${name} vence em ${st.days} dias`, text: `${base} Vencimento ${when}.${shift} Se não couber, vale negociar antes do vencimento.` };
}

export type AlertTab = 'inicio' | 'dados' | 'diagnostico' | 'plano' | 'objetivos' | 'evolucao';
export type Alert = { tag?: string; id: string; level: 'bad' | 'warn' | 'info'; title: string; text: string; tab: AlertTab; cta: string; dueDate?: string; action?: 'close-month' | 'backup'; anchor?: string };


export function computeAlerts(d: Data, now = new Date()): Alert[] {
  if (!d.incomes.length) return [];
  const out: Alert[] = []; const r = diagnose(d); const cal = thisMonth();
  // mês não fechado
  // lembrete gentil de backup (só dados reais; 30 dias desde o último backup ou desde o primeiro uso)
  const ref = d.settings.lastBackupAt ?? d.settings.firstSeenAt;
  if (!d.isExample && d.incomes.length && ref) {
    const days = Math.floor((Date.now() - Date.parse(ref)) / 864e5);
    if (days > 30) out.push({ id: `backup-${d.month}`, level: 'info', title: 'Faça um backup', text: `${d.settings.lastBackupAt ? `Seu último backup foi há ${days} dias.` : 'Você ainda não fez nenhum backup.'} Seus dados ficam só neste aparelho: um backup leva segundos e protege contra troca de celular ou limpeza do navegador.`, tab: 'dados', cta: 'Fazer backup', action: 'backup' });
  }
  // diárias: mês bem abaixo do esperado (só quando a pessoa marca os dias)
  for (const i of d.incomes.filter(isDaily)) {
    const st = dailyStats(i, now);
    if (st.status === 'abaixo' && now.getDate() >= 10) out.push({ id: `diaria-${i.id}-${thisMonth()}`, level: 'warn', title: `${i.name}: mês mais fraco até agora`,
      text: `Este mês: ${st.monthDays} ${st.monthDays === 1 ? 'dia' : 'dias'}, ${brl(st.monthTotal)}. Num mês normal, até hoje seriam uns ${brl(Math.round(st.expSoFar))}. Se continuar assim, segure os gastos que dá para adiar.`, tab: 'dados', cta: 'Ver diárias' });
  }
  // receitas futuras: atrasadas e chegando em até 3 dias
  for (const o of allOccurrences(d, now, 2)) {
    const nm = `${o.recv.name}${o.inst.label ? ` (${o.inst.label})` : ''}`; const when = fmtOccDate(o.ym, o.day);
    if (o.status === 'atrasado' && o.daysToDue >= -120) out.push({ id: `recv-late-${o.key}`, level: 'warn', tag: 'Recebimento atrasado', title: `${nm} não chegou`, text: `Estava previsto para ${when} (${brl(Math.round(o.net))}, ${CERT[o.certainty].word}). Acompanhe/cobre e, quando cair, marque como recebido — ou ajuste a data ou cancele. Não conte com esse dinheiro até ele cair na conta.`, tab: 'dados', cta: 'Ver receitas futuras', anchor: 'receitas' });
    else if (o.status === 'previsto' && o.daysToDue >= 0 && o.daysToDue <= 3) out.push({ id: `recv-soon-${o.key}`, level: 'info', tag: 'Recebimento chegando', title: o.daysToDue === 0 ? `${nm} deve cair hoje` : `${nm} deve cair em ${o.daysToDue} dia${o.daysToDue > 1 ? 's' : ''}`, text: `${brl(Math.round(o.net))} previsto para ${when} (${CERT[o.certainty].word}). Quando cair, marque como recebido e siga o plano de uso — até lá, não gaste por conta.`, tab: 'dados', cta: 'Ver receitas futuras', anchor: 'receitas' });
  }
  if (needsClosing(d, cal)) out.push({ id: `close-${d.month}`, level: 'info', title: `Feche o mês de ${ymShort(d.month)}`, text: 'Um novo mês começou. Fechar o mês guarda sua foto financeira no histórico para você acompanhar a evolução.', tab: 'evolucao', cta: 'Fechar mês', action: 'close-month' });
  // vencimentos: 1º lembrete 3 dias corridos antes; 2º lembrete 1 dia útil antes (feriados nacionais/bancários)
  const bills = [
    ...d.debts.filter(x => x.dueDay && x.balance > 0).map(x => ({ id: x.id, name: x.name, day: x.dueDay!, value: x.minPayment })),
    ...d.expenses.filter(x => x.dueDay).map(x => ({ id: x.id, name: x.name, day: x.dueDay!, value: x.amount })),
  ];
  bills.forEach(b => {
    const st = billStage(b.day, now); if (!st) return;
    const a = billAlert(b.name, b.value, b.day, st);
    out.push({ tag: st.stage === 'early' ? '1º aviso · 3 dias antes' : st.stage === 'business' ? '2º aviso · 1 dia útil antes' : 'Vencimento hoje', id: `due-${b.id}-${iso(st.due)}-${st.stage}`, level: st.stage === 'early' ? 'warn' : 'bad', title: a.title, text: a.text, tab: 'dados', cta: 'Ver contas', dueDate: iso(st.due) });
  });
  // gasto por categoria x orçamento planejado
  const planned = plannedByCategory(d);
  (Object.keys(d.actuals) as Category[]).forEach(c => {
    const p = planned[c] || 0, a = Number(d.actuals[c]) || 0; if (!p || !a) return;
    const ratio = a / p;
    // contas fixas costumam fechar em 100%: só alertamos quando passam do planejado
    const hasVariable = d.expenses.some(e => e.category === c && e.kind === 'variavel');
    if (ratio > 1.005) out.push({ id: `cat-${c}-${d.month}-100`, level: 'bad', title: `${CATEGORIES[c].label}: orçamento estourado`, text: `Você já gastou ${brl(a)} de ${brl(p)} planejados (${Math.round(ratio * 100)}%). Talvez valha segurar essa categoria até o fim do mês.`, tab: 'dados', cta: 'Ver gastos' });
    else if (ratio >= 0.8 && ratio <= 1.005 && hasVariable && ratio < 1) out.push({ id: `cat-${c}-${d.month}-80`, level: 'warn', title: `${CATEGORIES[c].label}: ${Math.round(ratio * 100)}% do orçamento`, text: `Você já gastou ${brl(a)} de ${brl(p)} planejados. Restam ${brl(p - a)} para o resto do mês.`, tab: 'dados', cta: 'Ver gastos' });
  });
  // dívidas caras abertas
  if (r.expensive.length) out.push({ id: `exp-${d.month}-${r.expensive.map(x => x.id).join('.')}`, level: 'warn', title: `${r.expensive.length === 1 ? 'Dívida cara' : `${r.expensive.length} dívidas caras`} em aberto`, text: `${r.expensive.map(x => `${x.name} (${fmtAm(x.rate)})`).join(', ')}. Juros assim crescem rápido — o plano sugere priorizar renegociação e quitação.`, tab: 'plano', cta: 'Ver plano' });
  // reserva baixa
  if (r.reserveMonths < 1) out.push({ id: `res-${d.month}`, level: 'warn', title: 'Reserva abaixo de 1 mês', text: `Sua reserva cobre ${r.reserveMonths.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mês de custos. Um imprevisto pode virar dívida; uma mini-reserva ajuda a evitar isso.`, tab: 'diagnostico', cta: 'Ver diagnóstico' });
  // objetivos fora do trilho
  const g = evaluateGoals(d);
  const off = g.results.filter(x => !x.fits || (x.goal.date && x.goal.date < cal && x.progress < 1));
  if (off.length) out.push({ id: `goals-${d.month}-${off.map(x => x.goal.id).join('.')}`, level: 'info', title: `${off.length} objetivo${off.length > 1 ? 's' : ''} fora do ritmo`, text: `${off.slice(0, 3).map(x => x.goal.name).join(', ')}${off.length > 3 ? '…' : ''}: o valor a guardar por mês não cabe hoje. A aba Objetivos mostra alternativas de prazo e valor.`, tab: 'objetivos', cta: 'Ver objetivos' });
  // nota caiu
  const last = d.history[d.history.length - 1];
  if (last && r.score < last.score) out.push({ id: `score-${d.month}-${r.score}`, level: 'warn', title: `Sua nota caiu de ${last.score} para ${r.score}`, text: `Comparado a ${ymShort(last.month)}. Veja na Evolução o que mudou.`, tab: 'evolucao', cta: 'Ver evolução' });
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

/* ---------- Notificações locais (sem servidor) ---------- */
const NKEY = 'jmfinance:notified';
export const notifSupported = () => typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
export const notifEnabled = () => notifSupported() && Notification.permission === 'granted' && localStorage.getItem('jmfinance:notif') === '1';

export async function enableNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notifSupported()) return 'unsupported';
  const p = await Notification.requestPermission();
  if (p === 'granted') {
    localStorage.setItem('jmfinance:notif', '1');
    await registerPeriodic();
  }
  return p;
}
export const disableNotifications = () => localStorage.setItem('jmfinance:notif', '0');

/** Mostra notificações locais para alertas novos (bad/warn) — uma vez por alerta por dia. Chamado ao abrir o app. */
/** Minutos até o horário preferido de hoje (<= 0 se já passou). */
export function minutesUntil(alertTime: string, now = new Date()) {
  const [h, m] = alertTime.split(':').map(Number);
  return (h * 60 + m) - (now.getHours() * 60 + now.getMinutes());
}
let timer: ReturnType<typeof setTimeout> | undefined;
/** Respeita o horário escolhido: antes dele, agenda (enquanto o app estiver aberto); depois, notifica. */
export async function notifyNew(alerts: Alert[], base: string, alertTime = '09:00') {
  if (!notifEnabled()) return;
  if (timer) clearTimeout(timer);
  const wait = minutesUntil(alertTime);
  if (wait > 0) { timer = setTimeout(() => { notifyNew(alerts, base, alertTime); }, wait * 60000 + 1000); return; }
  const today = new Date().toISOString().slice(0, 10);
  let seen: Record<string, string> = {}; try { seen = JSON.parse(localStorage.getItem(NKEY) || '{}'); } catch { /* */ }
  const reg = await navigator.serviceWorker.ready;
  for (const a of alerts.filter(x => x.level !== 'info' && seen[x.id] !== today).slice(0, 3)) {
    await reg.showNotification(`JM Finance · ${a.title}`, { body: a.text, tag: a.id, icon: base + 'icons/icon-192.png', badge: base + 'icons/favicon-32.png', data: { url: `${base}?tab=${a.tab}` } });
    seen[a.id] = today;
  }
  localStorage.setItem(NKEY, JSON.stringify(seen));
}

/** Grava lembretes de vencimento no Cache Storage para o service worker usar em Periodic Background Sync (Chrome/Android instalado). */
export async function saveReminders(_alerts: Alert[], d: Data, base: string) {
  if (!('caches' in window)) return;
  const bills = [...d.debts.filter(x => x.dueDay && x.balance > 0).map(x => ({ id: x.id, name: x.name, day: x.dueDay!, value: x.minPayment })), ...d.expenses.filter(x => x.dueDay).map(x => ({ id: x.id, name: x.name, day: x.dueDay!, value: x.amount }))];
  const today = iso(new Date());
  const reminders = bills.flatMap(b => upcomingReminders(b.day).filter(r => iso(r.due) >= today).map(r => {
    const days = Math.round((r.due.getTime() - r.show.getTime()) / 86400000);
    const st: BillStage = { stage: r.stage, due: r.due, days, s1: r.show, s2: r.show, todayIsS2: r.stage === 'business', shiftTo: r.shiftTo, shiftReason: r.shiftTo ? (nonBusinessReason(r.due) ?? undefined) : undefined };
    const t = billAlert(b.name, b.value, b.day, st);
    return { key: `due-${b.id}-${iso(r.due)}-${r.stage}`, show: iso(r.show), due: iso(r.due), title: t.title, body: t.text, url: `${base}?tab=dados` };
  }));
  const c = await caches.open('jm-reminders');
  await c.put('reminders.json', new Response(JSON.stringify({ enabled: notifEnabled(), alertTime: d.settings.alertTime, reminders }), { headers: { 'Content-Type': 'application/json' } }));
}

async function registerPeriodic() {
  try {
    const reg = await navigator.serviceWorker.ready as ServiceWorkerRegistration & { periodicSync?: { register(tag: string, o: { minInterval: number }): Promise<void> } };
    if (!reg.periodicSync) return false;
    const st = await navigator.permissions.query({ name: 'periodic-background-sync' as PermissionName });
    if (st.state !== 'granted') return false;
    await reg.periodicSync.register('jm-reminders', { minInterval: 12 * 60 * 60 * 1000 });
    return true;
  } catch { return false; }
}
