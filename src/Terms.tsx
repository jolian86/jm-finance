import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Portal, useOverlayLock } from './overlay';
import { BrandLockup } from './ui';
import { Modal } from './AlertsCenter';
import { DISCLAIMER } from './finance';
import { CONTACT, TERMS, PRIVACY, TERMS_VERSION, TERMS_UPDATED, TERMS_DRAFT, ACCEPT_LABEL, Block, TermsAcceptance } from './terms';

const fmtAccept = (iso: string) => { const d = new Date(iso); return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`; };
export const VersionLabel = () => <small className="terms-ver">versão {TERMS_VERSION}{TERMS_DRAFT ? ' · rascunho' : ''} · atualizada em {TERMS_UPDATED}</small>;

const linkify = (x: string) => x.split(CONTACT).flatMap((part, i) => i ? [<a key={i} href={`mailto:${CONTACT}`}>{CONTACT}</a>, part] : [part]);
function Body({ blocks }: { blocks: Block[] }) {
  return <div className="terms-body">{blocks.map(b => <section key={b.h}><h4>{b.h}</h4>{b.p?.map((x, i) => <p key={i}>{linkify(x)}</p>)}{b.ul && <ul>{b.ul.map((x, i) => <li key={i}>{linkify(x)}</li>)}</ul>}</section>)}</div>;
}

function Section({ title, sub, blocks, open, onToggle }: { title: string; sub: string; blocks: Block[]; open: boolean; onToggle: () => void }) {
  const id = title.replace(/\W+/g, '-');
  return <div className={`terms-acc ${open ? 'open' : ''}`}>
    <button className="terms-acc-head" onClick={onToggle} aria-expanded={open} aria-controls={id}>
      <span><b>{title}</b><small>{sub}</small></span><span className="chev" aria-hidden>{open ? '−' : '+'}</span></button>
    <AnimatePresence initial={false}>{open && <motion.div id={id} className="terms-acc-body" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
      <Body blocks={blocks} /></motion.div>}</AnimatePresence>
  </div>;
}

/** Tela de boas-vindas com aceite obrigatório (primeiro uso, usuários antigos e mudança de versão). */
export function Welcome({ prev, hasData, onAccept }: { prev?: TermsAcceptance; hasData: boolean; onAccept: () => void }) {
  useOverlayLock();
  const [ok, setOk] = useState(false);
  const [open, setOpen] = useState<'t' | 'p' | null>(null);
  const changed = !!prev && prev.version !== TERMS_VERSION;
  return <motion.div className="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
    <div className="welcome-in">
      <BrandLockup />
      <h1>{changed ? 'Atualizamos nossos termos' : hasData ? 'Antes de continuar' : <>Bem-vindo à <span className="gold-text">JM Finance</span></>}</h1>
      {changed ? <p className="lead">Os Termos de Uso e a Política de Privacidade mudaram (versão {prev!.version} → {TERMS_VERSION}). Seus dados continuam salvos neste aparelho — só precisamos que você leia e aceite a nova versão.</p>
        : hasData ? <p className="lead">Agora a JM Finance tem Termos de Uso e Política de Privacidade. Seus dados continuam salvos neste aparelho — leia e aceite uma única vez para continuar.</p>
          : <p className="lead">Organize seu dinheiro, entenda sua situação e siga um plano claro para sair do vermelho. Sem cadastro, direto no seu celular.</p>}
      <ul className="welcome-points">
        <li><b>Seus dados ficam só neste aparelho.</b> Nada é enviado para servidores.</li>
        <li><b>Diagnóstico e plano em linguagem simples</b>, com estimativas — não é consultoria profissional.</li>
        <li><b>Você decide.</b> A JM Finance mostra caminhos, prós e contras.</li>
      </ul>
      <Section title="Termos de Uso" sub="O que o app é (e não é), estimativas e responsabilidades" blocks={TERMS} open={open === 't'} onToggle={() => setOpen(open === 't' ? null : 't')} />
      <Section title="Política de Privacidade" sub="Onde seus dados ficam, seus direitos (LGPD) e como apagar" blocks={PRIVACY} open={open === 'p'} onToggle={() => setOpen(open === 'p' ? null : 'p')} />
      <label className={`accept ${ok ? 'on' : ''}`}><input type="checkbox" checked={ok} onChange={e => setOk(e.target.checked)} required aria-required="true" /><span>{ACCEPT_LABEL}</span></label>
      <button className="btn full" disabled={!ok} onClick={onAccept}>Começar</button>
      {!ok && <p className="welcome-need" aria-live="polite">Marque a caixa acima para continuar.</p>}
      <VersionLabel />
      <p className="jm-disc">{DISCLAIMER}</p>
    </div>
  </motion.div>;
}

/** Releitura dos termos (com data do aceite) + apagar todos os dados. */
export function TermsSheet({ acceptance, onClose, onDeleteAll }: { acceptance?: TermsAcceptance; onClose: () => void; onDeleteAll: () => void }) {
  const [view, setView] = useState<'t' | 'p'>('t');
  const [ask, setAsk] = useState(false);
  return <>
    <Portal><motion.div className="sheet-wrap" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="sheet terms-sheet" role="dialog" aria-label="Termos e privacidade" initial={{ y: -24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -24, opacity: 0 }} transition={{ duration: 0.25 }} onClick={e => e.stopPropagation()}>
        <div className="sheet-head"><h3 style={{ margin: 0 }}>Termos e privacidade</h3><button className="chat-back" onClick={onClose} aria-label="Fechar">✕</button></div>
        <div className="accept-status">{acceptance ? <>✓ Você aceitou a <b>versão {acceptance.version}</b> em <b>{fmtAccept(acceptance.acceptedAt)}</b>.</> : 'Aceite ainda não registrado.'}</div>
        <div className="seg" role="tablist">{([['t', 'Termos de Uso'], ['p', 'Privacidade']] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={view === k} className={view === k ? 'on' : ''} onClick={() => setView(k)}>
          {view === k && <motion.span layoutId="termspill" className="segpill" />}<span>{l}</span></button>)}</div>
        <Body blocks={view === 't' ? TERMS : PRIVACY} />
        <VersionLabel />
        <div className="danger-zone"><b>Apagar todos os dados</b><p>Remove dados, histórico, objetivos, conversa e preferências deste aparelho. Não dá para desfazer — se quiser, exporte um backup antes (em Meus dados).</p>
          <button className="btn sm danger" onClick={() => setAsk(true)}>Apagar todos os dados deste aparelho</button></div>
        <p className="jm-disc">{DISCLAIMER}</p>
      </motion.div>
    </motion.div></Portal>
    <AnimatePresence>{ask && <Modal danger title="Apagar todos os dados?" confirm="Apagar tudo" cancel="Cancelar" onCancel={() => setAsk(false)} onConfirm={onDeleteAll}>
      <p>Tudo o que a JM Finance guardou neste aparelho será apagado: renda, gastos, dívidas, bens, objetivos, histórico, conversa com o Consultor, preferências e o aceite dos termos.</p>
      <div className="danger-box">Não dá para desfazer. Sem um backup, os dados não podem ser recuperados.</div>
    </Modal>}</AnimatePresence>
  </>;
}

/** Apaga tudo o que o app guarda neste aparelho. */
export async function deleteAllData() {
  Object.keys(localStorage).filter(k => k.startsWith('jmfinance:')).forEach(k => localStorage.removeItem(k));
  Object.keys(sessionStorage).filter(k => k.startsWith('jm:')).forEach(k => sessionStorage.removeItem(k));
  try { await caches.delete('jm-reminders'); } catch { /* */ }
  try { const reg = await navigator.serviceWorker?.getRegistration(); (await reg?.getNotifications())?.forEach(n => n.close()); } catch { /* */ }
}
