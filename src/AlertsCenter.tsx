import { useState } from 'react';
import { motion } from 'framer-motion';
import { Alert, AlertTab, enableNotifications, disableNotifications, notifEnabled, notifSupported } from './alerts';
import { DISCLAIMER } from './finance';

export function Bell({ count, onClick }: { count: number; onClick: () => void }) {
  return <button className="bell" onClick={onClick} aria-label={`Alertas${count ? `: ${count} novos` : ''}`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>
    {count > 0 && <motion.span key={count} className="bell-badge" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 20 }}>{count > 9 ? '9+' : count}</motion.span>}
  </button>;
}

const ICON = { bad: '!', warn: '!', info: 'i' };

export function AlertsPanel({ alerts, dismissed, onDismiss, onRestore, onGo, onCloseMonth, onClose, alertTime, onTime, onBackup }: {
  alertTime: string; onTime: (t: string) => void; onBackup: () => void;
  alerts: Alert[]; dismissed: string[]; onDismiss: (id: string) => void; onRestore: () => void; onGo: (t: AlertTab) => void; onCloseMonth: () => void; onClose: () => void;
}) {
  const [notif, setNotif] = useState(notifEnabled());
  const [msg, setMsg] = useState('');
  const active = alerts.filter(a => !dismissed.includes(a.id));
  const hidden = alerts.length - active.length;
  async function toggle() {
    if (notif) { disableNotifications(); setNotif(false); setMsg('Notificações desativadas.'); return; }
    const r = await enableNotifications();
    if (r === 'granted') { setNotif(true); setMsg('Pronto! Você será avisado ao abrir o app (e, no Android com o app instalado, também sobre vencimentos próximos).'); }
    else if (r === 'unsupported') setMsg('Este navegador não suporta notificações. No iPhone, instale o app na tela inicial (iOS 16.4+).');
    else setMsg('Permissão negada. Você pode liberar nas configurações do navegador.');
  }
  return <motion.div className="sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
    <motion.div className="sheet" role="dialog" aria-label="Central de alertas" initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: 0.25 }} onClick={e => e.stopPropagation()}>
      <div className="sheet-head"><h3 style={{ margin: 0 }}>Alertas</h3><button className="chat-back" onClick={onClose} aria-label="Fechar">✕</button></div>
      {!active.length && <p className="hint" style={{ padding: '8px 0' }}>Nenhum alerta no momento. 👌</p>}
      <div className="alert-list">
        {active.map(a => <motion.div layout key={a.id} className={`alert ${a.level}`} exit={{ opacity: 0, x: 40 }}>
          <span className="alert-ico">{ICON[a.level]}</span>
          <div>{a.tag && <small className="alert-tag">{a.tag}</small>}<b>{a.title}</b><p>{a.text}</p>
            <div className="alert-actions">
              {a.action === 'close-month' ? <button className="btn sm" onClick={onCloseMonth}>{a.cta}</button> : a.action === 'backup' ? <button className="btn sm" onClick={onBackup}>{a.cta} →</button> : <button className="btn sm" onClick={() => onGo(a.tab)}>{a.cta} →</button>}
              <button className="link" onClick={() => onDismiss(a.id)}>Dispensar</button>
            </div></div>
        </motion.div>)}
      </div>
      {hidden > 0 && <button className="link" style={{ fontSize: 13 }} onClick={onRestore}>Mostrar {hidden} dispensado{hidden > 1 ? 's' : ''}</button>}
      <div className="notif-box">
        <div><b>Notificações no celular</b>
          <p>{notifSupported() ? 'Avisos aparecem quando você abrir o app. Em celulares Android com o app instalado, lembretes de vencimento também podem chegar com o app fechado (o sistema decide o horário). Avisos garantidos com o app fechado, em qualquer aparelho, vão precisar de um servidor de push no futuro.' : 'Este navegador não oferece notificações.'}</p></div>
        <label className="time-row">Horário preferido dos avisos
          <input type="time" value={alertTime} step={300} onChange={e => e.target.value && onTime(e.target.value)} aria-label="Horário preferido dos avisos" /></label>
        <p className="fine">Antes desse horário o app não envia avisos. Hoje o horário é respeitado quando o app está aberto (ou é aberto depois dele) e, no Android com o app instalado, o sistema verifica em horários próprios — o aviso vem no primeiro horário possível depois do seu. Horário exato garantido só quando tivermos o servidor de push (ele já vai usar esta preferência).</p>
        {notifSupported() && <button className={`btn sm ${notif ? 'ghost' : ''}`} onClick={toggle}>{notif ? 'Desativar' : 'Ativar notificações'}</button>}
        {msg && <p className="hint" style={{ margin: 0 }}>{msg}</p>}
      </div>
      <p className="jm-disc">{DISCLAIMER}</p>
    </motion.div>
  </motion.div>;
}

export function Modal({ title, children, confirm, cancel = 'Agora não', onConfirm, onCancel, danger }: { title: string; children: React.ReactNode; confirm: string; cancel?: string; onConfirm: () => void; onCancel: () => void; danger?: boolean }) {
  return <motion.div className="sheet-wrap center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCancel}>
    <motion.div className="modal" role="dialog" aria-modal="true" aria-label={title} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.94, opacity: 0 }} onClick={e => e.stopPropagation()}>
      <h3>{title}</h3>{children}
      <div className="modal-actions"><button className="btn ghost" onClick={onCancel}>{cancel}</button><button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm}>{confirm}</button></div>
    </motion.div>
  </motion.div>;
}
