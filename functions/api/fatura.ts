// Leitura de fatura do cartão (foto ou PDF) com Gemini. Processa só em memória: não grava nem registra (log) imagens, PDFs ou valores.
// Limite por aparelho por dia: FATURA_LIMIT (padrão 3). Tamanho máximo: ~10 MB de arquivos.
type Env = { GEMINI_API_KEY?: string; GEMINI_MODEL?: string; FATURA_LIMIT?: string; ALLOWED_ORIGINS?: string; JM_AI_LIMITS: KVNamespace };
type Ctx = { request: Request; env: Env };
interface KVNamespace { get(k: string): Promise<string | null>; put(k: string, v: string, o?: { expirationTtl?: number }): Promise<void> }

const MAX_BYTES = 10 * 1024 * 1024, MAX_FILES = 8, MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];
export const CATS = ['mercado', 'delivery', 'compras', 'assinaturas', 'combustivel', 'saude', 'lazer', 'contas', 'outros'] as const;

function cors(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = origin === new URL(req.url).origin || allowed.includes(origin) || /^https:\/\/[a-z0-9-]+\.jm-finance\.pages\.dev$/.test(origin);
  return { ...(ok ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}), 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Cache-Control': 'no-store' };
}
const json = (b: unknown, s: number, h: Record<string, string>) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', ...h } });

const PROMPT = `Você lê faturas de cartão de crédito brasileiras (fotos de uma ou mais páginas, ou PDF).
Extraia SOMENTE o que está escrito na fatura. Não invente valores. Se algo não estiver legível, deixe de fora.
- purchases: cada compra/lançamento do período: date (DD/MM como na fatura), description (como aparece), amount (número positivo em reais; estornos e créditos com valor negativo), installment ("x/y" se for parcela, senão vazio), category.
- category, uma destas: mercado (supermercado, padaria, açougue), delivery (iFood, Rappi, lanches, restaurantes), compras (lojas, roupas, eletrônicos, marketplaces), assinaturas (streaming, apps, serviços mensais recorrentes), combustivel (posto, Uber, 99, pedágio, estacionamento, transporte), saude (farmácia, drogaria, clínicas), lazer (bares, cinema, viagens, eventos), contas (luz, água, internet, telefone, contas da casa), outros (o resto). Parcelas de compras ficam na categoria da compra.
- NÃO inclua como compra: pagamento da fatura anterior, saldo anterior, juros, IOF, encargos, multa e anuidade — some juros/IOF/encargos/multa em "charges" e anuidade em "fees".
- total: valor total da fatura a pagar. dueDate: vencimento (DD/MM/AAAA). cardName: nome do cartão/banco se aparecer. minimumPayment se aparecer.
- Se a imagem não for uma fatura de cartão, devolva notABill=true e listas vazias.`;
const SCHEMA = { type: 'OBJECT', properties: {
  notABill: { type: 'BOOLEAN' }, cardName: { type: 'STRING' }, dueDate: { type: 'STRING' }, total: { type: 'NUMBER' }, minimumPayment: { type: 'NUMBER' }, charges: { type: 'NUMBER' }, fees: { type: 'NUMBER' },
  purchases: { type: 'ARRAY', items: { type: 'OBJECT', properties: { date: { type: 'STRING' }, description: { type: 'STRING' }, amount: { type: 'NUMBER' }, installment: { type: 'STRING' }, category: { type: 'STRING', enum: [...CATS] } }, required: ['description', 'amount', 'category'] } },
}, required: ['notABill', 'purchases'] };

export const onRequestOptions = ({ request, env }: Ctx) => new Response(null, { status: 204, headers: cors(request, env) });
export const onRequestGet = ({ request, env }: Ctx) => json({ configured: !!env.GEMINI_API_KEY, limit: Number(env.FATURA_LIMIT || 3), maxBytes: MAX_BYTES }, 200, cors(request, env));

export async function onRequestPost({ request, env }: Ctx) {
  const h = cors(request, env);
  if (!h['Access-Control-Allow-Origin']) return json({ error: 'origin_not_allowed' }, 403, h);
  if (!env.GEMINI_API_KEY) return json({ error: 'not_configured' }, 503, h);
  if (Number(request.headers.get('Content-Length') || 0) > MAX_BYTES * 1.4) return json({ error: 'too_large' }, 413, h);
  let body: { deviceId?: string; files?: { mime: string; data: string }[] };
  try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400, h); }
  const dev = String(body.deviceId || '').replace(/[^a-zA-Z0-9-]/g, '').slice(0, 64);
  const files = Array.isArray(body.files) ? body.files.filter(f => f && MIMES.includes(f.mime) && typeof f.data === 'string') : [];
  if (dev.length < 8 || !files.length || files.length > MAX_FILES) return json({ error: 'bad_request' }, 400, h);
  if (files.reduce((s, f) => s + f.data.length * 0.75, 0) > MAX_BYTES) return json({ error: 'too_large' }, 413, h);

  const limit = Number(env.FATURA_LIMIT || 3); const day = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10); const key = `fat:${day}:${dev}`;
  const used = Number(await env.JM_AI_LIMITS.get(key)) || 0;
  if (used >= limit) return json({ error: 'daily_limit', limit }, 429, h);

  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [...files.map(f => ({ inlineData: { mimeType: f.mime, data: f.data } })), { text: PROMPT }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 16384, responseMimeType: 'application/json', responseSchema: SCHEMA } }),
  });
  if (!r.ok) return json({ error: 'upstream', status: r.status }, 502, h);
  const j = await r.json() as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[]; usageMetadata?: Record<string, number> };
  let bill: unknown;
  try { bill = JSON.parse((j.candidates?.[0]?.content?.parts ?? []).filter(p => !p.thought).map(p => p.text || '').join('')); } catch { return json({ error: 'unreadable' }, 502, h); }
  await env.JM_AI_LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 30 }); // só conta leitura que deu certo
  const u = j.usageMetadata || {};
  return json({ bill, remaining: Math.max(0, limit - used - 1), usage: { input: u.promptTokenCount || 0, output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0) } }, 200, h);
}
