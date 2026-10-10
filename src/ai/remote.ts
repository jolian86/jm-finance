import type { ChatProvider, ChatReply } from './types';
import { AI_ENDPOINT_URL } from './prompt';
import { simulatedReply } from './simulated';

/** id anônimo do aparelho (só para o limite diário de perguntas à IA) */
export function deviceId() {
  try { let v = localStorage.getItem('jmfinance:device'); if (!v) { v = crypto.randomUUID(); localStorage.setItem('jmfinance:device', v); } return v; }
  catch { return 'sem-armazenamento-' + Math.random().toString(36).slice(2, 10); }
}
/** a IA está ligada no servidor? (sem chave → o app usa o modo simulação) */
let known: Promise<boolean> | null = null;
export function aiStatus(): Promise<boolean> {
  if (!AI_ENDPOINT_URL) return Promise.resolve(false);
  return known ??= fetch(AI_ENDPOINT_URL, { method: 'GET', cache: 'no-store' }).then(async r => r.ok && !!(await r.json()).configured).catch(() => { known = null; return false; });
}
/** Provedor real: o servidor monta o prompt (src/ai/prompt.ts) e chama o Gemini. Qualquer falha → resposta simulada. */
export const remoteProvider: ChatProvider = {
  id: 'remote', label: 'Consultor JM (IA)', simulated: false,
  async sendMessage(history, financialSummary): Promise<ChatReply> {
    const last = [...history].reverse().find(m => m.role === 'user');
    const fallback = (prefix = '') => { const r = simulatedReply(last?.content ?? '', financialSummary, history.slice(0, -1)); return { ...r, content: prefix + r.content, simulated: true }; };
    if (!(await aiStatus())) return fallback(); // IA ainda não configurada: nem tenta
    try {
      const res = await fetch(AI_ENDPOINT_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId: deviceId(), financialSummary, history: history.map(m => ({ role: m.role, content: m.content })) }) });
      if (res.status === 429) { const n = Number((await res.json().catch(() => ({}))).limit) || 5; return fallback(`Você usou suas ${n} perguntas de hoje. Amanhã tem mais! 😊 Enquanto isso, sigo no modo simulação, com respostas automáticas:\n\n`); }
      if (!res.ok) return fallback();
      const j = await res.json(); const content = String(j.reply ?? '').trim();
      return content ? { content, simulated: false } : fallback();
    } catch { return fallback(); }
  },
};
