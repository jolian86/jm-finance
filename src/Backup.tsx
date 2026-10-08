import { useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Data, brl } from './finance';
import { ymTitle } from './history';
import { Modal } from './AlertsCenter';
import { hasAccepted } from './terms';
import { exportBackup, readBackupFile, restoreChat, loadChat, BackupError, ImportPreview } from './backup';

const fmtDate = (iso?: string) => iso ? new Date(iso).toLocaleDateString('pt-BR') : '';
const fmtDateTime = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };
const daysAgo = (iso: string) => Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 864e5));
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export default function Backup({ data, setData }: { data: Data; setData: (d: Data) => void }) {
  const [withChat, setWithChat] = useState(true);
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const chatCount = loadChat().length;
  const last = data.settings.lastBackupAt;

  const doExport = async () => {
    setMsg(null);
    try {
      const r = await exportBackup(data, withChat);
      if (r.how === 'cancelled') { setMsg({ tone: 'err', text: 'Backup cancelado — nenhum arquivo foi salvo.' }); return; }
      setData({ ...data, settings: { ...data.settings, lastBackupAt: new Date().toISOString() } });
      setMsg({ tone: 'ok', text: `Backup ${r.how === 'shared' ? 'pronto para salvar' : 'baixado'}: ${r.name}. Guarde em local seguro (ex.: Arquivos, Drive ou e-mail para você mesmo).` });
    } catch { setMsg({ tone: 'err', text: 'Não foi possível gerar o backup. Tente de novo.' }); }
  };
  const onFile = async (f?: File) => {
    if (!f) return; setMsg(null); setBusy(true);
    try { setPreview(await readBackupFile(f)); }
    catch (e) { setMsg({ tone: 'err', text: e instanceof BackupError ? e.message : 'Não consegui abrir esse arquivo. Tente de novo.' }); }
    finally { setBusy(false); if (input.current) input.current.value = ''; }
  };
  const confirmImport = () => {
    if (!preview) return;
    restoreChat(preview.chat);
    // mantém o aceite atual dos termos se o backup não tiver um aceite da versão vigente
    const t = hasAccepted(preview.data.settings.terms) ? preview.data.settings.terms : data.settings.terms;
    setData({ ...preview.data, settings: { ...preview.data.settings, terms: t } });
    sessionStorage.setItem('jm:nm', '1');
    setMsg({ tone: 'ok', text: `Backup importado! Seus dados de ${ymTitle(preview.data.month)} foram restaurados.` });
    setPreview(null);
  };

  const p = preview?.data;
  const totalDebt = p ? p.debts.reduce((s, x) => s + x.balance, 0) : 0;
  return <>
    <div className="card backup" id="backup">
      <h3>Backup dos seus dados</h3>
      <p className="hint">Seus dados ficam <b>só neste aparelho</b> — não há conta nem nuvem. Um backup protege você se trocar de celular, limpar o navegador ou desinstalar o app.</p>
      <p className="backup-last">{last ? <>Último backup: <b>{fmtDate(last)}</b> ({daysAgo(last) === 0 ? 'hoje' : `há ${plural(daysAgo(last), 'dia', 'dias')}`})</> : 'Você ainda não fez nenhum backup.'}</p>
      {chatCount > 0 && <label className="chk-line"><input type="checkbox" checked={withChat} onChange={e => setWithChat(e.target.checked)} />Incluir a conversa com o Consultor ({plural(chatCount, 'mensagem', 'mensagens')})</label>}
      <div className="backup-actions">
        <button className="btn" onClick={doExport}>Exportar backup</button>
        <button className="btn ghost" onClick={() => input.current?.click()} disabled={busy}>{busy ? 'Lendo…' : 'Importar backup'}</button>
        <input ref={input} type="file" accept=".json,application/json" hidden onChange={e => onFile(e.target.files?.[0])} aria-label="Escolher arquivo de backup" />
      </div>
      {msg && <p className={`backup-msg ${msg.tone}`} role="status">{msg.text}</p>}
      <p className="fine">O arquivo (.json) guarda seus números sem senha: trate como um documento pessoal. Para restaurar, use “Importar backup” neste ou em outro aparelho.</p>
    </div>
    <AnimatePresence>{preview && p && <Modal danger title="Restaurar este backup?" confirm="Substituir meus dados" cancel="Cancelar" onCancel={() => setPreview(null)} onConfirm={confirmImport}>
      <p className="hint" style={{ marginTop: 0 }}>Arquivo: <b>{preview.fileName}</b></p>
      <ul className="backup-sum">
        <li><span>Exportado em</span><b>{preview.exportedAt ? fmtDateTime(preview.exportedAt) : 'data desconhecida'}</b></li>
        <li><span>Mês dos dados</span><b>{ymTitle(p.month)}</b></li>
        <li><span>Histórico</span><b>{p.history.length ? plural(p.history.length, 'mês fechado', 'meses fechados') : 'nenhum mês fechado'}</b></li>
        <li><span>Objetivos</span><b>{p.goals.length}</b></li>
        <li><span>Dívidas</span><b>{p.debts.length}{p.debts.length ? ` (${brl(Math.round(totalDebt))})` : ''}</b></li>
        <li><span>Rendas · gastos · bens</span><b>{p.incomes.length} · {p.expenses.length} · {p.assets.length}</b></li>
        <li><span>Conversa com o Consultor</span><b>{preview.chat?.length ? plural(preview.chat.length, 'mensagem', 'mensagens') : 'não incluída'}</b></li>
        <li><span>Termos aceitos</span><b>{p.settings.terms ? `versão ${p.settings.terms.version} em ${fmtDate(p.settings.terms.acceptedAt)}` : 'não registrado'}</b></li>
        <li><span>Versão</span><b>app {preview.appVersion} · formato v{preview.schemaVersion}{preview.migrated ? ' (convertido para o formato atual)' : ''}</b></li>
      </ul>
      {p.isExample && <p className="hint">Este backup contém dados de EXEMPLO (fictícios).</p>}
      <div className="danger-box"><b>Atenção:</b> isso substitui <b>todos</b> os dados atuais deste aparelho ({data.incomes.length || data.debts.length || data.goals.length ? `${plural(data.history.length, 'mês', 'meses')} de histórico, ${plural(data.goals.length, 'objetivo', 'objetivos')}, ${plural(data.debts.length, 'dívida', 'dívidas')}` : 'hoje vazio'}) e não dá para desfazer.
        {(data.incomes.length > 0 || data.history.length > 0) && <> Se quiser guardar os atuais, <button className="link" onClick={doExport}>exporte um backup deles antes</button>.</>}</div>
    </Modal>}</AnimatePresence>
  </>;
}
