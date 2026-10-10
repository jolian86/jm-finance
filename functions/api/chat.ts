// Consultor JM com IA (Cloudflare Pages Function). Recebe { history, financialSummary, deviceId } e chama o Gemini.
// Segredo GEMINI_API_KEY (wrangler pages secret put GEMINI_API_KEY). Sem a chave: responde 503 "not_configured" e o app usa o modo simulação.
// Não registra (log) nada dos dados financeiros.
import { SYSTEM_PROMPT, buildContext } from '../../src/ai/prompt';
import type { FinancialSummary } from '../../src/ai/types';

type Env = { GEMINI_API_KEY?: string; GEMINI_MODEL?: string; DAILY_LIMIT?: string; ALLOWED_ORIGINS?: string; JM_AI_LIMITS: KVNamespace };
type Ctx = { request: Request; env: Env };
interface KVNamespace { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> }

const MAX_BODY = 64_000, MAX_MSGS = 20, MAX_MSG_CHARS = 2_000;

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const self = new URL(req.url).origin;
  const ok = origin === self || allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.jm-finance\.pages\.dev$/.test(origin);
  return { ...(ok ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
}
const json = (body: unknown, status: number, h: Record<string, string>) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...h } });

export const onRequestOptions = ({ request, env }: Ctx) => new Response(null, { status: 204, headers: cors(request, env) });
/** status: o app pergunta se a IA está ligada (para mostrar ou não "Modo simulação") */
export const onRequestGet = ({ request, env }: Ctx) => json({ configured: !!env.GEMINI_API_KEY, model: env.GEMINI_MODEL || 'gemini-flash-latest', limit: Number(env.DAILY_LIMIT || 5) }, 200, cors(request, env));

export async function onRequestPost({ request, env }: Ctx) {
  const h = cors(request, env);
  if (!h['Access-Control-Allow-Origin']) return json({ error: 'origin_not_allowed' }, 403, h);
  if (!env.GEMINI_API_KEY) return json({ error: 'not_configured' }, 503, h);
  const raw = await request.text();
  if (raw.length > MAX_BODY) return json({ error: 'too_large' }, 413, h);
  let body: { history?: { role: string; content: string }[]; financialSummary?: FinancialSummary; deviceId?: string };
  try { body = JSON.parse(raw); } catch { return json({ error: 'bad_json' }, 400, h); }
  const dev = String(body.deviceId || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  if (dev.length < 8 || !Array.isArray(body.history) || !body.financialSummary) return json({ error: 'bad_request' }, 400, h);
  const msgs = body.history.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-MAX_MSGS)
    .map(m => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: m.content.slice(0, MAX_MSG_CHARS) }] }));
  if (!msgs.length || msgs[msgs.length - 1].role !== 'user') return json({ error: 'bad_request' }, 400, h);

  // limite por aparelho por dia (id anônimo gerado no aparelho)
  const limit = Number(env.DAILY_LIMIT || 5); const day = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); /* dia no horário de Brasília */ const key = `rl:${day}:${dev}`;
  const used = Number(await env.JM_AI_LIMITS.get(key)) || 0;
  if (used >= limit) return json({ error: 'daily_limit', limit }, 429, h);
  await env.JM_AI_LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 30 });

  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n${buildContext(body.financialSummary)}` }] }, contents: msgs,
      generationConfig: { maxOutputTokens: 8192, temperature: 0.6 } }),
  });
  if (!r.ok) return json({ error: 'upstream', status: r.status }, 502, h); // sem registrar o conteúdo
  const j = await r.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  // o app mostra texto simples: tira restos de markdown
  const reply = (j.candidates?.[0]?.content?.parts ?? []).map(p => p.text || '').join('')
    .replace(/\*\*(.+?)\*\*/g, '$1').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ').replace(/^-{3,}\s*$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  if (!reply) return json({ error: 'empty' }, 502, h);
  return json({ reply, remaining: Math.max(0, limit - used - 1) }, 200, h);
}
