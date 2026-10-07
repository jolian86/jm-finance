/** Dias úteis no Brasil: fins de semana + feriados nacionais/bancários (lista embutida, sem servidor). */
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const br = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
const addDays = (d: Date, k: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + k);

/** Domingo de Páscoa (algoritmo gregoriano anônimo). */
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const cache: Record<number, Record<string, string>> = {};
/** Feriados nacionais + datas sem expediente bancário (Carnaval, Sexta-feira Santa, Corpus Christi). */
export function holidays(y: number) {
  if (cache[y]) return cache[y];
  const fixed: [string, string][] = [['01-01', 'Confraternização Universal'], ['04-21', 'Tiradentes'], ['05-01', 'Dia do Trabalho'], ['09-07', 'Independência'],
    ['10-12', 'Nossa Senhora Aparecida'], ['11-02', 'Finados'], ['11-15', 'Proclamação da República'], ['11-20', 'Consciência Negra'], ['12-25', 'Natal']];
  const out: Record<string, string> = {}; fixed.forEach(([md, n]) => out[`${y}-${md}`] = n);
  const e = easter(y);
  out[iso(addDays(e, -48))] = 'Carnaval'; out[iso(addDays(e, -47))] = 'Carnaval'; out[iso(addDays(e, -2))] = 'Sexta-feira Santa'; out[iso(addDays(e, 60))] = 'Corpus Christi';
  return (cache[y] = out);
}
export function nonBusinessReason(d: Date): string | null {
  const w = d.getDay(); if (w === 0) return 'domingo'; if (w === 6) return 'sábado';
  const h = holidays(d.getFullYear())[iso(d)]; return h ? `feriado (${h})` : null;
}
export const isBusinessDay = (d: Date) => nonBusinessReason(d) === null;
export function prevBusinessDay(d: Date) { let x = addDays(d, -1); while (!isBusinessDay(x)) x = addDays(x, -1); return x; }
export function nextBusinessDay(d: Date) { let x = d; while (!isBusinessDay(x)) x = addDays(x, 1); return x; }

export type BillStage = { stage: 'today' | 'business' | 'early'; due: Date; days: number; s1: Date; s2: Date; todayIsS2?: boolean; shiftTo?: Date; shiftReason?: string };
/** Data nominal de vencimento (dia do mês) no mês m; dias 29–31 caem no último dia do mês quando necessário. */
export const dueIn = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));
/** Dois lembretes por conta: 3 dias corridos antes e 1 dia útil antes do vencimento. */
export function billStage(day: number, now = new Date()): BillStage | null {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let due = dueIn(today.getFullYear(), today.getMonth(), day);
  if (due < today) due = dueIn(today.getFullYear(), today.getMonth() + 1, day);
  const s1 = addDays(due, -3), s2 = prevBusinessDay(due);
  const days = Math.round((due.getTime() - today.getTime()) / 86400000);
  const reason = nonBusinessReason(due);
  const extra = { todayIsS2: iso(today) === iso(s2), ...(reason ? { shiftTo: nextBusinessDay(due), shiftReason: reason } : {}) };
  if (days === 0) return { stage: 'today', due, days, s1, s2, ...extra };
  if (today >= s2) return { stage: 'business', due, days, s1, s2, ...extra };
  if (today >= s1) return { stage: 'early', due, days, s1, s2, ...extra };
  return null;
}
/** Próximas datas de lembrete (para o service worker), sem lógica de feriados no SW. */
export function upcomingReminders(day: number, now = new Date(), monthsAhead = 2) {
  const out: { stage: 'early' | 'business'; show: Date; due: Date; shiftTo?: Date }[] = [];
  for (let k = 0; k <= monthsAhead; k++) {
    const due = dueIn(now.getFullYear(), now.getMonth() + k, day);
    const shift = nonBusinessReason(due) ? nextBusinessDay(due) : undefined;
    out.push({ stage: 'early', show: addDays(due, -3), due, shiftTo: shift }, { stage: 'business', show: prevBusinessDay(due), due, shiftTo: shift });
  }
  return out;
}
