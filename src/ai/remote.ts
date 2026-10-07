import type { ChatProvider } from './types';
import { AI_ENDPOINT_URL, SYSTEM_PROMPT, buildContext } from './prompt';

/** Provedor real (futuro): envia histórico + resumo ao endpoint serverless, que chama o LLM. */
export const remoteProvider: ChatProvider = {
  id: 'remote', label: 'Consultor JM (IA)', simulated: false,
  async sendMessage(history, financialSummary) {
    const res = await fetch(AI_ENDPOINT_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system: SYSTEM_PROMPT, context: buildContext(financialSummary),
        messages: history.map(m => ({ role: m.role, content: m.content })) }),
    });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    const j = await res.json();
    return { content: String(j.reply ?? ''), actions: Array.isArray(j.actions) ? j.actions : undefined };
  },
};
