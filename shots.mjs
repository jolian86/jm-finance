import { chromium } from 'playwright';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
// migração: dados no formato antigo (sem assets/goals)
await p.goto(U); await p.evaluate(() => localStorage.setItem('jmfinance:data', JSON.stringify({ incomes: [{ id: 'a', name: 'Salário', amount: 3000 }], expenses: [], debts: [], reserve: 500 })));
await p.reload(); await p.click('nav >> text=Objetivos'); await p.click('nav >> text=Diagnóstico'); await p.click('nav >> text=Meus dados');
console.log('migração ok:', await p.isVisible('text=Patrimônio (bens e aplicações)'));
await p.evaluate(() => localStorage.clear()); await p.reload();
await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(1200);
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(500);
await p.locator('text=Patrimônio (bens e aplicações)').scrollIntoViewIfNeeded();
await p.screenshot({ path: 'screenshots/07-meus-dados-patrimonio.png' });
await p.screenshot({ path: 'screenshots/04-meus-dados.png', fullPage: true });
await p.click('nav >> text=Diagnóstico'); await p.waitForTimeout(1200); await p.screenshot({ path: 'screenshots/03-diagnostico.png', fullPage: true });
await p.click('nav >> text=Objetivos'); await p.waitForTimeout(800); await p.screenshot({ path: 'screenshots/08-objetivos.png', fullPage: true });
await p.click('nav >> text=Plano'); await p.waitForTimeout(1200); await p.screenshot({ path: 'screenshots/05-plano-de-acao.png', fullPage: true });
console.log('disclaimers no plano:', await p.locator('.jm-disc').count());
await p.click('.fab'); await p.waitForTimeout(300);
for (const q of ['Qual dívida pagar primeiro?', 'Posso financiar um carro de R$ 40 mil?']) { await p.click(`.chips >> text=${q}`); await p.waitForSelector('.typing'); await p.waitForSelector('.typing', { state: 'detached' }); }
console.log('respostas do bot:', await p.locator('.msg.bot').count(), '| badge:', await p.isVisible('text=MODO SIMULAÇÃO'));
await p.locator('.msg.me').last().scrollIntoViewIfNeeded(); await p.waitForTimeout(500);
await p.screenshot({ path: 'screenshots/09-consultor-jm.png' });
await p.reload(); await p.click('.fab'); console.log('histórico persistido:', await p.locator('.msg.me').count());
await p.click('.chips >> text=Como sair do vermelho?'); await p.waitForSelector('.typing'); await p.waitForTimeout(450); await p.screenshot({ path: 'screenshots/10-consultor-digitando.png' });
await p.waitForSelector('.typing', { state: 'detached' });
console.log('errors', errs); await b.close();
