import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Data, DISCLAIMER, uid } from './finance';
import { getProvider, buildSummary, ChatMessage, ChatAction } from './ai';
import type { SimLink } from './ai/types';
import mark from './assets/jm-mark-96.webp';
import { useOverlayLock } from './overlay';

const KEY = 'jmfinance:chat';
const CHIPS = ['Como usar minha PLR?', 'Como sair do vermelho?', 'Qual dívida pagar primeiro?', 'Quero fazer uma viagem de R$ 6 mil', 'Posso financiar um carro de R$ 40 mil?', 'Quanto devo guardar por mês?', 'Vale a pena investir agora?'];
const loadChat = (): ChatMessage[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
const bubble = { initial: { opacity: 0, y: 10, scale: 0.98 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { duration: 0.25 } };

export default function Chat({ data, upd, onClose, goGoals, openSim }: { data: Data; upd: (p: Partial<Data>) => void; onClose: () => void; goGoals: () => void; openSim: (s: SimLink) => void }) {
  useOverlayLock();
  const provider = useMemo(getProvider, []);
  const [msgs, setMsgs] = useState<ChatMessage[]>(loadChat);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-100))); end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, typing]);

  async function send(q: string) {
    q = q.trim(); if (!q || typing) return;
    const history = [...msgs, { id: uid(), role: 'user' as const, content: q, at: Date.now() }];
    setMsgs(history); setText(''); setTyping(true);
    let reply: { content: string; actions?: ChatAction[] };
    try { reply = await provider.sendMessage(history, buildSummary(data)); }
    catch { reply = { content: 'Não consegui responder agora. Tente novamente em instantes.' }; }
    setMsgs(m => [...m, { id: uid(), role: 'assistant', content: reply.content, actions: reply.actions, at: Date.now() }]); setTyping(false);
  }

  function runAction(msgId: string, a: ChatAction) {
    if (a.type === 'open_sim') { openSim(a.sim); return; }
    if (a.type === 'create_goal') {
      upd({ isExample: false, goals: [...data.goals, { id: uid(), name: a.goal.name, type: a.goal.type, target: a.goal.target, date: a.goal.date, saved: 0, priority: 'media' }] });
      setMsgs(m => [...m.map(x => x.id === msgId ? { ...x, done: true } : x),
        { id: uid(), role: 'assistant', content: `Pronto! Criei o objetivo "${a.goal.name}" na aba Objetivos. Você pode ajustar valor, data e prioridade quando quiser.`, at: Date.now() }]);
    }
  }

  return <motion.div className="chat" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
    <div className="chat-head">
      <button className="chat-back" onClick={onClose} aria-label="Fechar">←</button>
      <img src={mark} alt="" width={34} height={34} className="chat-avatar" />
      <div className="chat-title"><b>Consultor JM</b>{provider.simulated && <span className="badge-sim">MODO SIMULAÇÃO</span>}</div>
      {msgs.length > 0 && <button className="link chat-clear" onClick={() => setMsgs([])}>Limpar</button>}
    </div>
    <div className="chat-body">
      <div className="msg bot"><p>Olá! Sou o Consultor JM. Já conheço seus números do app — é só perguntar. Eu mostro opções com prós, contras e riscos; quem decide é você.</p>
        {provider.simulated && <p className="sim-note">Modo simulação: respostas automáticas baseadas em regras e nos seus dados. A IA real ainda não está conectada.</p>}
        <p className="jm-disc">{DISCLAIMER}</p></div>
      {msgs.map(m => <motion.div key={m.id} {...bubble} className={`msg ${m.role === 'user' ? 'me' : 'bot'}`}><p>{m.content}</p>
        {m.actions && !m.done && <div className="msg-actions">{m.actions.map((a, i) => <button key={i} className={`btn sm ${a.type === 'open_sim' ? 'ghost' : ''}`} onClick={() => runAction(m.id, a)}>{a.label}{a.type === 'open_sim' ? ' →' : ''}</button>)}</div>}
        {m.done && <button className="link" onClick={goGoals}>Ver na aba Objetivos →</button>}
        {m.role === 'assistant' && <p className="jm-disc">{DISCLAIMER}</p>}</motion.div>)}
      {typing && <motion.div {...bubble} className="msg bot typing" aria-label="Consultor digitando"><span /><span /><span /></motion.div>}
      <div ref={end} />
    </div>
    <div className="chips">{CHIPS.map(c => <button key={c} onClick={() => send(c)} disabled={typing}>{c}</button>)}</div>
    <form className="chat-input" onSubmit={e => { e.preventDefault(); send(text); }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Pergunte ao Consultor JM..." aria-label="Mensagem" />
      <button className="btn" disabled={!text.trim() || typing}>Enviar</button>
    </form>
  </motion.div>;
}
