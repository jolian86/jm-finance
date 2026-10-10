import { useState } from 'react';
import { brl } from './finance';
import { Adv } from './ui';
import { compareBuy, buyKind, BUY_DEFAULTS, BuyParams } from './consorcio';

const num = (s: string) => { const x = Number(String(s).replace(/\./g, '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
const mo = (k: number) => k < 24 ? `${k} meses` : `${k} meses (~${Math.round(k / 12)} anos)`;

/** Objetivos (carro, casa, compra grande): à vista × financiamento × consórcio */
export function BuyWays({ name, price }: { name: string; price: number }) {
  const kind = buyKind(name, price); const [p, setP] = useState<BuyParams>(BUY_DEFAULTS[kind]);
  const [open, setOpen] = useState(false);
  if (price < 10_000) return null;
  const c = compareBuy(price, p);
  const F = ({ k, label, suf, max }: { k: keyof BuyParams; label: string; suf: string; max: number }) => <label className="f-n">{label}
    <input type="text" inputMode="decimal" aria-label={label} defaultValue={String(p[k]).replace('.', ',')} onBlur={e => { const v = num(e.target.value); if (v > 0 && v <= max) setP(q => ({ ...q, [k]: v })); }} /><small>{suf}</small></label>;
  return <div className={`buy-ways ${open ? 'open' : ''}`}>
    <button type="button" className="adv-toggle" aria-expanded={open} onClick={() => setOpen(o => !o)}><span>Juntar, financiar ou consórcio?</span>{!open && <small>compare</small>}<span className="adv-chev" aria-hidden="true">▾</span></button>
    {open && <div className="adv-body">
      <p className="fhint">Para {brl(price)} ({kind === 'imovel' ? 'imóvel' : 'veículo ou compra grande'}), com valores típicos de mercado. São estimativas para comparar — confira as propostas reais.</p>
      <div className="buy-grid">
        <div className="buy-col"><b>Juntar e comprar à vista</b>
          <p>Guardando <b>{brl(c.save.monthly)}/mês</b></p><p>Tem o bem em <b>{c.save.months ? mo(c.save.months) : 'muito tempo'}</b></p><p>Custo: <b>{brl(price)}</b>, sem juros{c.save.earned > 0 ? `, e o dinheiro ainda rende ~${brl(c.save.earned)}` : ''}</p>
          <p className="buy-note">À vista dá para negociar desconto.</p></div>
        <div className="buy-col"><b>Financiamento</b>
          <p>Parcela <b>{brl(c.fin.monthly)}/mês</b> por {mo(c.fin.months)}</p><p>Tem o bem <b>agora</b></p><p>Custo total: <b>{brl(c.fin.total)}</b> — <span className="bad-t">{brl(c.fin.extra)} de juros</span></p>
          <p className="buy-note">O bem fica de garantia até a última parcela.</p></div>
        <div className="buy-col"><b>Consórcio</b>
          <p>Parcela <b>{brl(c.cons.monthly)}/mês</b> por {mo(c.cons.months)}</p><p>Tem o bem <b>quando for contemplado</b>: pode ser no 1º mês ou só no último (em média, perto do mês {c.cons.avgWait})</p>
          <p>Custo total: <b>{brl(c.cons.total)}</b> — {brl(c.cons.extra)} de taxa de administração e fundo de reserva, sem juros</p>
          <p className="buy-note">Sorteio todo mês; dar um lance (adiantar parcelas) aumenta a chance. A parcela é corrigida pela inflação (ex.: IPCA ou INCC) e o fundo de reserva pode voltar no fim.</p></div>
      </div>
      <p className="hint">Resumo: o consórcio fica no meio — custa menos que o financiamento, mas você não sabe quando terá o bem. Serve para quem pode esperar. Precisa do bem já? Financiamento, com a parcela cabendo na sobra. Pode esperar e tem disciplina? Juntar é o mais barato.</p>
      <p className="fhint">Não indicamos administradora nem banco. Se for fazer consórcio, confira se a administradora é autorizada pelo Banco Central e leia o contrato (taxas, regras de lance e de desistência).</p>
      <Adv note="juros e taxas">
        <div className="buy-adv"><F k="rate" label="Juros do financiamento" suf="% ao mês" max={10} /><F k="finTerm" label="Parcelas do financiamento" suf="meses" max={420} />
          <F k="adm" label="Taxa de administração (total)" suf="% do bem" max={40} /><F k="consTerm" label="Prazo do consórcio" suf="meses" max={240} /></div>
      </Adv>
    </div>}
  </div>;
}
