import { chromium } from 'playwright';
import fs from 'node:fs';
const U = process.argv[2] || 'http://localhost:4173/jm-finance/';
const OUT = process.argv[3] || 'screenshots/v6';
const b = await chromium.launch();
const mk = (ua) => b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo', isMobile: true, hasTouch: true, acceptDownloads: true, ...(ua ? { userAgent: ua } : {}) });
const ctx = await mk();
const p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
const hideFab = () => p.addStyleTag({ content: '.fab{display:none!important}' });
const D = () => p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:data')));
const toBackup = async () => { await p.click('nav >> text=Meus dados'); await p.waitForTimeout(500); await p.evaluate(() => document.getElementById('backup').scrollIntoView({ block: 'center' })); await p.waitForTimeout(700); };
// 1) dados reais (exemplo editado) + conversa
await p.goto(U + '?nosplash'); await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:splash', '1'); sessionStorage.setItem('jm:nm', '1'); }); await p.reload();
await p.click('text=Carregar dados de EXEMPLO'); await p.waitForTimeout(600);
await p.click('nav >> text=Meus dados'); await p.waitForTimeout(400);
await p.locator('.card input').first().fill('Salário (empresa nova)'); await p.waitForTimeout(200);
await p.click('.fab'); await p.waitForTimeout(400); await p.click('.chips >> text=Como sair do vermelho?'); await p.waitForTimeout(2200); await p.click('.chat-back'); await p.waitForTimeout(400);
await hideFab();
console.log('isExample após editar:', (await D()).isExample, '| conversa:', await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:chat')).length), 'msgs');
// 2) lembrete de backup (>30 dias desde o 1º uso, sem backup)
await p.evaluate(() => { const d = JSON.parse(localStorage.getItem('jmfinance:data')); d.settings.firstSeenAt = new Date(Date.now() - 40 * 864e5).toISOString(); delete d.settings.lastBackupAt; localStorage.setItem('jmfinance:data', JSON.stringify(d)); });
await p.reload(); await p.waitForTimeout(700); await hideFab();
await p.click('.bell'); await p.waitForTimeout(600);
const bk = p.locator('.alert', { hasText: 'Faça um backup' }); console.log('alerta backup:', await bk.count(), '|', await bk.locator('p').first().textContent().catch(() => '-'));
await bk.scrollIntoViewIfNeeded(); await p.waitForTimeout(300);
await p.screenshot({ path: `${OUT}/01-alerta-faca-backup.png` });
await bk.locator('text=Fazer backup').click(); await p.waitForTimeout(1200);
console.log('CTA levou ao card:', await p.evaluate(() => { const r = document.getElementById('backup').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
await p.reload(); await p.waitForTimeout(600); await hideFab(); await toBackup(); await p.waitForTimeout(500);
await p.screenshot({ path: `${OUT}/02-card-backup-meus-dados.png` });
// 3) exportar
const before = await D();
const [dl] = await Promise.all([p.waitForEvent('download'), p.click('.backup >> text=Exportar backup')]);
const file = `${OUT}/${dl.suggestedFilename()}`; await dl.saveAs(file);
const j = JSON.parse(fs.readFileSync(file, 'utf8'));
console.log('arquivo:', dl.suggestedFilename(), '| format', j.format, '| app', j.appVersion, '| schema', j.schemaVersion, '| exportedAt', j.exportedAt, '| chat', j.chat?.length, '| history', j.data.history.length);
await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/03-card-backup-exportado.png` });
console.log('lastBackupAt salvo:', (await D()).settings.lastBackupAt ? 'sim' : 'não');
await p.click('.bell'); await p.waitForTimeout(500); console.log('alerta backup após exportar:', await p.locator('.alert', { hasText: 'Faça um backup' }).count()); await p.click('.sheet-head button'); await p.waitForTimeout(400);
// 4) limpar tudo
await p.evaluate(() => { localStorage.clear(); sessionStorage.setItem('jm:splash', '1'); sessionStorage.setItem('jm:nm', '1'); }); await p.reload(); await p.waitForTimeout(600); await hideFab();
console.log('após limpar: rendas', (await D()).incomes.length, '| conversa', await p.evaluate(() => localStorage.getItem('jmfinance:chat')));
await toBackup();
// 5) arquivo inválido
await p.setInputFiles('.backup input[type=file]', { name: 'foto.json', mimeType: 'application/json', buffer: Buffer.from('isso não é json') });
await p.waitForTimeout(500); console.log('inválido:', await p.locator('.backup-msg').textContent());
await p.screenshot({ path: `${OUT}/04-importar-arquivo-invalido.png` });
await p.setInputFiles('.backup input[type=file]', { name: 'outro.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ hello: 'world' })) });
await p.waitForTimeout(400); console.log('json de outro app:', await p.locator('.backup-msg').textContent());
await p.setInputFiles('.backup input[type=file]', { name: 'futuro.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...j, schemaVersion: 99 })) });
await p.waitForTimeout(400); console.log('versão futura:', await p.locator('.backup-msg').textContent());
// 6) importar o backup real -> prévia -> confirmar
await p.setInputFiles('.backup input[type=file]', file); await p.waitForTimeout(800);
await p.screenshot({ path: `${OUT}/05-importar-previa-confirmacao.png` });
console.log('prévia:', (await p.locator('.backup-sum li').allTextContents()).join(' | '));
await p.click('.modal >> text=Substituir meus dados'); await p.waitForTimeout(700);
const after = await D();
const strip = (d) => { const c = structuredClone(d); delete c.settings.lastBackupAt; delete c.settings.firstSeenAt; return JSON.stringify(c); };
console.log('round-trip dados idênticos:', strip(after) === strip(before), '| history', after.history.length, '| goals', after.goals.length, '| debts', after.debts.length, '| renda', after.incomes[0].name);
console.log('conversa restaurada:', await p.evaluate(() => JSON.parse(localStorage.getItem('jmfinance:chat') || '[]').length), 'msgs | msg:', await p.locator('.backup-msg').textContent());
await p.screenshot({ path: `${OUT}/06-importado-sucesso.png` });
// 7) backup antigo (formato v4: sem settings/actuals) é migrado
const old = { format: 'jm-finance-backup', app: 'JM Finance', appVersion: '1.4.0', schemaVersion: 4, exportedAt: '2026-08-01T12:00:00.000Z', data: { incomes: [{ id: 'a', name: 'Salário', amount: 3000 }], expenses: [{ id: 'e', name: 'Aluguel', amount: 1000, category: 'moradia', kind: 'fixa' }], debts: [], reserve: 500, assets: [], goals: [], month: '2026-08', history: [] } };
await p.setInputFiles('.backup input[type=file]', { name: 'antigo.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(old)) }); await p.waitForTimeout(700);
console.log('antigo prévia:', (await p.locator('.backup-sum li').last().textContent()));
await p.screenshot({ path: `${OUT}/07-importar-backup-antigo-migrado.png` });
await p.click('.modal >> text=Cancelar'); await p.waitForTimeout(400);
console.log('cancelar manteve dados:', (await D()).history.length === after.history.length);
// 8) "iPhone" sem Web Share de arquivos -> cai no download
const ctxI = await mk('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
const pi = await ctxI.newPage(); pi.on('pageerror', e => errs.push(e.message));
await pi.goto(U + '?nosplash'); await pi.evaluate(() => { sessionStorage.setItem('jm:nm', '1'); }); await pi.reload();
await pi.click('text=Carregar dados de EXEMPLO'); await pi.waitForTimeout(500); await pi.click('nav >> text=Meus dados'); await pi.waitForTimeout(400);
const [dl2] = await Promise.all([pi.waitForEvent('download', { timeout: 8000 }), pi.click('.backup >> text=Exportar backup')]);
console.log('iPhone sem share -> download:', dl2.suggestedFilename());
console.log('erros:', errs.length ? errs : 'nenhum');
await b.close();
