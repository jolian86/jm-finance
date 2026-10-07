import { useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import mark96 from './assets/jm-mark-96.webp';
import mark192 from './assets/jm-mark-192.webp';
import logo768 from './assets/jm-logo-768.webp';

export const STATUS = { 'crítico': '#ef4444', 'atenção': '#f59e0b', 'estável': '#a3e635', 'saudável': '#22c55e' } as Record<string, string>;

/** Número que conta até o valor (respeita prefers-reduced-motion). */
export function AnimatedNumber({ value, format, duration = 1.1 }: { value: number; format: (n: number) => string; duration?: number }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(reduce ? value : 0);
  const prev = useRef(reduce ? value : 0);
  useEffect(() => {
    if (reduce) { setV(value); prev.current = value; return; }
    const c = animate(prev.current, value, { duration, ease: [0.16, 1, 0.3, 1], onUpdate: setV });
    prev.current = value; return () => c.stop();
  }, [value, reduce, duration]);
  return <>{format(v)}</>;
}

/** Medidor radial animado da nota (0–100) com trilha dourada e cor de status. */
export function ScoreGauge({ score, level }: { score: number; level: string }) {
  const reduce = useReducedMotion();
  const R = 52, C = 2 * Math.PI * R, arc = 0.75; // 270°
  const color = STATUS[level] ?? '#f7b731';
  return <div className="gauge" role="img" aria-label={`Nota ${score} de 100, ${level}`}>
    <svg viewBox="0 0 128 128">
      <defs>
        <linearGradient id="gGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fdef89" /><stop offset=".45" stopColor="#f7b731" /><stop offset="1" stopColor="#a15408" /></linearGradient>
        <filter id="glow"><feGaussianBlur stdDeviation="2.2" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>
      <g transform="rotate(135 64 64)">
        <circle cx="64" cy="64" r={R} fill="none" stroke="rgba(247,183,49,.12)" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${C * arc} ${C}`} />
        <motion.circle cx="64" cy="64" r={R} fill="none" stroke="url(#gGold)" strokeWidth="10" strokeLinecap="round" filter="url(#glow)"
          strokeDasharray={`${C * arc} ${C}`} initial={{ strokeDashoffset: reduce ? C * arc * (1 - score / 100) : C * arc }}
          animate={{ strokeDashoffset: C * arc * (1 - score / 100) }} transition={{ duration: reduce ? 0 : 1.4, ease: [0.16, 1, 0.3, 1] }} />
      </g>
    </svg>
    <div className="gauge-center"><b><AnimatedNumber value={score} format={n => String(Math.round(n))} duration={1.4} /></b><small>de 100</small>
      <span className="gauge-dot" style={{ background: color, boxShadow: `0 0 10px ${color}` }} /></div>
  </div>;
}

/** Anel de progresso (objetivos). */
export function ProgressRing({ value, size = 64, label }: { value: number; size?: number; label?: string }) {
  const reduce = useReducedMotion();
  const R = 26, C = 2 * Math.PI * R, p = Math.max(0, Math.min(1, value));
  return <div className="pring" style={{ width: size, height: size }} aria-label={label}>
    <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r={R} fill="none" stroke="rgba(247,183,49,.14)" strokeWidth="6" />
      <motion.circle cx="32" cy="32" r={R} fill="none" stroke="url(#gGoldRing)" strokeWidth="6" strokeLinecap="round" transform="rotate(-90 32 32)"
        strokeDasharray={C} initial={{ strokeDashoffset: reduce ? C * (1 - p) : C }} whileInView={{ strokeDashoffset: C * (1 - p) }} viewport={{ once: true }}
        transition={{ duration: reduce ? 0 : 1.1, ease: [0.16, 1, 0.3, 1] }} />
      <defs><linearGradient id="gGoldRing" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fdef89" /><stop offset="1" stopColor="#c17925" /></linearGradient></defs></svg>
    <span><AnimatedNumber value={p * 100} format={n => `${Math.round(n)}%`} /></span>
  </div>;
}

export function BrandLockup({ small }: { small?: boolean }) {
  return <div className={`lockup ${small ? 'sm' : ''}`}>
    <img src={small ? mark96 : mark192} alt="" width={small ? 34 : 64} height={small ? 34 : 64} />
    <span className="wordmark"><span className="jm">JM</span> <span className="fin">Finance</span></span>
  </div>;
}

/** Splash curta com o logo (pulada se o usuário prefere menos movimento). */
export function Splash({ onDone }: { onDone: () => void }) {
  const reduce = useReducedMotion();
  useEffect(() => { const t = setTimeout(onDone, reduce ? 0 : 1500); return () => clearTimeout(t); }, [onDone, reduce]);
  return <motion.div className="splash" initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.5 }}>
    <motion.img src={logo768} alt="JM Finance" initial={{ scale: 0.86, opacity: 0, filter: 'blur(8px)' }} animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
    <motion.div className="splash-word" initial={{ opacity: 0, y: 10, letterSpacing: '0.6em' }} animate={{ opacity: 1, y: 0, letterSpacing: '0.32em' }} transition={{ delay: 0.35, duration: 0.9 }}>FINANCE</motion.div>
  </motion.div>;
}

const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
export const Icon = {
  home: () => <svg viewBox="0 0 24 24" {...P}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /><path d="M10 21v-6h4v6" /></svg>,
  edit: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 20h4L19 9l-4-4L4 16v4z" /><path d="m13.5 6.5 4 4" /></svg>,
  pulse: () => <svg viewBox="0 0 24 24" {...P}><path d="M3 12h4l2-6 4 12 2-6h6" /></svg>,
  compass: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></svg>,
  target: () => <svg viewBox="0 0 24 24" {...P}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" /></svg>,
  chat: () => <svg viewBox="0 0 24 24" {...P}><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></svg>,
};
