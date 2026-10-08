// Relatório em PDF gerado 100% no aparelho (jsPDF). Fundo claro para impressão, faixa preta + dourado da marca.
import { jsPDF } from 'jspdf';
import logoUrl from './assets/jm-mark-pdf.jpg';
import { Data, CATEGORIES, DEBT_TYPES, ASSET_TYPES, GOAL_TYPES, DISCLAIMER, Category, brl, diagnose, actionPlan, evaluateGoals, monthsUntil } from './finance';
import { ymTitle, ymShort, plannedByCategory, series, deltas } from './history';
import { allOccurrences, isOpen, CERT, RECV_TYPES, fmtOccDate, lumpSentence } from './recv';

type RGB = [number, number, number];
const INK: RGB = [28, 22, 16], MUTED: RGB = [105, 94, 78], LINE: RGB = [226, 216, 198], CREAM: RGB = [250, 246, 238];
const BLACK: RGB = [10, 9, 8], GOLD: RGB = [247, 183, 49], GOLD_D: RGB = [161, 84, 8], GOLD_M: RGB = [193, 121, 37], GREY: RGB = [127, 139, 153];
const LV: Record<string, RGB> = { 'crítico': [220, 38, 38], 'atenção': [217, 119, 6], 'estável': [101, 163, 13], 'saudável': [22, 163, 74] };
const W = 210, H = 297, M = 16, CW = W - 2 * M, BOTTOM = H - 22;

/** Fontes padrão do PDF usam Latin-1: troca símbolos fora dele. */
const t = (s: string) => s.replace(/[→➜]/g, '->').replace(/[←]/g, '<-').replace(/[≈]/g, '~').replace(/[−–—]/g, '-').replace(/[•]/g, '·')
  .replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, '...').replace(/[▲]/g, '+').replace(/[▼]/g, '-').replace(/\u00a0|\u202f/g, ' ')
  .replace(/[^\x00-\xff]/g, '');
const brl0 = (n: number) => brl(Math.round(n));
const pctf = (n: number) => `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`;
const f1 = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

async function dataUrl(url: string) {
  const b = await (await fetch(url)).blob();
  return await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = rej; r.readAsDataURL(b); });
}

export function reportFileName(d: Data) { return `JM-Finance-Relatorio-${d.month}.pdf`; }

export async function buildReport(d: Data, now = new Date()): Promise<jsPDF> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  doc.setProperties({ title: `JM Finance - Relatório ${ymTitle(d.month)}`, author: 'JM Finance', subject: 'Relatório financeiro pessoal', creator: 'JM Finance' });
  const logo = await dataUrl(logoUrl).catch(() => '');
  const r = diagnose(d), plan = actionPlan(d), goals = evaluateGoals(d);
  let y = 0;
  const col = (c: RGB, kind: 'text' | 'fill' | 'draw' = 'text') => kind === 'text' ? doc.setTextColor(...c) : kind === 'fill' ? doc.setFillColor(...c) : doc.setDrawColor(...c);
  const font = (f: 'times' | 'helvetica', s: 'normal' | 'bold', size: number) => { doc.setFont(f, s); doc.setFontSize(size); };
  const newPage = () => { doc.addPage(); miniHeader(); y = 24; };
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage(); };
  const para = (s: string, size = 10, c: RGB = INK, x = M, w = CW, lh = 1.38) => {
    font('helvetica', 'normal', size); col(c);
    const lines = doc.splitTextToSize(t(s), w) as string[]; const step = size * 0.3528 * lh;
    lines.forEach(l => { ensure(step); doc.text(l, x, y + step * 0.78); y += step; });
  };
  const disc = () => { ensure(7); font('helvetica', 'bold', 8.2); col(GOLD_D); doc.text(t(DISCLAIMER), M, y + 4); y += 7; };
  const section = (title: string, need = 30) => {
    y += 4; ensure(need); col(GOLD, 'fill'); doc.rect(M, y, 1.6, 7, 'F');
    font('times', 'bold', 15); col(INK); doc.text(t(title), M + 4.5, y + 5.6);
    col(LINE, 'draw'); doc.setLineWidth(0.3); doc.line(M + 4.5 + doc.getTextWidth(t(title)) + 3, y + 3.8, W - M, y + 3.8); y += 11;
  };
  type Col = { h: string; w: number; a?: 'r' | 'c' };
  const table = (cols: Col[], rows: string[][], opts: { total?: string[]; tone?: (RGB | undefined)[][] } = {}) => {
    const rowH = 7; const head = () => {
      col(BLACK, 'fill'); doc.rect(M, y, CW, rowH, 'F'); font('helvetica', 'bold', 8.3); col(GOLD);
      let x = M; cols.forEach(c => { const tx = c.a === 'r' ? x + c.w - 2 : c.a === 'c' ? x + c.w / 2 : x + 2; doc.text(t(c.h).toUpperCase(), tx, y + 4.7, { align: c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left' }); x += c.w; });
      y += rowH;
    };
    ensure(rowH * 2 + 2); head();
    const all = opts.total ? [...rows, opts.total] : rows;
    all.forEach((row, i) => {
      const isTotal = !!opts.total && i === all.length - 1;
      font('helvetica', isTotal ? 'bold' : 'normal', 9);
      const wrapped = row.map((v, j) => doc.splitTextToSize(t(v), cols[j].w - 4) as string[]);
      const hh = Math.max(rowH, Math.max(...wrapped.map(w => w.length)) * 4 + 3);
      if (y + hh > BOTTOM) { newPage(); head(); }
      if (isTotal) { col([253, 239, 196], 'fill'); doc.rect(M, y, CW, hh, 'F'); } else if (i % 2) { col(CREAM, 'fill'); doc.rect(M, y, CW, hh, 'F'); }
      let x = M; wrapped.forEach((lines, j) => { const c = cols[j]; col(opts.tone?.[i]?.[j] ?? INK); font('helvetica', isTotal ? 'bold' : 'normal', 9);
        lines.forEach((l, k) => doc.text(l, c.a === 'r' ? x + c.w - 2 : c.a === 'c' ? x + c.w / 2 : x + 2, y + 4.8 + k * 4, { align: c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left' })); x += c.w; });
      col(LINE, 'draw'); doc.setLineWidth(0.2); doc.line(M, y + hh, W - M, y + hh); y += hh;
    });
    y += 3;
  };
  const miniHeader = () => {
    col(BLACK, 'fill'); doc.rect(0, 0, W, 14, 'F'); col(GOLD, 'fill'); doc.rect(0, 14, W, 0.8, 'F');
    if (logo) doc.addImage(logo, 'JPEG', M, 2, 10, 10);
    font('times', 'bold', 12.5); col(GOLD); doc.text('JM Finance', M + 13, 9.2);
    font('helvetica', 'normal', 8.5); col([214, 200, 176]); doc.text(t(`Relatório financeiro · ${ymTitle(d.month)}`), W - M, 9, { align: 'right' });
  };

  // ---------- Capa / cabeçalho ----------
  col(BLACK, 'fill'); doc.rect(0, 0, W, 44, 'F'); col(GOLD, 'fill'); doc.rect(0, 44, W, 1.2, 'F');
  if (logo) doc.addImage(logo, 'JPEG', M, 7, 30, 30);
  font('times', 'bold', 28); col(GOLD); doc.text('JM Finance', M + 36, 21);
  font('helvetica', 'bold', 8); col([253, 239, 137]); doc.setCharSpace(1.6); doc.text('RELATÓRIO FINANCEIRO PESSOAL', M + 36.5, 28.5); doc.setCharSpace(0);
  font('helvetica', 'normal', 10.5); col([240, 232, 218]); doc.text(t(`Referência: ${ymTitle(d.month)}`), M + 36.5, 35);
  const stamp = `Gerado em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  font('helvetica', 'normal', 8.5); col([190, 176, 152]); doc.text(t(stamp), W - M, 35, { align: 'right' });
  y = 52;
  if (d.isExample) { col([254, 243, 199], 'fill'); doc.roundedRect(M, y, CW, 8, 1.5, 1.5, 'F'); font('helvetica', 'bold', 8.8); col(GOLD_D); doc.text('DADOS DE EXEMPLO (FICTÍCIOS) - apenas para demonstração', M + 3, y + 5.3); y += 12; }

  // ---------- Nota de saúde ----------
  section('Saúde financeira', 50);
  const lc = LV[r.level] ?? GOLD_M;
  const bx = y; col(CREAM, 'fill'); col(LINE, 'draw'); doc.setLineWidth(0.3); doc.roundedRect(M, bx, 44, 38, 2, 2, 'FD');
  font('times', 'bold', 34); col(lc); doc.text(String(r.score), M + 22, bx + 18, { align: 'center' });
  font('helvetica', 'normal', 8); col(MUTED); doc.text('de 100', M + 22, bx + 23.5, { align: 'center' });
  font('helvetica', 'bold', 10); col(lc); doc.text(t(r.level.toUpperCase()), M + 22, bx + 31, { align: 'center' });
  // barra de escala
  const sx = M + 50, sw = CW - 50; const bands: [number, number, RGB][] = [[0, 40, LV['crítico']], [40, 60, LV['atenção']], [60, 80, LV['estável']], [80, 100, LV['saudável']]];
  bands.forEach(([a, b, c]) => { col(c, 'fill'); doc.rect(sx + sw * a / 100, bx + 2, sw * (b - a) / 100, 2.6, 'F'); });
  col(BLACK, 'fill'); doc.triangle(sx + sw * r.score / 100 - 1.6, bx + 0, sx + sw * r.score / 100 + 1.6, bx + 0, sx + sw * r.score / 100, bx + 2.4, 'F');
  font('helvetica', 'normal', 7); col(MUTED); doc.text(t('0-39 crítico · 40-59 atenção · 60-79 estável · 80+ saudável'), sx, bx + 8.5);
  y = bx + 12; para(r.levelText, 9.6, INK, sx, sw);
  y = Math.max(y, bx + 38) + 4;
  if (r.findings.length) {
    font('helvetica', 'bold', 9.5); col(INK); ensure(6); doc.text('Principais pontos', M, y + 4); y += 6.5;
    r.findings.slice(0, 5).forEach(f => {
      const c = f.tone === 'bad' ? LV['crítico'] : f.tone === 'warn' ? LV['atenção'] : LV['saudável'];
      ensure(10); col(c, 'fill'); doc.circle(M + 1.3, y + 2.6, 1.1, 'F');
      font('helvetica', 'bold', 9.3); col(INK); const tl = t(f.title); doc.text(tl, M + 4.5, y + 3.6); y += 5;
      para(f.text, 8.8, MUTED, M + 4.5, CW - 4.5, 1.3); y += 1.2;
    });
  }
  disc();

  // ---------- Indicadores ----------
  section('Indicadores do mês', 46);
  const ind: [string, string, string, RGB?][] = [
    ['Renda mensal', brl0(r.income), 'tudo o que entra'],
    ['Gastos do orçamento', brl0(r.expenses), 'contas e despesas'],
    ['Parcelas de dívidas', brl0(r.minPayments), 'pagamentos mínimos'],
    ['Saldo do mês', brl0(r.balance), r.balance < 0 ? 'falta dinheiro' : 'sobra', r.balance < 0 ? LV['crítico'] : LV['saudável']],
    ['Renda comprometida', pctf(r.commitment), 'gastos + parcelas', r.commitment > 1 ? LV['crítico'] : undefined],
    ['Parcelas / renda', pctf(r.dti), 'ideal: até 30%', r.dti > 0.3 ? LV['atenção'] : undefined],
    ['Reserva de emergência', `${f1(r.reserveMonths)} meses`, 'ideal: 6 meses', r.reserveMonths < 1 ? LV['crítico'] : undefined],
    ['Juros pagos por mês', brl0(r.monthlyInterest), 'custo das dívidas', r.monthlyInterest > 0 ? LV['atenção'] : undefined],
  ];
  const bw = (CW - 9) / 4, bh = 19;
  ind.forEach((it, i) => {
    const cx = M + (i % 4) * (bw + 3), cy = y + Math.floor(i / 4) * (bh + 3);
    col(CREAM, 'fill'); col(LINE, 'draw'); doc.setLineWidth(0.25); doc.roundedRect(cx, cy, bw, bh, 1.8, 1.8, 'FD');
    col(GOLD, 'fill'); doc.rect(cx, cy + 3, 0.9, bh - 6, 'F');
    font('helvetica', 'normal', 7.4); col(MUTED); doc.text(t(it[0]), cx + 3.5, cy + 5.6);
    font('helvetica', 'bold', 12); col(it[3] ?? INK); doc.text(t(it[1]), cx + 3.5, cy + 12);
    font('helvetica', 'normal', 6.8); col(MUTED); doc.text(t(it[2]), cx + 3.5, cy + 16.4);
  });
  y += 2 * (bh + 3) + 1; disc();

  // ---------- Patrimônio ----------
  section('Patrimônio', 40);
  para(`Bens: ${brl0(r.totalAssets)} (líquidos: ${brl0(r.liquidAssets)}) · Reserva: ${brl0(d.reserve)} · Dívidas: ${brl0(r.totalDebt)} · Patrimônio líquido: ${brl0(r.netWorth)}`, 9.6);
  y += 2;
  if (d.assets.length) table([{ h: 'Bem', w: 70 }, { h: 'Tipo', w: 50 }, { h: 'Liquidez', w: 28, a: 'c' }, { h: 'Valor', w: CW - 148, a: 'r' }],
    d.assets.map(a => [a.name, ASSET_TYPES[a.type].label, a.liquid ? 'Líquido' : 'Não líquido', brl0(a.value)]),
    { total: ['Patrimônio líquido (bens + reserva - dívidas)', '', '', brl0(r.netWorth)], tone: [...d.assets.map(() => []), [undefined, undefined, undefined, r.netWorth < 0 ? LV['crítico'] : INK]] });
  else para('Nenhum bem cadastrado.', 9, MUTED);
  disc();

  // ---------- Dívidas ----------
  section('Dívidas', 40);
  if (d.debts.length) {
    const ds = [...d.debts].sort((a, b) => b.rate - a.rate);
    table([{ h: 'Dívida', w: 46 }, { h: 'Tipo', w: 34 }, { h: 'Saldo', w: 28, a: 'r' }, { h: 'Juros a.m.', w: 22, a: 'r' }, { h: 'Parcela', w: 24, a: 'r' }, { h: 'Vence', w: CW - 154, a: 'c' }],
      ds.map(x => [x.name, DEBT_TYPES[x.type], brl0(x.balance), `${f1(x.rate)}%`, brl0(x.minPayment), x.dueDay ? `dia ${x.dueDay}` : '-']),
      { total: ['Total', '', brl0(r.totalDebt), '', brl0(r.minPayments), ''], tone: ds.map(x => [undefined, undefined, undefined, x.rate >= 5 ? LV['crítico'] : x.rate >= 2.5 ? LV['atenção'] : undefined]) });
    para('Ordenadas da maior para a menor taxa de juros (as em vermelho são as mais caras).', 8.2, MUTED);
  } else para('Nenhuma dívida cadastrada. Ótimo!', 9.5, LV['saudável']);
  disc();

  // ---------- Orçamento x real ----------
  section('Orçamento planejado x gasto real', 40);
  const planned = plannedByCategory(d); const cats = Object.keys(planned) as Category[];
  const hasAct = Object.values(d.actuals).some(v => (v ?? 0) > 0);
  if (!hasAct) para('Nenhum gasto real lançado neste mês - a coluna "Real" fica em branco. Lance em Meus dados > Gasto real deste mês.', 8.8, MUTED);
  const rows: string[][] = [], tone: (RGB | undefined)[][] = [];
  let tp = 0, ta = 0;
  cats.sort((a, b) => (planned[b] ?? 0) - (planned[a] ?? 0)).forEach(c => {
    const p = planned[c] ?? 0, a = d.actuals[c]; tp += p; ta += a ?? 0;
    const ratio = a !== undefined && p > 0 ? a / p : undefined;
    const variable = d.expenses.some(e => e.category === c && e.kind === 'variavel');
    const lvl = ratio === undefined ? 'none' : ratio > 1.005 ? 'over' : variable && ratio >= 0.8 ? 'near' : !variable && ratio >= 0.995 ? 'paid' : 'ok';
    const st = { none: '-', over: 'Acima do plano', near: 'Perto do limite', paid: 'Conta fixa paga', ok: 'Dentro do plano' }[lvl];
    rows.push([CATEGORIES[c].label, brl0(p), a !== undefined ? brl0(a) : '-', ratio !== undefined ? pctf(ratio) : '-', st]);
    tone.push([undefined, undefined, undefined, undefined, lvl === 'over' ? LV['crítico'] : lvl === 'near' ? LV['atenção'] : lvl === 'ok' ? LV['saudável'] : MUTED]);
  });
  table([{ h: 'Categoria', w: 52 }, { h: 'Planejado', w: 32, a: 'r' }, { h: 'Real', w: 32, a: 'r' }, { h: 'Uso', w: 20, a: 'r' }, { h: 'Situação', w: CW - 136 }], rows,
    { total: ['Total', brl0(tp), hasAct ? brl0(ta) : '-', hasAct && tp ? pctf(ta / tp) : '-', ''], tone });
  disc();

  // ---------- Plano ----------
  section('Plano de ação', 40);
  plan.steps.forEach((s, i) => {
    ensure(16); col(BLACK, 'fill'); doc.circle(M + 3.2, y + 3.2, 3.2, 'F'); font('helvetica', 'bold', 9); col(GOLD); doc.text(String(i + 1), M + 3.2, y + 4.4, { align: 'center' });
    font('helvetica', 'bold', 10.5); col(INK); const tl = doc.splitTextToSize(t(s.title), CW - 10) as string[]; tl.forEach((l, k) => doc.text(l, M + 9, y + 4.4 + k * 4.6)); y += 2 + tl.length * 4.6;
    para(s.text, 9, MUTED, M + 9, CW - 9, 1.32);
    s.items?.forEach(it => { ensure(5); col(GOLD_M, 'fill'); doc.circle(M + 10.4, y + 2.5, 0.65, 'F'); para(it, 8.8, INK, M + 13, CW - 13, 1.3); });
    y += 2.5;
  });
  if (plan.payoff) {
    const { av, sb, budget } = plan.payoff;
    para(`Projeção de quitação com ${brl0(budget)}/mês para dívidas: Avalanche (maior juro primeiro) ${av.feasible ? `${av.months} meses, ${brl0(av.interest)} de juros` : 'não quita em 10 anos'}; Bola de neve (menor saldo primeiro) ${sb.feasible ? `${sb.months} meses, ${brl0(sb.interest)} de juros` : 'não quita em 10 anos'}.`, 9.2);
  }
  disc();

  // ---------- Receitas futuras ----------
  if (d.receivables.length) {
    section('Receitas futuras (12 meses)', 40);
    const fc = plan.recv.fc;
    para(`Previsto: ${brl0(fc.expected)} · ponderado pela chance de receber: ${brl0(fc.weighted)} · garantido: ${brl0(fc.guaranteed)}. O plano usa ${plan.recv.mode === 'garantido' ? 'só o valor garantido' : 'o valor ponderado'}.`, 9.4);
    y += 2;
    const occ = allOccurrences(d).filter(isOpen).slice(0, 14);
    table([{ h: 'Recebimento', w: 62 }, { h: 'Tipo', w: 36 }, { h: 'Quando', w: 22, a: 'c' }, { h: 'Líquido', w: 26, a: 'r' }, { h: 'Certeza', w: CW - 146 }],
      occ.map(o => [o.recv.name + (o.inst.label ? ` (${o.inst.label})` : ''), RECV_TYPES[o.recv.type].label, fmtOccDate(o.ym, o.day), brl0(o.net), o.status === 'atrasado' ? 'ATRASADO' : `${CERT[o.certainty].label}${o.certainty !== 'garantido' ? ` ${o.prob}%` : ''}`]),
      { tone: occ.map(o => [undefined, undefined, undefined, undefined, o.status === 'atrasado' ? LV['crítico'] : o.certainty === 'incerto' ? MUTED : undefined]) });
    plan.recv.lumpsFull.filter(l => l.occ.recv.recurrence !== 'monthly').slice(0, 5).forEach(l => { ensure(6); col(GOLD_M, 'fill'); doc.circle(M + 1.4, y + 2.5, 0.65, 'F'); para(lumpSentence(l), 8.8, INK, M + 4, CW - 4, 1.3); });
    para('Nunca gaste dinheiro incerto antes de ele cair na conta.', 8.8, LV['crítico']);
    disc();
  }

  // ---------- Objetivos ----------
  section('Objetivos', 36);
  if (goals.results.length) {
    table([{ h: 'Objetivo', w: 40 }, { h: 'Tipo', w: 30 }, { h: 'Meta', w: 27, a: 'r' }, { h: 'Guardado', w: 25, a: 'r' }, { h: 'Prazo', w: 22, a: 'c' }, { h: 'Situação', w: CW - 144 }],
      goals.results.map(g => [g.goal.name, GOAL_TYPES[g.goal.type], brl0(g.target), `${brl0(g.goal.saved)} (${pctf(g.progress)})`, g.goal.retire ? `aos ${g.goal.retire.retireAge} anos` : /^\d{4}-\d{2}$/.test(g.goal.date) ? ymShort(g.goal.date) : '-',
        g.fits ? `No ritmo: ${brl0(g.need)}/mês` : `Precisa ajuste: ${brl0(g.need)}/mês (hoje cabem ${brl0(g.allocated)})`]),
      { tone: goals.results.map(g => [undefined, undefined, undefined, undefined, !g.goal.retire && /^\d{4}-\d{2}$/.test(g.goal.date) && monthsUntil(g.goal.date) <= 0 ? LV['crítico'] : undefined, g.fits ? LV['saudável'] : LV['atenção']]) });
  } else para('Nenhum objetivo cadastrado ainda.', 9, MUTED);
  disc();

  // ---------- Evolução ----------
  section('Evolução', 70);
  const pts = series(d);
  if (pts.length < 2) para('Ainda não há meses fechados. Use "Fechar mês" no app para começar o histórico e acompanhar sua evolução aqui.', 9.2, MUTED);
  else {
    const half = (CW - 6) / 2, ch = 46;
    const chart = (x0: number, title: string, vals: number[], kind: 'line' | 'bar', fmt: (n: number) => string, color: RGB, max?: number) => {
      const top = y; col(CREAM, 'fill'); col(LINE, 'draw'); doc.setLineWidth(0.25); doc.roundedRect(x0, top, half, ch + 14, 2, 2, 'FD');
      font('helvetica', 'bold', 9); col(INK); doc.text(t(title), x0 + 4, top + 6);
      const px = x0 + 6, pw = half - 12, py = top + 12, ph = ch - 8; const mx = max ?? Math.max(1, ...vals) * 1.12;
      col(LINE, 'draw'); doc.setLineWidth(0.2); [0, 0.5, 1].forEach(f => doc.line(px, py + ph * (1 - f), px + pw, py + ph * (1 - f)));
      const step = pw / vals.length;
      const xy = vals.map((v, i) => [px + step * (i + 0.5), py + ph * (1 - Math.max(0, v) / mx)] as const);
      if (kind === 'bar') vals.forEach((v, i) => { col(i === vals.length - 1 ? GOLD : GREY, 'fill'); const bh2 = ph * Math.max(0, v) / mx; doc.rect(xy[i][0] - step * 0.3, py + ph - bh2, step * 0.6, bh2, 'F'); });
      else { col(color, 'draw'); doc.setLineWidth(0.8); for (let i = 1; i < xy.length; i++) doc.line(xy[i - 1][0], xy[i - 1][1], xy[i][0], xy[i][1]); col(color, 'fill'); xy.forEach(p => doc.circle(p[0], p[1], 0.9, 'F')); }
      font('helvetica', 'normal', 6.4); col(MUTED);
      pts.forEach((p, i) => doc.text(t(p.label), xy[i][0], py + ph + 4, { align: 'center' }));
      font('helvetica', 'bold', 6.6); col(INK); [0, vals.length - 1].forEach(i => doc.text(t(fmt(vals[i])), xy[i][0], xy[i][1] - 2, { align: 'center' }));
    };
    ensure(ch + 16);
    chart(M, 'Nota de saúde (0-100)', pts.map(p => p.score), 'line', n => String(n), GOLD_M, 100);
    chart(M + half + 6, 'Dívida total (R$)', pts.map(p => p.totalDebt), 'bar', n => n >= 1000 ? `${f1(n / 1000)} mil` : String(n), GREY);
    y += ch + 17;
    para(`* ${pts[pts.length - 1].label.replace('*', '')} = mês atual, ainda em andamento.`, 7.6, MUTED);
    const first = pts[0], last = pts[pts.length - 1];
    para(`Resumo: de ${first.label} a ${last.label.replace('*', '')} a nota foi de ${first.score} para ${last.score}; a dívida total de ${brl0(first.totalDebt)} para ${brl0(last.totalDebt)}; o patrimônio líquido de ${brl0(first.netWorth)} para ${brl0(last.netWorth)}; a reserva de ${f1(first.reserveMonths)} para ${f1(last.reserveMonths)} meses.`, 9.2);
    deltas(d).forEach(x => { ensure(6); font('helvetica', 'bold', 9); col(x.tone === 'good' ? LV['saudável'] : x.tone === 'bad' ? LV['crítico'] : MUTED); doc.text(x.tone === 'good' ? '+' : x.tone === 'bad' ? '-' : '·', M + 1, y + 3.6); para(x.text, 9, INK, M + 5, CW - 5); });
  }
  disc();

  // ---------- Encerramento ----------
  y += 2; ensure(26);
  col(BLACK, 'fill'); doc.roundedRect(M, y, CW, 22, 2, 2, 'F');
  font('times', 'bold', 13); col(GOLD); doc.text(t(DISCLAIMER), W / 2, y + 9, { align: 'center' });
  font('helvetica', 'normal', 7.8); col([214, 200, 176]);
  doc.text(t('Ferramenta educativa: não substitui orientação de profissional certificado. Estimativas simplificadas - confirme valores com seu banco.'), W / 2, y + 15, { align: 'center' });
  doc.text(t('Relatório gerado no seu aparelho. Seus dados não saem dele.'), W / 2, y + 19, { align: 'center' });

  // rodapé em todas as páginas
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); col(LINE, 'draw'); doc.setLineWidth(0.3); doc.line(M, H - 14, W - M, H - 14);
    font('helvetica', 'bold', 7.5); col(GOLD_D); doc.text(t(DISCLAIMER), M, H - 9.5);
    font('helvetica', 'normal', 7.5); col(MUTED); doc.text(t(`JM Finance · ${ymTitle(d.month)} · página ${i} de ${n}`), W - M, H - 9.5, { align: 'right' });
  }
  return doc;
}

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Gera e entrega o PDF: download direto (Android/desktop) ou folha de compartilhar (iPhone/iPad, onde "Salvar em Arquivos" é o caminho confiável). */
export async function exportReport(d: Data) {
  const doc = await buildReport(d);
  const name = reportFileName(d);
  const blob = doc.output('blob');
  if (isIOS()) {
    const file = new File([blob], name, { type: 'application/pdf' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return 'shared'; }
      catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled'; }
    }
    const url = URL.createObjectURL(blob); const w = window.open(url, '_blank'); if (!w) location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60000); return 'opened';
  }
  doc.save(name);
  return 'saved';
}
