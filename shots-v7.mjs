import { chromium } from 'playwright';
import fs from 'node:fs';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v7';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: true, hasTouch: true, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const D = () => p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data') || 'null'));
const shot = (n, o = {}) => p.screenshot({ path: `${OUT}/${n}.png`, ...o });
// 1) primeiro uso: splash -> boas-vindas
await p.goto(U); await p.waitForTimeout(600);
console.log('splash visível:', await p.locator('.splash').count(), '| welcome atrás:', await p.locator('.welcome').count());
await p.waitForTimeout(2400);
console.log('welcome:', await p.locator('.welcome h1').textContent(), '| nav do app:', await p.locator('nav').count(), '| Começar desabilitado:', await p.locator('.welcome .btn').isDisabled());
await shot('01-boas-vindas');
await p.click('.terms-acc-head >> text=Termos de Uso'); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('.terms-acc.open').scrollIntoView({ block: 'start' })); await p.waitForTimeout(300);
await shot('02-termos-de-uso-expandido');
await p.click('.terms-acc-head >> text=Política de Privacidade'); await p.waitForTimeout(500);
await p.evaluate(() => { const el = document.querySelector('.terms-acc.open'); el.scrollIntoView({ block: 'start' }); el.querySelector('.terms-body').scrollTo(0, 520); }); await p.waitForTimeout(300);
await shot('03-politica-privacidade-expandida');
await p.click('.terms-acc-head >> text=Política de Privacidade'); await p.waitForTimeout(400);
await p.click('.accept'); await p.waitForTimeout(300);
await p.evaluate(() => document.querySelector('.welcome').scrollTo(0, 99999)); await p.waitForTimeout(300);
console.log('após marcar: Começar habilitado:', !(await p.locator('.welcome .btn').isDisabled()));
await shot('04-aceite-marcado-comecar');
await p.click('.welcome >> text=Começar'); await p.waitForTimeout(800);
const t1 = (await D()).settings.terms; console.log('aceite salvo:', JSON.stringify(t1), '| nav do app:', await p.locator('nav').count());
await p.reload(); await p.waitForTimeout(2600); console.log('reabrir: welcome', await p.locator('.welcome').count());
// 2) usuário antigo (dados v6 sem aceite) -> pede uma vez, sem perder dados
await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(600);
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); delete d.settings.terms; localStorage.setItem('jmfinance:data', JSON.stringify(d)); sessionStorage.setItem('jm:nm', '1'); });
const before = await D();
await p.goto(U + '?nosplash'); await p.waitForTimeout(800);
console.log('usuário antigo:', await p.locator('.welcome h1').textContent(), '|', (await p.locator('.welcome .lead').textContent()).slice(0, 80));
await shot('05-usuario-existente-aceite');
await p.click('.accept'); await p.click('.welcome >> text=Começar'); await p.waitForTimeout(600);
const after = await D();
console.log('dados preservados:', after.incomes.length === before.incomes.length && after.history.length === before.history.length && after.goals.length === before.goals.length, `(${after.history.length} meses, ${after.goals.length} objetivos)`);
// 3) versão mudou
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); d.settings.terms.version = '0.9'; localStorage.setItem('jmfinance:data', JSON.stringify(d)); });
await p.reload(); await p.waitForTimeout(800);
console.log('versão mudou:', await p.locator('.welcome h1').textContent(), '|', (await p.locator('.welcome .lead').textContent()).slice(0, 90));
await shot('06-termos-atualizados-nova-versao');
await p.click('.accept'); await p.click('.welcome >> text=Começar'); await p.waitForTimeout(600);
console.log('nova versão aceita:', (await D()).settings.terms.version);
await p.addStyleTag({ content: '.fab{display:none!important}' });
// 4) releitura em Meus dados
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(500);
await p.evaluate(() => scrollTo(0, 99999)); await p.waitForTimeout(900);
console.log('rodapé:', await p.locator('.terms-foot').textContent());
await shot('07-meus-dados-link-termos');
await p.click('.terms-foot >> text=Termos e privacidade'); await p.waitForTimeout(700);
console.log('status:', await p.locator('.accept-status').textContent());
await shot('08-releitura-termos');
await p.click('.terms-sheet .seg >> text=Privacidade'); await p.waitForTimeout(500);
await shot('09-releitura-privacidade');
await p.evaluate(() => document.querySelector('.terms-sheet').scrollTo(0, 99999)); await p.waitForTimeout(300);
await shot('10-releitura-apagar-dados');
await p.click('.terms-sheet .sheet-head button'); await p.waitForTimeout(400);
// Início também tem o link
await p.click('nav >> text=Início'); await p.waitForTimeout(400);
console.log('link no Início:', await p.locator('.disc .link', { hasText: 'Termos e privacidade' }).count());
// 5) backup inclui o aceite; importar mostra
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(400);
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.backup >> text=Exportar backup')]);
const f = '/tmp/jm-v7-backup.json'; await dl.saveAs(f); const j = JSON.parse(fs.readFileSync(f, 'utf8'));
console.log('backup.terms:', JSON.stringify(j.data.settings.terms), '| app', j.appVersion);
// 6) apagar tudo
await p.click('.terms-foot >> text=Termos e privacidade'); await p.waitForTimeout(500);
await p.evaluate(() => document.querySelector('.terms-sheet').scrollTo(0, 99999));
await p.click('text=Apagar todos os dados deste aparelho'); await p.waitForTimeout(500);
await shot('11-confirmar-apagar-tudo');
await p.click('.modal >> text=Apagar tudo'); await p.waitForTimeout(3500);
console.log('após apagar: welcome', await p.locator('.welcome').count(), '| chaves jmfinance:', await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('jmfinance:') && k !== 'jmfinance:data')), '| rendas', (await D())?.incomes.length ?? 0, '| aceite', JSON.stringify((await D())?.settings?.terms ?? null));
// importar o backup num app novo: prévia mostra o aceite
await p.click('.accept'); await p.click('.welcome >> text=Começar'); await p.waitForTimeout(500);
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(400);
await p.setInputFiles('.backup input[type=file]', f); await p.waitForTimeout(600);
console.log('prévia termos:', await p.locator('.backup-sum li', { hasText: 'Termos aceitos' }).textContent());
await p.click('.modal >> text=Substituir meus dados'); await p.waitForTimeout(500);
console.log('após importar, aceite:', (await D()).settings.terms.version, '| welcome', await p.locator('.welcome').count());
console.log('erros:', errs.length ? errs : 'nenhum');
await b.close();
