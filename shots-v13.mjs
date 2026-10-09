// v13: tema claro + botão sol/lua. Uso: node shots-v13.mjs URL OUT [viewports-com-captura] [só-estes]
import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v13';
const SHOT = (process.argv[4] || '360x740,390x844,1366x768').split(',');
const ONLY = (process.argv[5] || '').split(',').filter(Boolean);
const VPS = [[375, 667], [390, 844], [360, 740], [412, 915], [430, 932], [820, 1180, 'tablet'], [1366, 768, 'desktop']].filter(([w, h]) => !ONLY.length || ONLY.includes(`${w}x${h}`));
const b = await chromium.launch(); const errs = []; const fails = []; let checks = 0; const lowAll = {};
const ok = (c, m) => { checks++; if (!c) fails.push(m); };
// contraste WCAG do texto visível contra o fundo efetivo (sobe na árvore até achar fundo opaco; gradiente = cor do tema)
const audit = () => {
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(',').map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const theme = document.documentElement.dataset.theme; const base = theme === 'light' ? { r: 250, g: 246, b: 238, a: 1 } : { r: 8, g: 7, b: 7, a: 1 };
  const bgOf = el => { const layers = []; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); const c = parse(cs.backgroundColor); if (cs.backgroundImage && cs.backgroundImage !== 'none' && !cs.backgroundImage.includes('url(')) { const m = cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{6}/gi); if (m && !/radial/.test(cs.backgroundImage)) { const cc = m.map(x => x.startsWith('#') ? { r: parseInt(x.slice(1, 3), 16), g: parseInt(x.slice(3, 5), 16), b: parseInt(x.slice(5, 7), 16), a: 1 } : parse(x)); const avg = cc.reduce((s, x) => ({ r: s.r + x.r / cc.length, g: s.g + x.g / cc.length, b: s.b + x.b / cc.length, a: Math.max(s.a, x.a) }), { r: 0, g: 0, b: 0, a: 0 }); layers.push(avg); if (avg.a >= 0.9) break; } }
    if (c && c.a > 0) { layers.push(c); if (c.a >= 0.9) break; } }
    let res = base; for (let i = layers.length - 1; i >= 0; i--) { const l = layers[i]; res = { r: l.r * l.a + res.r * (1 - l.a), g: l.g * l.a + res.g * (1 - l.a), b: l.b * l.a + res.b * (1 - l.a), a: 1 }; } return res; };
  const low = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  while (walker.nextNode()) { const t = walker.currentNode; if (!t.textContent.trim()) continue; const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || r.bottom < 0 || r.top > innerHeight) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || +cs.opacity < 0.5 || el.closest('[aria-hidden=true], .gold-text, .recharts-wrapper, svg, button:disabled, .dc-day:disabled')) continue;
    if (cs.webkitTextFillColor && cs.webkitTextFillColor.includes('0, 0, 0, 0')) continue;
    let o = 1; for (let e = el; e; e = e.parentElement) o *= +getComputedStyle(e).opacity; if (o < 0.6) continue;
    const fg = parse(cs.color); if (!fg) continue; const bg = bgOf(el); const fgc = { r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a) };
    const L1 = lum(fgc), L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const big = parseFloat(cs.fontSize) >= 18 || (parseFloat(cs.fontSize) >= 14 && +cs.fontWeight >= 700);
    if (ratio < (big ? 3 : 3.8)) low.push(`${t.textContent.trim().slice(0, 30)} [${el.className?.toString?.().slice(0, 30) || el.tagName}] ${ratio.toFixed(2)}`); }
  return low;
};
for (const [w, h, kind] of VPS) {
  const n = `${w}x${h}`; const shots = SHOT.includes(n);
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: kind === 'desktop' ? 1 : 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: !kind, hasTouch: kind !== 'desktop', colorScheme: scheme });
    const p = await ctx.newPage(); p.on('dialog', d => d.accept()); p.on('pageerror', e => errs.push(`${n}/${scheme}: ${e.message}`)); p.on('console', m => m.type() === 'error' && errs.push(`${n}/${scheme}: ${m.text()}`));
    const wait = ms => p.waitForTimeout(ms);
    const T = () => p.evaluate(() => [document.documentElement.dataset.theme, document.querySelector('meta[name=theme-color]').content, localStorage.getItem('jm:theme')]);
    const shot = async nm => { if (shots) { await wait(450); await p.screenshot({ path: `${OUT}/${scheme === 'light' ? 'claro' : 'escuro'}-${n}-${nm}.png` }); } };
    const chk = async where => { const low = await p.evaluate(audit); lowAll[`${scheme} ${where}`] = [...new Set([...(lowAll[`${scheme} ${where}`] || []), ...low])];
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); ok(ov <= 1, `${n}/${scheme} · overflow em ${where}: ${ov}px`);
      const hd = await p.evaluate(() => { const hh = document.querySelector('header'); if (!hh) return null; const r = hh.getBoundingClientRect(); return [...hh.querySelectorAll('*')].some(e => { const q = e.getBoundingClientRect(); return q.width && (q.right > r.right + 0.5 || q.left < r.left - 0.5); }); });
      ok(!hd, `${n}/${scheme} · algo sai do cabeçalho em ${where}`); };
    await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:nm', '1'); localStorage.setItem('jm:themePicked', '1'); }); await p.reload(); await wait(700);
    let t = await T(); ok(t[0] === scheme && t[1] === (scheme === 'light' ? '#faf6ee' : '#080707') && t[2] === null, `${n}/${scheme} · 1º uso não seguiu o aparelho: ${t}`);
    await chk('boas-vindas'); await shot('00-boas-vindas');
    await p.click('.welcome .accept'); await p.locator('.welcome .btn').last().click(); await wait(700);
    await p.click('text=Carregar dados de EXEMPLO'); await wait(900); await p.click('nav >> text=Início'); await wait(900);
    // botão sol/lua: troca, salva e persiste após recarregar
    const other = scheme === 'light' ? 'dark' : 'light';
    await p.click('.theme-btn'); await wait(300); t = await T(); ok(t[0] === other && t[2] === other, `${n}/${scheme} · botão não trocou: ${t}`);
    await p.reload(); await wait(900); t = await T(); ok(t[0] === other, `${n}/${scheme} · escolha não persistiu: ${t}`);
    await p.click('.theme-btn'); await wait(300); t = await T(); ok(t[0] === scheme && t[2] === scheme, `${n}/${scheme} · voltar: ${t}`);
    ok(await p.locator('.theme-btn').getAttribute('aria-label') === (scheme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'), `${n}/${scheme} · rótulo do botão`);
    await p.evaluate(() => scrollTo(0, 0)); await wait(300); await chk('Início'); await shot('01-inicio');
    await p.evaluate(() => scrollTo(0, 700)); await wait(500); await chk('Início (meio)');
    for (const [tab, nm, y] of [['Meus dados', '02-meus-dados', 0], ['Meus dados', '03-meus-dados-dividas', '.card:has(h3:text-is("Dívidas"))'], ['Diagnóstico', '04-diagnostico', 0], ['Plano', '05-plano', 0], ['Objetivos', '06-objetivos', 0]]) {
      await p.click(`nav >> text=${tab}`); await wait(1300);
      if (typeof y === 'string') await p.locator(y).first().evaluate(e => scrollTo(0, e.getBoundingClientRect().top + scrollY - 70)); else await p.evaluate(() => scrollTo(0, 0));
      await wait(1300); await chk(nm); await shot(nm);
      await p.evaluate(() => scrollTo(0, document.body.scrollHeight / 2)); await wait(1200); await chk(nm + ' (meio)');
    }
    await p.click('nav >> text=Diagnóstico'); await wait(800); await p.locator('[role=tab]', { hasText: 'Evolução' }).click(); await wait(1500); await chk('Evolução'); await p.evaluate(() => scrollTo(0, 500)); await wait(1200); await chk('Evolução (gráficos)'); await shot('07-evolucao-graficos');
    // previsão de receitas (gráfico com legenda)
    await p.click('nav >> text=Meus dados'); await wait(900); await p.evaluate(() => { const e = document.querySelector('#previsao'); scrollTo(0, e.getBoundingClientRect().top + scrollY - 70); }); await wait(1300); await chk('Previsão'); await shot('08-previsao-receitas');
    // modal (Fechar mês) e folha (alertas) e formulário
    await p.evaluate(() => scrollTo(0, 0)); await p.locator('button', { hasText: 'Fechar mês' }).first().click(); await wait(700); await chk('modal Fechar mês'); await shot('09-modal-fechar-mes'); await p.locator('.modal .modal-actions .btn.ghost').click(); await wait(400);
    await p.click('.bell'); await wait(800); await chk('alertas'); await shot('10-alertas'); await p.click('.sheet .chat-back'); await wait(400);
    await p.locator('#receitas .recv').nth(1).locator('.icon-btn').click(); await wait(800); await chk('formulário receita'); await shot('11-form-receita'); await p.locator('.recv-form .modal-actions .btn.ghost').click(); await wait(400);
    // simulador e consultor
    await p.goto(U + '?nosplash&tab=simulador&sim=financiar'); await wait(1500); await chk('Simulador'); await p.evaluate(() => scrollTo(0, 600)); await wait(1300); await chk('Simulador (gráfico)'); await shot('12-simulador');
    await p.goto(U + '?nosplash'); await wait(900); await p.click('.fab'); await wait(900); await p.locator('.chips button').first().click(); await wait(2500); await chk('Consultor'); await shot('13-consultor');
    await ctx.close();
  }
  console.log(n, 'ok');
}
await b.close();
const lows = Object.entries(lowAll).filter(([, v]) => v.length);
console.log('contraste baixo:', lows.length ? '\n' + lows.map(([k, v]) => `  ${k}: ${v.slice(0, 8).join(' | ')}`).join('\n') : 'nenhum');
console.log('checagens:', checks, '| falhas:', fails.length ? '\n  ' + fails.join('\n  ') : 'nenhuma'); console.log('erros:', errs.length ? errs.join('\n') : 'nenhum');
