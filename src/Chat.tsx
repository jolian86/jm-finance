import { useEffect, useMemo, useRef, useState } from 'react';
import { Data, DISCLAIMER, uid } from './finance';
import { getProvider, buildSummary, ChatMessage } from './ai';

const KEY = 'jmfinance:chat';
const CHIPS = ['Como sair do vermelho?', 'Qual dívida pagar primeiro?', 'Posso financiar um carro de R$ 40 mil?', 'Quanto devo guardar por mês?', 'Vale a pena investir agora?', 'Devo vender um bem para quitar dívidas?'];
const loadChat = (): ChatMessage[] => { try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };

export default function Chat({ data, onClose }: { data: Data; onClose: () => void }) {
  const provider = useMemo(getProvider, []);
  const [msgs, setMsgs] = useState<ChatMessage[]>(loadChat);
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(msgs.slice(-100))); end.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, typing]);

  async function send(q: string) {
    q = q.trim(); if (!q || typing) return;
    const history = [...msgs, { id: uid(), role: 'user' as const, content: q, at: Date.now() }];
    setMsgs(history); setText(''); setTyping(true);
    let reply: string;
    try { reply = await provider.sendMessage(history, buildSummary(data)); }
    catch { reply = 'Não consegui responder agora. Tente novamente em instantes.'; }
    setMsgs(m => [...m, { id: uid(), role: 'assistant', content: reply, at: Date.now() }]); setTyping(false);
  }

  return <div className="chat">
    <div className="chat-head">
      <button className="chat-back" onClick={onClose} aria-label="Fechar">←</button>
      <div><b>Consultor JM</b>{provider.simulated && <span className="badge-sim">MODO SIMULAÇÃO</span>}</div>
      {msgs.length > 0 && <button className="link chat-clear" onClick={() => setMsgs([])}>Limpar</button>}
    </div>
    <div className="chat-body">
      <div className="msg bot"><p>Olá! Sou o Consultor JM. Analiso seus números e mostro opções com prós, contras e riscos. Pergunte o que quiser sobre suas finanças.</p>
        {provider.simulated && <p className="sim-note">Modo simulação: respostas automáticas baseadas em regras e nos seus dados. A IA real ainda não está conectada.</p>}
        <p className="jm-disc">{DISCLAIMER}</p></div>
      {msgs.map(m => <div key={m.id} className={`msg ${m.role === 'user' ? 'me' : 'bot'}`}><p>{m.content}</p>{m.role === 'assistant' && <p className="jm-disc">{DISCLAIMER}</p>}</div>)}
      {typing && <div className="msg bot typing"><span /><span /><span /></div>}
      <div ref={end} />
    </div>
    <div className="chips">{CHIPS.map(c => <button key={c} onClick={() => send(c)} disabled={typing}>{c}</button>)}</div>
    <form className="chat-input" onSubmit={e => { e.preventDefault(); send(text); }}>
      <input value={text} onChange={e => setText(e.target.value)} placeholder="Digite sua pergunta..." />
      <button className="btn" disabled={!text.trim() || typing}>Enviar</button>
    </form>
  </div>;
}
