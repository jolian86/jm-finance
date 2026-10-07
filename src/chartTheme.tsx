/* Tema dos gráficos (paleta dourado + pratas/grafites/bronze) */
// Paleta de gráficos: dourado como cor principal, alternado com pratas/grafites/bronze para contraste entre vizinhos
export const CH = { gold: '#f7b731', silver: '#c3c7cc', bronze: '#b8865b', steel: '#7f8b99', champagne: '#e8dcc4', graphite: '#5c6672', lightGold: '#fde68a', slate: '#94a3b8', taupe: '#a39382' };
export const COLORS = [CH.gold, CH.silver, CH.bronze, CH.steel, CH.champagne, CH.graphite, CH.taupe, CH.slate, CH.lightGold];
export const kfmt = (n: number) => Math.abs(n) >= 1000 ? `${(n / 1000).toLocaleString('pt-BR')} mil` : String(n);
export const legendFmt = (v: string) => <span style={{ color: '#e8dcc4', fontSize: 12 }}>{v}</span>;
export const AX = { stroke: '#6b5d4a', tick: { fill: '#b8a88f', fontSize: 12 } };
export const AXY = { ...AX, tickFormatter: kfmt };
export const TT = { contentStyle: { background: '#15110c', border: '1px solid rgba(247,183,49,.35)', borderRadius: 10, color: '#f5ede0' }, itemStyle: { color: '#f5ede0' }, labelStyle: { color: '#f7b731' } };
export const LEVEL_COLOR = { 'crítico': '#ef4444', 'atenção': '#f59e0b', 'estável': '#a3e635', 'saudável': '#22c55e' } as Record<string, string>;
