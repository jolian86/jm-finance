import { useEffect, useLayoutEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { Theme } from './theme';

const FLAG = 'jm:themePicked';
export const pickerDone = () => { try { return localStorage.getItem(FLAG) === '1'; } catch { return true; } };
const markDone = () => { try { localStorage.setItem(FLAG, '1'); } catch { /* sem armazenamento */ } };

const Sun = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" /></svg>;
const Moon = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" /></svg>;

/** mini "tela" do app desenhada com as cores fixas de cada tema */
function Mini({ t }: { t: Theme }) {
  return <div className={`tp-mini tp-mini-${t}`} aria-hidden="true">
    <div className="tpm-head"><i className="tpm-logo" /><i className="tpm-word" /></div>
    <div className="tpm-card"><i className="tpm-ring" /><div><i className="tpm-l w1" /><i className="tpm-l w2 gold" /><i className="tpm-l w3" /></div></div>
    <div className="tpm-row"><i className="tpm-box" /><i className="tpm-box" /></div>
    <div className="tpm-nav"><i /><i className="on" /><i /><i /></div>
  </div>;
}

export function ThemePicker({ theme, onPick, onDone }: { theme: Theme; onPick: (t: Theme) => void; onDone: () => void }) {
  useEffect(() => { onPick(theme); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- grava a escolha atual
  const opt = (t: Theme, label: string, icon: JSX.Element) =>
    <button type="button" role="radio" aria-checked={theme === t} className={`tp-opt ${theme === t ? 'on' : ''}`} onClick={() => onPick(t)}>
      <Mini t={t} />
      <span className="tp-lab"><span className="tp-ic">{icon}</span>{label}</span>
      <span className="tp-check" aria-hidden="true">✓</span>
    </button>;
  return <motion.div className="tp-wrap" role="dialog" aria-modal="true" aria-labelledby="tp-title" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <motion.div className="tp-panel" initial={{ y: 24, scale: .97 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
      <h2 id="tp-title">Como prefere ver o app?</h2>
      <p className="tp-sub">Toque para experimentar. Dá para trocar depois.</p>
      <div className="tp-opts" role="radiogroup" aria-label="Tema">{opt('light', 'Claro', <Sun />)}{opt('dark', 'Escuro', <Moon />)}</div>
      <button type="button" className="btn tp-go" onClick={() => { markDone(); onDone(); }}>Continuar</button>
    </motion.div>
  </motion.div>;
}

export function ThemeTip({ onClose }: { onClose: () => void }) {
  const [r, setR] = useState<DOMRect | null>(null);
  useLayoutEffect(() => {
    const f = () => { const el = document.querySelector('.theme-btn'); if (el) setR(el.getBoundingClientRect()); };
    f(); const id = setTimeout(f, 350); window.addEventListener('resize', f);
    return () => { clearTimeout(id); window.removeEventListener('resize', f); };
  }, []);
  if (!r) return null;
  const cx = r.left + r.width / 2, vw = window.innerWidth;
  const w = Math.min(300, vw - 24), left = Math.max(12, Math.min(cx - w + 40, vw - w - 12));
  return <motion.div className="tip-wrap" onClick={onClose} role="dialog" aria-label="Dica" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
    <div className="tip-hole" style={{ left: r.left - 6, top: r.top - 6, width: r.width + 12, height: r.height + 12 }} />
    <motion.svg className="tip-arrow" style={{ left: cx - 14, top: r.bottom + 8 }} viewBox="0 0 28 40" animate={{ y: [0, 7, 0] }} transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }} aria-hidden="true">
      <path d="M14 38V6M4 15l10-10 10 10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></motion.svg>
    <motion.div className="tip-box" style={{ left, top: r.bottom + 56, width: w }} initial={{ y: 10 }} animate={{ y: 0 }}>
      <p>Você pode trocar quando quiser no botão de sol/lua aqui em cima.</p>
      <span className="tip-ok">Entendi</span>
    </motion.div>
  </motion.div>;
}
