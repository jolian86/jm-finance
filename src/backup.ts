// Backup local: exporta/importa todos os dados do app num arquivo JSON (nada sai do aparelho sem o usuário).
import { Data, SCHEMA_VERSION, migrate } from './finance';
import type { ChatMessage } from './ai/types';

export const APP_VERSION = '1.9.0';
export const FORMAT = 'jm-finance-backup';
const CHAT_KEY = 'jmfinance:chat';
const MAX_BYTES = 5 * 1024 * 1024;

export type BackupFile = { format: typeof FORMAT; app: 'JM Finance'; appVersion: string; schemaVersion: number; exportedAt: string; data: Data; chat?: ChatMessage[] };
export type ImportPreview = { fileName: string; exportedAt: string; appVersion: string; schemaVersion: number; migrated: boolean; data: Data; chat?: ChatMessage[] };

const pad = (n: number) => String(n).padStart(2, '0');
export const backupFileName = (d = new Date()) => `JM-Finance-Backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
export const loadChat = (): ChatMessage[] => { try { const v = JSON.parse(localStorage.getItem(CHAT_KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export function buildBackup(data: Data, includeChat: boolean, now = new Date()): BackupFile {
  const chat = includeChat ? loadChat() : undefined;
  return { format: FORMAT, app: 'JM Finance', appVersion: APP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: now.toISOString(), data, ...(chat && chat.length ? { chat } : {}) };
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Gera o arquivo e entrega: no iPhone/iPad, folha de compartilhar (Salvar em Arquivos); senão (ou se falhar), download. */
export async function exportBackup(data: Data, includeChat: boolean): Promise<{ name: string; how: 'shared' | 'downloaded' | 'cancelled' }> {
  const now = new Date(); const name = backupFileName(now);
  const blob = new Blob([JSON.stringify(buildBackup(data, includeChat, now), null, 2)], { type: 'application/json' });
  if (isIOS()) {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return { name, how: 'shared' }; }
      catch (e) { if ((e as Error).name === 'AbortError') return { name, how: 'cancelled' }; /* cai no download */ }
    }
  }
  const url = URL.createObjectURL(blob); const a = document.createElement('a');
  a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return { name, how: 'downloaded' };
}

export class BackupError extends Error {}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const NOT_OURS = 'Esse arquivo não parece ser um backup do JM Finance. Escolha o arquivo "JM-Finance-Backup-….json" que você exportou pelo app.';

/** Valida e migra o conteúdo; lança BackupError com mensagem amigável. */
export function parseBackup(text: string, fileName = 'backup.json'): ImportPreview {
  let raw: unknown;
  try { raw = JSON.parse(text.replace(/^\uFEFF/, '')); } catch { throw new BackupError('Não consegui ler esse arquivo. ' + NOT_OURS); }
  if (!isObj(raw) || raw.format !== FORMAT || !isObj(raw.data)) throw new BackupError(NOT_OURS);
  const v = Number(raw.schemaVersion);
  if (!Number.isInteger(v) || v < 1) throw new BackupError('Esse backup está sem a versão do formato ou danificado. ' + NOT_OURS);
  if (v > SCHEMA_VERSION) throw new BackupError(`Esse backup foi feito numa versão mais nova do JM Finance (formato v${v}; este app lê até v${SCHEMA_VERSION}). Atualize o app (recarregue a página) e tente de novo.`);
  const src = raw.data as Record<string, unknown>;
  for (const k of ['incomes', 'expenses', 'debts', 'assets', 'goals', 'history'])
    if (src[k] !== undefined && !Array.isArray(src[k])) throw new BackupError('O arquivo parece danificado (dados num formato inesperado). Tente outro backup.');
  // limpeza defensiva + migração de versões antigas com a migração existente
  const objs = (k: string) => (Array.isArray(src[k]) ? (src[k] as unknown[]).filter(isObj) : undefined);
  const data = migrate({ ...src, incomes: objs('incomes'), expenses: objs('expenses'), debts: objs('debts'), assets: objs('assets'), goals: objs('goals'), history: objs('history') });
  const num = (x: unknown) => (Number.isFinite(Number(x)) ? Number(x) : 0);
  data.incomes = data.incomes.map(i => ({ ...i, id: String(i.id ?? Math.random()), name: String(i.name ?? ''), amount: num(i.amount) }));
  data.expenses = data.expenses.map(i => ({ ...i, id: String(i.id ?? Math.random()), name: String(i.name ?? ''), amount: num(i.amount) }));
  data.debts = data.debts.map(i => ({ ...i, id: String(i.id ?? Math.random()), name: String(i.name ?? ''), balance: num(i.balance), rate: num(i.rate), minPayment: num(i.minPayment) }));
  data.assets = data.assets.map(i => ({ ...i, id: String(i.id ?? Math.random()), name: String(i.name ?? ''), value: num(i.value) }));
  data.goals = data.goals.map(i => ({ ...i, id: String(i.id ?? Math.random()), name: String(i.name ?? ''), target: num(i.target), saved: num(i.saved) }));
  const exportedAt = typeof raw.exportedAt === 'string' && !Number.isNaN(Date.parse(raw.exportedAt)) ? raw.exportedAt : '';
  // o próprio arquivo é um backup: conta como "último backup"
  if (exportedAt && (!data.settings.lastBackupAt || data.settings.lastBackupAt < exportedAt)) data.settings.lastBackupAt = exportedAt;
  const chat = Array.isArray(raw.chat) ? (raw.chat as unknown[]).filter((m): m is ChatMessage => isObj(m) && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant')) : undefined;
  return { fileName, exportedAt, appVersion: String(raw.appVersion ?? '?'), schemaVersion: v, migrated: v < SCHEMA_VERSION, data, chat };
}

export async function readBackupFile(f: File): Promise<ImportPreview> {
  if (f.size > MAX_BYTES) throw new BackupError('Esse arquivo é grande demais para ser um backup do JM Finance.');
  return parseBackup(await f.text(), f.name);
}

/** Restaura a conversa do backup; se o backup não tiver conversa, mantém a atual. */
export function restoreChat(chat?: ChatMessage[]) {
  if (chat && chat.length) localStorage.setItem(CHAT_KEY, JSON.stringify(chat.slice(-100)));
}
