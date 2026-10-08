import { Asset, AssetType, ASSET_TYPES, Data, Goal, uid, brl } from './finance';
import { MoneyInput } from './ui';

const LONG_TERM: AssetType[] = ['previdencia', 'seguro_vida'];

/** Um bem do patrimônio. O app decide se é "disponível rápido" pelo tipo. Previdência/seguro: aporte mensal opcional,
 *  que pode virar um gasto fixo ligado (o valor vive no gasto — nada é contado duas vezes) e, na previdência, entrar no objetivo de aposentadoria. */
export function AssetCard({ a, data, mark, goGoals }: { a: Asset; data: Data; mark: (p: Partial<Data>) => void; goGoals?: () => void }) {
  const T = ASSET_TYPES[a.type];
  const setA = (p: Partial<Asset>, extra: Partial<Data> = {}) => mark({ assets: data.assets.map(x => x.id === a.id ? { ...x, ...p } : x), ...extra });
  const long = LONG_TERM.includes(a.type);
  const linked = a.expenseId ? data.expenses.find(e => e.id === a.expenseId) : undefined;
  const monthly = linked ? linked.amount : a.monthly ?? 0;
  const expName = a.type === 'previdencia' ? 'Previdência' : 'Seguro de vida';
  const rx = a.type === 'previdencia' ? /previd|pgbl|vgbl/i : /seguro/i;
  const similar = !linked ? data.expenses.find(e => rx.test(e.name)) : undefined;
  const retireGoal = data.goals.find(g => g.type === 'aposentadoria' && g.retire);
  const setMonthly = (n?: number) => {
    const v = n ?? 0;
    if (linked) mark({ assets: data.assets.map(x => x.id === a.id ? { ...x, monthly: v || undefined } : x), expenses: data.expenses.map(e => e.id === linked.id ? { ...e, amount: v } : e) });
    else setA({ monthly: v || undefined });
  };
  const toggleExpense = (on: boolean) => {
    if (on) { const id = uid(); setA({ expenseId: id }, { expenses: [...data.expenses, { id, name: expName, amount: monthly, category: 'protecao', kind: 'fixa' }] }); }
    else mark({ assets: data.assets.map(x => x.id === a.id ? { ...x, expenseId: undefined, monthly: monthly || undefined } : x), expenses: data.expenses.filter(e => e.id !== a.expenseId) });
  };
  const useInRetirement = () => {
    if (retireGoal) { setA({ forRetirement: true }); return; }
    const g: Goal = { id: uid(), name: 'Aposentadoria', type: 'aposentadoria', target: 0, date: '', saved: 0, priority: 'alta', retire: { monthlyIncome: 3000, age: 35, retireAge: 65, rate: 0.4 } };
    setA({ forRetirement: true }, { goals: [...data.goals, g] });
  };
  const remove = () => mark({ assets: data.assets.filter(x => x.id !== a.id), ...(linked ? { expenses: data.expenses.filter(e => e.id !== linked.id) } : {}) });
  return <div className={`debt asset ${long ? 'long' : ''}`}>
    <div className="row"><input className="row-name" aria-label="Nome do bem" placeholder="Nome do bem" value={a.name} onChange={e => setA({ name: e.target.value })} />
      <button className="x" aria-label={`Remover ${a.name || 'bem'}`} onClick={remove}>✕</button></div>
    <div className="fgrid asset-grid">
      <label className="f-type">Tipo<select value={a.type} onChange={e => { const t = e.target.value as AssetType; setA({ type: t, liquid: ASSET_TYPES[t].liquid, ...(t !== 'previdencia' ? { forRetirement: false } : {}) }); }}>
        {Object.entries(ASSET_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></label>
      <label className="f-money">{long ? 'Saldo hoje' : 'Valor estimado'}<MoneyInput label={long ? 'Saldo acumulado hoje' : 'Valor estimado'} value={a.value} onChange={n => setA({ value: n ?? 0 })} /></label>
      {long && <label className="f-money">{a.type === 'previdencia' ? 'Aporte por mês' : 'Pagamento por mês'}
        <MoneyInput label={a.type === 'previdencia' ? 'Aporte mensal da previdência (opcional)' : 'Pagamento mensal do seguro (opcional)'} placeholder="opcional" value={monthly || undefined} onChange={setMonthly} /></label>}
    </div>
    <p className={`asset-auto ${T.liquid ? 'yes' : ''}`}>{T.liquid ? '✓ Disponível rápido — ' : long ? 'Fora da reserva de emergência — ' : 'Não entra no disponível rápido — '}<span>{T.hint}</span></p>
    {long && <div className="asset-extra">
      <label className="chk-line"><input type="checkbox" checked={!!linked} disabled={!linked && !monthly} onChange={e => toggleExpense(e.target.checked)} />
        <span>Lançar {monthly ? brl(monthly) : 'o valor'}/mês também em Gastos como “{expName}”{!monthly && !linked ? ' (preencha o valor mensal)' : ''}</span></label>
      {linked && <small className="fhint">Está em Gastos mensais › Previdência e seguros. Mude o valor aqui ou lá — é o mesmo gasto, contado uma vez só.</small>}
      {similar && <small className="fhint warn">Você já tem o gasto “{similar.name}” ({brl(similar.amount)}). Se for este mesmo pagamento, não marque — senão ele conta duas vezes.</small>}
      {a.type === 'previdencia' && (a.forRetirement
        ? <p className="asset-goal">✓ Conta no objetivo de aposentadoria: o saldo entra como já guardado{linked ? ' e o aporte mensal reduz o que falta guardar' : ''}. {goGoals && <button className="link" onClick={goGoals}>Ver objetivo</button>} · <button className="link" onClick={() => setA({ forRetirement: false })}>não usar</button>
          {!linked && monthly > 0 && <small className="fhint">Para o aporte também contar no objetivo, lance-o em Gastos (caixa acima) — assim o plano sabe de onde sai esse dinheiro.</small>}</p>
        : <button className="link asset-goal-btn" onClick={useInRetirement}>Usar no objetivo de aposentadoria{retireGoal ? '' : ' (cria o objetivo)'} →</button>)}
    </div>}
  </div>;
}
