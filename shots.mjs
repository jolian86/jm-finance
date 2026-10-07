import { chromium } from 'playwright';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs=[]; p.on('pageerror',e=>errs.push(e.message));
const U='http://localhost:4173/';
await p.goto(U); await p.screenshot({ path: 'screenshots/01-inicio-vazio.png', fullPage: true });
await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(1200);
await p.screenshot({ path: 'screenshots/03-diagnostico.png', fullPage: true });
for (const [t,f] of [['Início','02-inicio-exemplo'],['Meus dados','04-meus-dados'],['Plano','05-plano-de-acao']]) { await p.click(`nav >> text=${t}`); await p.waitForTimeout(1200); await p.screenshot({ path: `screenshots/${f}.png`, fullPage: true }); }
await p.setViewportSize({width:1280,height:900}); await p.click('nav >> text=Diagnóstico'); await p.waitForTimeout(1000); await p.screenshot({ path: 'screenshots/06-desktop-diagnostico.png', fullPage: true });
console.log('errors', errs); await b.close();
