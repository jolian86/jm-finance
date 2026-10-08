import type { ChatAction, ChatMessage, ChatProvider, ChatReply, FinancialSummary as S } from './types';

const pm = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}% ao mês`;
const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const END = '\n\nA decisão é sua — eu só mostro os caminhos e o que os números indicam.';

/** Extrai um valor em reais do texto: "R$ 3.500", "3500", "3,5 mil", "40k" */
export function parseValue(t: string): number | null {
  const n = norm(t);
  const m = n.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?\s*(mil|k)?\b/);
  if (!m) return null;
  let v = Number(m[1].replace(/\./g, '') + (m[2] ? '.' + m[2] : ''));
  if (m[3]) v *= 1000;
  return v > 0 ? v : null;
}
/** Prazo no texto: "em 12 meses", "daqui a 2 anos", "ano que vem" */
export function parseMonths(t: string): number | null {
  const n = norm(t);
  let m = n.match(/(\d+)\s*(mes|meses)\b/); if (m) return Number(m[1]);
  m = n.match(/(\d+)\s*anos?\b/); if (m) return Number(m[1]) * 12;
  if (/ano que vem|proximo ano/.test(n)) return 12;
  if (/fim do ano|final do ano|dezembro/.test(n)) { const d = new Date(); return Math.max(1, 11 - d.getMonth()); }
  return null;
}
const ymAhead = (k: number) => { const d = new Date(); d.setMonth(d.getMonth() + k); return d.toISOString().slice(0, 7); };
const fmtYm = (s: string) => { const [y, m] = s.split('-'); return `${m}/${y}`; };
const pmt = (pv: number, i: number, n: number) => pv * i / (1 - Math.pow(1 + i, -n));

function noData() {
  return 'Ainda não tenho seus números. Cadastre sua renda, gastos e dívidas em "Meus dados" (ou carregue os dados de exemplo na tela Início) e eu consigo responder com base na sua situação real.';
}

function purchase(s: S, text: string) {
  const v = parseValue(text);
  const exp = s.debts.filter(d => d.expensive);
  const isFin = /financ|parcel|prestac|consorcio/.test(norm(text));
  const lines: string[] = [];
  if (!v) return 'Posso analisar! Me diga o valor aproximado, por exemplo: "posso financiar um carro de R$ 40 mil?" ou "posso comprar um celular de R$ 2.500?".';
  lines.push(`Analisei uma compra de ${brl(v)} com base nos seus números:`);
  lines.push(`• Saldo do mês hoje: ${brl(s.balance)} · Sobra após cortes sugeridos: ${brl(s.surplusAfterCuts)}`);
  if (exp.length) lines.push(`• ⚠️ Você tem dívidas caras (${exp.map(d => `${d.name} ${pm(d.ratePctMonth)}`).join(', ')}). Pela ordem de prioridades, elas vêm antes de compras.`);
  const free = s.freeForGoals, after = s.freeAfterDebts;
  const parc24 = pmt(v, 0.02, 24);
  lines.push('\nOpções:');
  const P = s.payoff?.recommendedMonths ?? null;
  let cashTxt: string;
  if (s.debts.length && P && after > free) {
    const during = Math.max(0, free) * P;
    const m = v <= during ? Math.ceil(v / free) : P + Math.ceil((v - during) / after);
    cashTxt = `guardando ${brl(Math.max(0, free))}/mês enquanto quita as dívidas (~${P} meses) e ~${brl(after)}/mês depois, leva ~${m} meses`;
  } else cashTxt = free > 1 ? `guardando ${brl(free)}/mês leva ~${Math.ceil(v / free)} meses` : 'hoje não sobra dinheiro para guardar — primeiro é preciso criar folga no orçamento';
  lines.push(`1) Juntar e comprar à vista — ${cashTxt}.\n   ✅ Prós: sem juros, dá para negociar desconto. ❌ Contras: demora mais. ⚠️ Risco: baixo.`);
  lines.push(`2) ${isFin ? 'Financiar' : 'Parcelar'} — ex.: 24x com juros de ~2% ao mês ≈ ${brl(parc24)}/mês (total ≈ ${brl(parc24 * 24)}). Gastos e parcelas, que hoje levam ${s.commitmentPct.toFixed(0)}% da sua renda, passariam a levar ~${s.income ? ((s.expenses + s.minPayments + parc24) / s.income * 100).toFixed(0) : '?'}% da renda.\n   ✅ Prós: tem o bem agora. ❌ Contras: paga ${brl(parc24 * 24 - v)} de juros. ⚠️ Risco: ${parc24 > Math.max(0, s.surplusAfterCuts) ? 'ALTO — a parcela não cabe na sua sobra atual e pode gerar nova dívida.' : 'moderado — cabe, mas reduz sua folga para imprevistos.'}`);
  lines.push(`3) Adiar ou buscar opção mais barata (usado, modelo inferior, alugar/emprestar).\n   ✅ Prós: protege seu plano. ❌ Contras: abrir mão do desejo agora.`);
  if (s.liquidAssets > 0) lines.push(`\nVocê tem ${brl(s.liquidAssets)} disponível rápido (conta, poupança, resgate rápido), mas isso também é sua reserva de emergência (${s.reserveMonths.toFixed(1)} meses). Usar para a compra reduz sua proteção.`);
  return lines.join('\n') + END;
}

/** Planeja um novo objetivo (viagem, compra, reserva) a partir do orçamento livre real do usuário. */
function newGoal(s: S, text: string): ChatReply {
  const n = norm(text);
  const type: 'viagem' | 'compra' | 'reserva' | 'outro' = /viag|ferias|passeio/.test(n) ? 'viagem' : /reserva|emergencia/.test(n) ? 'reserva' : /compr|carro|moto|celular|notebook|casa|apartamento/.test(n) ? 'compra' : 'outro';
  const dest = text.match(/(?:para|pra|pro|a|ao|à)\s+(?:o |a |os |as )?([A-ZÀ-Ý][\wÀ-ÿ]+(?:\s+(?:de |do |da )?[A-ZÀ-Ý][\wÀ-ÿ]+)*)/);
  const name = type === 'viagem' ? `Viagem${dest ? ' para ' + dest[1] : ''}` : type === 'reserva' ? 'Reserva de emergência' : 'Novo objetivo';
  let v = parseValue(text.replace(/\d+\s*(mes|meses|anos?)\b/gi, ''));
  if (type === 'reserva' && !v) v = Math.max(0, s.reserveTarget6m - s.effReserve);
  const months = parseMonths(text);
  const free = Math.max(0, s.freeForGoals), after = Math.max(0, s.freeAfterDebts);
  const P = s.payoff?.recommendedMonths ?? null;
  const l: string[] = [];
  const exp = s.debts.filter(d => d.expensive);
  l.push(`Pelo seu orçamento, hoje sobram ~${brl(free)}/mês livres para objetivos${s.debts.length ? ` (o resto da sobra vai para as dívidas)${P ? `; depois de quitá-las, em ~${P} meses, sobem para ~${brl(after)}/mês` : ''}` : ''}.`);
  if (s.goals.length) l.push(`Você já tem ${s.goals.length} objetivo(s) usando parte desse valor (${s.goals.filter(g => g.fits).length} cabem hoje).`);
  if (exp.length) l.push(`⚠️ Lembrete: com dívidas caras (${exp.map(d => `${d.name} ${pm(d.ratePctMonth)}`).join(', ')}), cada real nelas rende mais que guardar para ${type === 'viagem' ? 'a viagem' : 'o objetivo'}.`);
  const actions: ChatAction[] = [];
  if (!v) {
    l.push('\nSem um valor definido, veja quanto dá para juntar:');
    for (const k of [6, 12, 24]) {
      const tot = P && P < k ? free * P + after * (k - P) : free * k;
      l.push(`• Em ${k} meses: ~${brl(tot)}`);
    }
    l.push('\nSe me disser o valor aproximado (ex.: "viagem de R$ 6 mil"), calculo prazo e parcela e posso criar o objetivo para você.');
    return { content: l.join('\n') + END };
  }
  const accum = (k: number) => P && P < k ? free * P + after * (k - P) : free * k;
  let mFree = 0; if (free > 0 || after > 0) { mFree = 1; while (accum(mFree) < v && mFree < 600) mFree++; }
  l.push(`\nObjetivo: ${brl(v)}.`);
  l.push('\nOpções:');
  if (months) {
    const need = v / months;
    l.push(`1) No prazo que você quer (${months} meses, até ${fmtYm(ymAhead(months))}): guardar ${brl(need)}/mês. ${need <= free ? '✅ Cabe no seu orçamento livre atual.' : `⚠️ Passa do seu livre atual em ${brl(need - free)}/mês — exigiria cortes extras ou renda a mais.`}\n   ✅ Prós: realiza na data desejada. ${need > free ? '❌ Contras: aperta o orçamento. ⚠️ Risco: atrasar o plano de dívidas.' : '❌ Contras: reduz folga para outros objetivos.'}`);
    actions.push({ type: 'create_goal', label: `Criar objetivo: ${brl(v)} em ${months} meses`, goal: { name, type, target: Math.round(v), date: ymAhead(months) } });
  }
  if (mFree > 0 && mFree < 600) {
    l.push(`${months ? '2' : '1'}) Usando só o que já sobra: ~${mFree} meses (até ${fmtYm(ymAhead(mFree))}), média de ${brl(v / mFree)}/mês.\n   ✅ Prós: não mexe no plano de dívidas. ❌ Contras: ${months && mFree > months ? 'demora mais que o desejado.' : 'exige constância.'}`);
    if (!months || mFree !== months) actions.push({ type: 'create_goal', label: `Criar objetivo: ${brl(v)} até ${fmtYm(ymAhead(mFree))}`, goal: { name, type, target: Math.round(v), date: ymAhead(mFree) } });
  } else l.push(`${months ? '2' : '1'}) Hoje não sobra dinheiro livre para este objetivo — o primeiro passo é criar folga (cortes do plano ou renda extra).`);
  if (type === 'viagem') l.push(`${actions.length + 1}) Versão mais econômica (baixa temporada, destino mais perto, menos dias): com ${brl(v * 0.7)} (−30%) o prazo cai para ~${mFree ? Math.max(1, Math.round(mFree * 0.7)) : '?'} meses.\n   ✅ Prós: realiza antes. ❌ Contras: abre mão de parte do plano original.`);
  l.push('\n⚠️ Risco geral: parcelar viagem/compra no cartão sem ter o dinheiro costuma virar dívida cara.');
  if (actions.length) l.push('\nSe quiser, toque em um dos botões abaixo para criar o objetivo na aba Objetivos.');
  return { content: l.join('\n') + END, actions };
}

function whichDebt(s: S) {
  if (!s.debts.length) return 'Você não tem dívidas cadastradas. 🎉 O foco pode ser reserva de emergência e objetivos.' + END;
  const p = s.payoff;
  const l = [`Você tem ${s.debts.length} dívida(s), pagando ~${brl(s.monthlyInterest)} de juros por mês.`, '', 'Dois jeitos de organizar a ordem:'];
  const rec = p?.recommended ?? 'avalanche';
  const av = `“Economizar mais juros” (paga primeiro a de juros mais altos): ${s.avalancheOrder.join(' → ')}.${p ? ` ${p.avalancheMonths ? `~${p.avalancheMonths} meses, ${brl(p.avalancheInterest)} de juros.` : 'Não quita com o orçamento atual.'}` : ''}\n   ✅ Paga menos juros. ❌ A primeira dívida quitada pode demorar.`;
  const sb = `“Quitar primeiro as menores” (paga primeiro a de menor valor): ${s.snowballOrder.join(' → ')}.${p ? ` ${p.snowballMonths ? `~${p.snowballMonths} meses, ${brl(p.snowballInterest)} de juros.` : 'Não quita com o orçamento atual.'}` : ''}\n   ✅ Ver dívidas sumindo cedo dá ânimo. ❌ Pode custar mais juros.`;
  (rec === 'avalanche' ? [av, sb] : [sb, av]).forEach((x, i) => l.push(`${i + 1}) ${x}${i === 0 ? '\n   👉 É o que o app recomenda para você.' : ''}`));
  if (p && p.avalancheInterest < p.snowballInterest - 1) l.push(`\n“Economizar mais juros” custa ~${brl(p.snowballInterest - p.avalancheInterest)} a menos.`);
  const exp = s.debts.filter(d => d.expensive);
  if (exp.length) l.push(`\n3) Em paralelo: renegociar ${exp.map(d => d.name).join(' e ')} — trocar por um empréstimo mais barato (ex.: consignado, descontado do salário) pode reduzir muito os juros. ⚠️ Risco: só funciona se você parar de usar o cartão/cheque especial.`);
  return l.join('\n') + END;
}

function howMuchSave(s: S) {
  const l = [`Reserva de emergência: hoje ${brl(s.effReserve)} (${s.reserveMonths.toFixed(1)} meses). Meta de 6 meses: ${brl(s.reserveTarget6m)}.`];
  l.push(`Livre para guardar agora: ${brl(s.freeForGoals)}/mês${s.debts.length ? ` (o restante da sobra vai para as dívidas); após quitá-las: ~${brl(s.freeAfterDebts)}/mês` : ''}.`);
  if (s.goals.length) { l.push('\nSeus objetivos:'); s.goals.forEach(g => l.push(`• ${g.name}: ${brl(g.monthlyNeed)}/mês ${g.fits ? '✅ cabe' : '⚠️ não cabe hoje'}`)); }
  l.push('\nCaminhos possíveis:\n1) Guardar um valor fixo logo que o salário cai ("pague-se primeiro"). ✅ Disciplina automática. ❌ Exige ajustar o resto do mês.\n2) Guardar o que sobrar no fim do mês. ✅ Flexível. ❌ Geralmente não sobra nada.\n3) Separar 20% da renda (' + brl(s.income * 0.2) + '/mês) para dívidas e reserva — uma divisão que costuma funcionar.');
  if (s.debts.some(d => d.expensive)) l.push('\n⚠️ Com dívidas caras, uma mini-reserva (~R$ 1.000) e depois foco total nas dívidas costuma render mais do que poupar.');
  return l.join('\n') + END;
}

function outOfRed(s: S) {
  const l = [`Sua nota é ${s.score}/100 (${s.level}). Gastos e parcelas levam ${s.commitmentPct.toFixed(0)}% da sua renda e ${s.balance < 0 ? `faltam ${brl(-s.balance)}` : `sobram ${brl(s.balance)}`} por mês.`];
  if (s.suggestedCuts.length) l.push(`\nCortes que mais ajudam: ${s.suggestedCuts.slice(0, 3).map(c => `${c.name} (${brl(c.current)} → ${brl(c.suggested)})`).join('; ')}.`);
  l.push('\nO caminho sugerido no seu plano:'); s.planSteps.slice(0, 5).forEach((t, i) => l.push(`${i + 1}. ${t}`));
  l.push('\nAlternativas para acelerar:\n• Aumentar renda (freelas, vender o que não usa). ✅ Resolve mais rápido. ❌ Exige tempo/energia.\n• Renegociar dívidas. ✅ Reduz parcelas. ⚠️ Pode alongar o prazo.');
  if (s.debtToIncomePct > 50) l.push('\n⚠️ Suas parcelas passam de 50% da renda — vale procurar ajuda profissional (Procon, Defensoria Pública ou o programa do seu banco para quem tem dívidas demais).');
  return l.join('\n') + END;
}

function invest(s: S) {
  const exp = s.debts.filter(d => d.expensive);
  const l: string[] = [];
  if (exp.length) l.push(`Antes de investir, um ponto importante: suas dívidas caras custam ${exp.map(d => `${pm(d.ratePctMonth)}`).join(', ')}. Nenhum investimento seguro rende isso — quitar essas dívidas é, na prática, o "melhor investimento" disponível para você agora.`);
  if (s.reserveMonths < 3) l.push(`Sua reserva cobre ${s.reserveMonths.toFixed(1)} meses. Normalmente o primeiro passo é completá-la (meta ${brl(s.reserveTarget6m)}) numa aplicação segura, que dá para sacar no mesmo dia.`);
  l.push('\nCategorias gerais (sem indicar produtos específicos):');
  l.push('1) Aplicações seguras que dá para sacar no mesmo dia (renda fixa com resgate diário) — ✅ ideais para a reserva. ❌ Rendem menos no longo prazo.');
  l.push('2) Aplicações com data para sacar (Tesouro, renda fixa de prazo maior) — ✅ boas para objetivos com data. ⚠️ Sacar antes do prazo pode dar perda.');
  l.push('3) Renda variável (ações, fundos imobiliários) — ✅ maior potencial no longo prazo. ⚠️ Pode cair bastante; só com dinheiro que não vai precisar por anos.');
  l.push('\nPara comparar: em quanto tempo dá para sacar, o risco, as taxas e se tem a garantia que devolve até R$ 250 mil se o banco quebrar (o FGC). Para valores maiores, um planejador financeiro certificado (CFP) pode ajudar.');
  return l.join('\n') + END;
}

function assets(s: S) {
  if (!s.assets.length) return 'Você não cadastrou bens em "Meus dados → Patrimônio". Com eles eu consigo avaliar se vale usar algum para quitar dívidas.';
  const l = [`Tudo o que você tem soma ${brl(s.totalAssets)}. Tirando as dívidas, você tem de verdade ${brl(s.netWorth)}, e ${brl(s.liquidAssets)} está disponível rápido (dinheiro que dá para usar em poucos dias).`];
  const exp = s.debts.filter(d => d.expensive);
  if (exp.length) {
    l.push(`\nVocê tem ${brl(exp.reduce((a, d) => a + d.balance, 0))} em dívidas caras. Opções:`);
    l.push('1) Vender um bem pouco usado para quitar. ✅ Elimina juros altos de uma vez. ❌ Perde o bem. ⚠️ Venda rápida pode sair abaixo do valor.');
    l.push('2) Trocar por um bem mais barato (ex.: carro mais simples) e usar a diferença. ✅ Mantém a utilidade. ❌ Dá trabalho.');
    l.push('3) Manter tudo e seguir o plano de quitação. ✅ Sem perdas. ❌ Continua pagando ~' + brl(s.monthlyInterest) + '/mês de juros.');
    l.push('\nAntes de decidir: o bem é essencial (ex.: carro para trabalhar)? Quanto custa mantê-lo (IPVA, seguro, manutenção)?');
  } else l.push('\nSem dívidas caras, não há urgência em vender bens. Avalie custos de manutenção de bens parados.');
  return l.join('\n') + END;
}

function goals(s: S) {
  if (!s.goals.length) return 'Você ainda não tem objetivos. Cadastre na aba "Objetivos" (viagem, compra, aposentadoria...) e eu calculo quanto guardar.';
  const l = ['Seus objetivos, por prioridade:'];
  s.goals.forEach(g => l.push(`• ${g.name}: meta ${brl(g.target)}, já tem ${brl(g.saved)} → ${brl(g.monthlyNeed)}/mês ${g.fits ? '✅ cabe hoje' : '⚠️ não cabe hoje'}`));
  l.push(`\nLivre para objetivos: ${brl(s.freeForGoals)}/mês${s.debts.length ? `; após quitar as dívidas ~${brl(s.freeAfterDebts)}/mês` : ''}.`);
  l.push('\nSe algum não cabe, as saídas são: estender o prazo, reduzir o valor ou cortar/ganhar mais por mês. A aba Objetivos mostra os números de cada opção.');
  return l.join('\n') + END;
}

const HELP = 'Sou o Consultor JM (modo simulação). Posso analisar com seus números:\n• "Posso comprar/financiar algo de R$ X?"\n• "Qual dívida pagar primeiro?"\n• "Quanto devo guardar por mês?"\n• "Como sair do vermelho?"\n• "Vale a pena investir agora?"\n• "Devo vender meu carro para quitar dívidas?"\n• "Quero fazer uma viagem de R$ 6 mil" (calculo prazo e crio o objetivo)\n• "Meus objetivos cabem no orçamento?"';

export function simulatedReply(text: string, s: S): ChatReply {
  const r = route(text, s);
  const reply: ChatReply = typeof r === 'string' ? { content: r } : r;
  // liga a resposta ao simulador correspondente, quando fizer sentido
  const t = norm(text); const add = (a: ChatAction) => { reply.actions = [...(reply.actions ?? []), a]; };
  if (s.hasData) {
    if (/financi|parcel|compr/.test(t) && !/viag/.test(t)) add({ type: 'open_sim', label: 'Simular: financiar x juntar e comprar à vista', sim: 'financiar' });
    if (/qual divida|pagar primeiro|quitar|renegoci|avalanche|bola de neve|menores primeiro|economizar juros/.test(t)) {
      if (s.debts.some(d => d.expensive)) add({ type: 'open_sim', label: 'Simular: juntar dívidas em uma só, mais barata', sim: 'consolidar' });
      add({ type: 'open_sim', label: 'Simular: antecipar parcelas', sim: 'antecipar' });
    }
    if (/invest|aplicar|render/.test(t) && s.debts.length) add({ type: 'open_sim', label: 'Simular: quitar dívida x investir', sim: 'quitar-investir' });
    if (/vermelho|sair d|endivid|apertad|nao sobra|cortar|economizar/.test(t)) add({ type: 'open_sim', label: 'Simular: cortar um gasto', sim: 'cortar' });
  }
  return reply;
}
const TYPE_RX: [RegExp, string[], string][] = [[/\bplr\b|\bppr\b/, ['plr'], 'PLR'], [/13\s*(º|o\b)|decimo/, ['13o'], '13º'], [/ferias/, ['ferias'], 'férias'], [/restituic/, ['restituicao'], 'restituição do IR'],
  [/honorari|\bexito\b|sucumb/, ['honorarios', 'exito'], 'honorários'], [/repasse|convenio/, ['convenio'], 'repasse de convênio'], [/comiss/, ['comissao'], 'comissão'], [/safra/, ['safra'], 'safra']];
const PRESET_HINT: Record<string, string> = { plr: 'toque em “PLR” — já vem com 2 parcelas (outubro e fevereiro), e você ajusta meses e valores', '13o': 'toque em “13º salário” — eu sugiro as duas parcelas (novembro e dezembro) a partir do seu salário', ferias: 'toque em “Férias + 1/3”' };
function futureIncome(s: S, t: string) {
  const R = s.receivables; const hit = TYPE_RX.find(([rx]) => rx.test(t));
  const types = hit?.[1]; const label = hit?.[2] ?? 'receitas futuras';
  const uses = R.uses.filter(u => !types || types.includes(u.type));
  const lines: string[] = [];
  if (!R.count || (types && !uses.length && !R.upcoming.some(u => types.includes(u.type)))) {
    lines.push(`Você ainda não cadastrou ${types ? label : 'receitas futuras'}. Em “Meus dados › Receitas futuras”, ${(types && PRESET_HINT[types[0]]) || 'use um dos atalhos (13º, PLR, honorários, nota fiscal, safra…)'}. Aí eu consigo dizer onde cada valor rende mais para você.`);
    lines.push('Regra geral para dinheiro extra: 1) quitar dívida cara (rotativo, cheque especial); 2) completar a reserva de emergência; 3) objetivos.');
  } else {
    lines.push(`Nos próximos 12 meses você espera receber ${brl(R.expected)} em receitas futuras, dos quais ${brl(R.guaranteed)} são certos. ${R.mode === 'garantido' ? 'O plano conta só com o dinheiro certo.' : `Por segurança, o plano conta com ${brl(R.weighted)} (todo o certo e só uma parte do que é provável ou incerto).`}`);
    if (uses.length) { lines.push(`\nSugestão de uso${types ? ` para ${label}` : ''} (dívida cara → reserva → objetivos):`); uses.slice(0, 4).forEach(u => lines.push('• ' + u.text)); }
    if (R.overdue) lines.push(`\n⚠️ ${R.overdue} recebimento(s) estão atrasados — não conte com eles até cair na conta.`);
  }
  if (types?.includes('13o')) lines.push('\nLembrete: a 1ª parcela do 13º vem sem descontos (até 30/11); INSS e IR saem da 2ª (até 20/12).');
  if (types?.includes('plr')) lines.push('\nLembrete: PLR depende das metas e do acordo da empresa — até cair na conta, trate como provável.');
  lines.push('\n✅ Use o dinheiro quando ele entrar. ❌ Não gaste por conta antes: nada de parcelas ou compras contando com valor provável ou incerto.');
  return lines.join('\n') + END;
}
function route(text: string, s: S): string | ChatReply {
  const t = norm(text);
  if (/^(oi|ola|bom dia|boa tarde|boa noite|ajuda|help)\b/.test(t) && t.length < 25) return HELP;
  if (!s.hasData) return noData();
  if (/\bplr\b|\bppr\b|13\s*(º|o\b)|decimo|restituic|honorari|recebiv|receita(s)? futura|\bbonus\b|safra|repasse|\bexito\b|sucumb|\bcomiss/.test(t) || (/ferias/.test(t) && /receb|terco|1\/3|dinheiro/.test(t))) return futureIncome(s, t);
  if (/vender|patrimonio|bens?\b|imovel|usar (meu|minha)/.test(t)) return assets(s);
  if (/compr|financi|parcel|gastar|trocar de/.test(t) && !/juntar|guardar para|guardar pra/.test(t)) {
    const v = parseValue(text); const base = purchase(s, text);
    if (!v) return base;
    const g = newGoal(s, text);
    return { content: base + '\n\nPrefere juntar antes de comprar? Posso criar um objetivo com prazo calculado pelo seu orçamento.', actions: g.actions?.slice(-1) };
  }
  if (/qual divida|pagar primeiro|quitar|avalanche|bola de neve|menores primeiro|economizar juros|renegoci/.test(t)) return whichDebt(s);
  if (/invest|aplicar|render|tesouro|acoes|cdb/.test(t)) return invest(s);
  if (/meus objetivos|minhas metas|objetivos cabem|aposent/.test(t)) return goals(s);
  if (/viag|ferias|juntar|guardar para|guardar pra|quero (ter|fazer|comprar)|objetivo|meta|reserva de emergencia/.test(t)) return newGoal(s, text);
  if (/guardar|poupar|economizar|reserva|quanto devo/.test(t)) return howMuchSave(s);
  if (/vermelho|sair d|endivid|apertad|nao sobra|divida|situacao|diagnostic/.test(t)) return outOfRed(s);
  return 'Não tenho certeza se entendi. ' + HELP;
}

export const simulatedProvider: ChatProvider = {
  id: 'simulated', label: 'Modo simulação', simulated: true,
  async sendMessage(history: ChatMessage[], summary: S) {
    const last = [...history].reverse().find(m => m.role === 'user');
    await new Promise(r => setTimeout(r, 700 + Math.random() * 600));
    return simulatedReply(last?.content ?? '', summary);
  },
};
