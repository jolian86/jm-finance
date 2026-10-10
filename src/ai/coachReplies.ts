// v15: entendimento mais amplo + respostas de "consultor" (caminho até 80, gasto a gasto, conversa com contexto).
import type { ChatAction, ChatMessage, ChatReply, FinancialSummary as S } from './types';
import { KINDS, guessCategory } from '../coach';

export const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/(.)\1{2,}/g, '$1').replace(/[^a-z0-9$%,./\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const lev = (a: string, b: string) => { const m = a.length, n = b.length; if (Math.abs(m - n) > 2) return 9; const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j; for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[m][n]; };
/** algum token começa com o radical (tolerando 1 erro de digitação em radicais com 5+ letras) */
export const hit = (t: string, stems: string[]) => t.split(' ').some(tok => stems.some(st => tok.startsWith(st) || (st.length >= 5 && tok.length >= st.length - 1 && lev(tok.slice(0, st.length), st) <= 1)));

const MOVE = ['melhor', 'subir', 'sobe', 'aument', 'cheg', 'alcanc', 'ating', 'ficar', 'fica ', 'evolu', 'recuper', 'virar', 'passar', 'mudar', 'sair', 'arrum', 'organiz', 'consert', 'resolv'];
const TOPIC = ['saude', 'nota', 'score', 'pontu', 'estavel', 'saudavel', 'situac', 'financ', 'vermelh', 'critic', 'atencao', 'vida', 'conta', 'dinheiro', 'nivel'];
export const isPath = (t: string) => (hit(t, MOVE) && hit(t, TOPIC)) || /o que (eu )?(posso|devo|preciso|tenho que|da pra|dá pra) fazer|por onde (eu )?comec|me (ajud|orient|da uma dica)|\bdicas?\b|conselh|como (eu )?(melhor|faco|fazer)|caminho|chegar (a|em|no|na) (80|estavel|saudavel)|(nota|score|saude) (boa|melhor|maior)|estou (mal|ruim|perdid)|to (mal|ruim|perdid)/.test(t);
const EXP = ['gast', 'corta', 'corte', 'econom', 'reduz', 'baixa', 'diminu', 'despes', 'sobrar', 'apertad', 'enxug', 'onde estou', 'desperdic'];
export const isExpense = (t: string) => hit(t, EXP) || /conta de|onde (eu )?(gasto|to gastando|estou gastando)|gastando (muito|demais)|muito caro|ta caro|esta caro/.test(t) || KINDS.some(k => k.id !== 'moradia' && k.id !== 'transporte' && k.rx.test(t));
export const askedOthers = (h: ChatMessage[]) => { const last = [...h].reverse().find(m => m.role === 'assistant'); return !!last && /O que entra aí\?|Quer separar o que entra nela\?/.test(last.content); };
export const NAME_RX = /(?:me chama(?:r)? de|pode me chamar de|me chame de|meu nome (?:e|é)|eu sou (?:o|a)|sou (?:o|a))\s+([A-Za-zÀ-ÿ]{2,20})/i;

const asksName = (s: S, h: ChatMessage[]) => !s.userName && !h.some(m => m.role === 'assistant' && /como quer que eu te chame/i.test(m.content));

function othersQ(s: S): [string, ChatAction[]] {
  const o = s.coach.others[0];
  if (!o) return [s.coach.cardParcelas ? `\n\nNa fatura do cartão tem ${brl(s.coach.cardParcelas)} de parcelas de compras — esse dinheiro já está comprometido. Evite parcelar coisas novas até elas terminarem.` : '', []];
  const pc = o.parcelas ? `\n\nE tem ${brl(o.parcelas)} de parcelas de compras na fatura — esse dinheiro já está comprometido. Evite parcelar coisas novas até elas terminarem.` : '';
  const rot = s.coach.hasRevolving ? ' (O rotativo do cartão eu já conto separado, como dívida — aqui é só a fatura do mês.)' : '';
  if (o.kind === 'cartao' && !o.split) return [`\n\nVi que a fatura do cartão (“${o.name}”) leva ${brl(o.amount)} — ${o.sharePct}% dos seus gastos. O cartão esconde para onde o dinheiro vai: mercado, delivery, compras, assinaturas, parcelas… tudo vira uma linha só.${rot} Quer separar o que entra nela? Leva 1 minuto, e aí eu consigo achar onde dá para economizar.${pc}`,
    [{ type: 'card', label: 'Separar o que entra na fatura', expenseId: o.id }]];
  if (o.kind === 'cartao') return [`\n\nDa fatura do cartão, ${brl(o.amount)} ainda estão sem separar. Se conseguir dizer o que é, eu te ajudo a achar onde economizar.${pc}`, [{ type: 'card', label: 'Ver o que entra na fatura', expenseId: o.id }]];
  return [`\n\nVi também que “${o.name}” leva ${brl(o.amount)} (${o.sharePct}% dos seus gastos). O que entra aí? Me conta (por exemplo: “farmácia e presentes”) que eu te ajudo a organizar. Se for a fatura do cartão, toque no botão abaixo — aí dá para separar o que entra nela.`,
    [{ type: 'card', label: 'É a fatura do cartão', expenseId: o.id, toCard: true }]];
}
function tipFor(n: S['coach']['expenseNotes'][0]) {
  return `Vi que você gasta ${brl(n.amount)} em ${n.name}. Para a sua renda, algo perto de ${brl(n.typical)} já seria bom. Que tal tentar:\n${n.tips.slice(0, 3).map(t => '• ' + t).join('\n')}`;
}
const acts = (extra: ChatAction[] = []): ChatAction[] => [{ type: 'go', label: 'Ajustar meus gastos', tab: 'dados' }, { type: 'go', label: 'Ver meu plano', tab: 'plano' }, ...extra];

/** Caminho até 80 (saudável), em conversa. */
export function pathReply(s: S, h: ChatMessage[], intro = '', t = ''): ChatReply {
  const c = s.coach; const P = c.path; const l: string[] = [];
  if (intro) l.push(intro);
  if (s.score >= 80) {
    l.push(`${s.userName ? s.userName + ', p' : 'P'}arabéns: sua nota é ${s.score} — saudável! 🎉 Agora o foco é manter e fazer o dinheiro trabalhar por você.`);
    l.push(`\nPara continuar assim:\n• mantenha a reserva para imprevistos${s.reserveMonths < 6 ? ` (hoje ${s.reserveMonths.toFixed(1).replace('.', ',')} meses; o ideal é 6)` : ' em 6 meses de gastos'};\n• evite parcelas novas que passem de 15% da renda;\n• use a sobra (${brl(Math.max(0, s.balance))} por mês) nos seus objetivos.`);
    if (c.expenseNotes[0]) { const tp = tipFor(c.expenseNotes[0]); l.push(`\nSe quiser sobrar ainda mais: ${tp[0].toLowerCase()}${tp.slice(1)}`); }
    { const [oq, oa] = othersQ(s); return { content: l.join('\n') + oq, actions: [...oa, { type: 'go', label: 'Ver meus objetivos', tab: 'objetivos' }] }; }
  }
  const name = s.userName ? `${s.userName}, s` : 'S';
  l.push(`${name}ua nota hoje é ${s.score} de 100 (${s.level}). A meta é chegar a 80 (saudável) — passando por 60 (estável).`);
  if (c.drivers.length) l.push(`\nO que mais puxa a nota para baixo: ${c.drivers.slice(0, 3).map(d => d.text).join('; ')}.`);
  const cutFirst = P.steps[0]?.kind === 'cortar';
  if (cutFirst) l.push(`\nVamos começar ajustando alguns gastos — é o que depende só de você e faz efeito já no próximo mês.`);
  if (P.steps.length) {
    l.push(`\nCaminho até ${P.reached ? '80' : 'a melhor nota possível'}, passo a passo:`);
    P.steps.forEach((st, i) => l.push(`${i + 1}. ${st.text}.\n   → ${st.to === st.from ? `a nota ainda fica em ${st.from}, mas prepara o próximo passo` : `sua nota vai de ${st.from} para ~${st.to}`}${st.from < 60 && st.to >= 60 && st.to < 80 ? ' (estável)' : st.to >= 80 ? ' (saudável) ✅' : ''}`));
    const k = P.steps.findIndex(x => x.to >= 60) + 1;
    if (/estavel/.test(t) && k > 0 && s.score < 60) l.push(`\nPara ficar estável (60 ou mais), ${k === 1 ? 'o passo 1 já basta' : `os passos 1 ${k === 2 ? 'e' : 'a'} ${k} bastam`}. Seguindo até o fim, você chega a saudável.`);
    if (!P.reached) l.push(`\nCom isso você chega a ~${P.end}. Daí em diante, cada mês guardando a sobra na reserva aproxima você dos 80.`);
  }
  const top = c.expenseNotes[0];
  if (top) l.push(`\n${tipFor(top)}`);
  const [oq, oa] = othersQ(s); let txt = l.join('\n') + oq;
  if (asksName(s, h)) txt += '\n\nAh, e como quer que eu te chame? É só escrever “me chama de …”.';
  const extra: ChatAction[] = P.steps.some(x => x.kind === 'divida_cara') ? [{ type: 'open_sim', label: 'Simular: juntar dívidas em uma só, mais barata', sim: 'consolidar' }] : [];
  return { content: txt, actions: [...oa, ...acts(extra)] };
}

/** Gasto a gasto (ou só o item que a pessoa citou). */
export function expenseReply(s: S, t: string, _h: ChatMessage[] = []): ChatReply {
  const c = s.coach; const focus = KINDS.find(k => k.rx.test(t));
  const hi = s.userName ? `${s.userName}, ` : '';
  if (focus) {
    const e = c.expenses.find(x => focus.rx.test(norm(x.name)));
    const n = e && c.expenseNotes.find(x => x.id === e.id);
    const head = e ? (n ? `${hi}você gasta ${brl(e.amount)} em ${e.name}. Para a sua renda, perto de ${brl(n.typical)} já seria bom — dá para sobrar uns ${brl(n.save)} por mês.` : `${hi}${e.name} está em ${brl(e.amount)}, dentro do esperado para a sua renda. Ainda assim, dá para economizar um pouco:`)
      : `${hi}não achei ${focus.label} nos seus gastos. Se tiver, cadastre em “Meus dados › Gastos”. Algumas ideias para economizar:`;
    return { content: `${head}\n${focus.tips.map(x => '• ' + x).join('\n')}`, actions: [{ type: 'go', label: 'Ajustar meus gastos', tab: 'dados' }] };
  }
  const l: string[] = [];
  if (c.expenseNotes.length) {
    const tot = c.expenseNotes.reduce((a, n) => a + n.save, 0);
    l.push(`${s.userName ? s.userName + ', o' : 'O'}lhei seus gastos um por um. Onde dá para mexer${s.coach.incomeKinds.variable || s.coach.incomeKinds.daily ? '' : ' (já que a renda não muda de um mês para o outro)'}:`);
    c.expenseNotes.slice(0, 4).forEach(n => l.push(`\n• ${n.name}: ${brl(n.amount)} → dá para chegar perto de ${brl(n.typical)} (sobram ~${brl(n.save)}).\n  Dica: ${n.tips[0]}.`));
    l.push(`\nSe fizer tudo, sobram ~${brl(tot)} por mês${s.balance < 0 ? ` — e hoje faltam ${brl(-s.balance)}` : ''}.`);
  } else {
    const big = [...c.expenses].sort((a, b) => b.amount - a.amount).slice(0, 3);
    l.push(`${hi}seus gastos estão dentro do esperado para a sua renda — boa! Os maiores são ${big.map(b => `${b.name} (${brl(b.amount)})`).join(', ')}.${s.balance < 0 ? ' Como o mês ainda não fecha, o caminho passa por dívidas mais baratas ou renda extra.' : ''}`);
  }
  const [oq, oa] = othersQ(s);
  return { content: l.join('\n') + oq, actions: [...oa, { type: 'go', label: 'Ajustar meus gastos', tab: 'dados' }, { type: 'open_sim', label: 'Simular: cortar um gasto', sim: 'cortar' }] };
}

/** Resposta ao "o que entra em Outros?" */
export function othersAnswer(s: S, text: string): ChatReply {
  const o = s.coach.others[0]; const g = guessCategory(text);
  const what = text.trim().replace(/[.!]+$/, ''); const n = norm(text);
  if (o && (o.kind === 'cartao' || /cartao|fatura|credito/.test(n))) {
    if (o.kind === 'cartao' && /^(nao|agora nao|depois)/.test(n)) return { content: 'Tudo bem! Quando quiser, é só abrir a fatura em “Meus dados › Gastos” e tocar em “O que entra na fatura?”.' };
    return { content: `${o.kind === 'cartao' ? 'Boa!' : 'Entendi — é a fatura do cartão. Muita gente lança assim.'} Toque no botão abaixo e coloque, por alto, quanto vai para mercado, delivery, compras, assinaturas, combustível e parcelas. Não precisa fechar certinho: o que sobrar fica como “sem separar”.${s.coach.hasRevolving ? '\n\nO rotativo continua contado como dívida, separado da fatura — sem contar duas vezes.' : ''}`,
      actions: [{ type: 'card', label: o.kind === 'cartao' ? 'Separar o que entra na fatura' : 'Transformar em fatura e separar', expenseId: o.id, toCard: o.kind !== 'cartao' }] };
  }
  if (!o) return { content: 'Anotado! Se quiser, separe esses gastos com nomes próprios em “Meus dados › Gastos” — fica mais fácil achar onde economizar.' };
  const l = [`Entendi: em “${o.name}” entra ${what.length < 80 ? `“${what}”` : 'isso que você contou'}.`];
  if (g) l.push(`Isso combina mais com a categoria ${g[2]}. Quer que eu mude? Assim o diagnóstico fica mais certeiro.`);
  else l.push('Uma dica: separe em linhas com nome próprio em “Meus dados › Gastos” (ex.: “Farmácia”, “Presentes”). Assim eu consigo comparar cada um e achar onde economizar.');
  l.push('\nE uma ideia que funciona bem para gastos soltos: defina um teto por mês (por exemplo, 10% a menos do que hoje) e anote cada saída por 30 dias — só de olhar, muita gente já gasta menos.');
  const actions: ChatAction[] = g ? [{ type: 'recat', label: `Mudar “${o.name}” para ${g[2]}`, expenseId: o.id, category: g[1] }, { type: 'go', label: 'Ajustar meus gastos', tab: 'dados' }] : [{ type: 'go', label: 'Ajustar meus gastos', tab: 'dados' }];
  return { content: l.join('\n'), actions };
}

export function greet(s: S): ChatReply {
  const hi = s.userName ? `Oi, ${s.userName}!` : 'Oi!';
  if (!s.hasData) return { content: `${hi} Para eu te ajudar de verdade, preciso dos seus números: cadastre renda e gastos em “Meus dados” (leva uns 3 minutos).` };
  return { content: `${hi} Sua nota hoje é ${s.score} (${s.level}). Posso te mostrar o caminho até 80, olhar seus gastos um por um, ou responder sobre dívidas, compras e objetivos. Por onde quer começar?`,
    actions: [{ type: 'go', label: 'Ver meu plano', tab: 'plano' }] };
}
