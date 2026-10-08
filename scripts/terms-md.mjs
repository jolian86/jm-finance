// Gera TERMOS.md a partir de src/terms.ts (fonte única do texto).
import { build } from 'esbuild';
import fs from 'node:fs';
const out = '/tmp/jm-terms.mjs';
await build({ entryPoints: ['src/terms.ts'], outfile: out, format: 'esm', bundle: true, platform: 'node', logLevel: 'silent' });
const T = await import(out + '?' + Date.now());
const sec = (title, blocks) => [`## ${title}`, '', ...blocks.flatMap(b => [`### ${b.h}`, '', ...(b.p ?? []).flatMap(x => [x, '']), ...(b.ul ? [...b.ul.map(x => `- ${x}`), ''] : [])])];
const md = [
  '# JM Finance — Termos de Uso e Política de Privacidade', '',
  `**Versão ${T.TERMS_VERSION}** · atualizada em ${T.TERMS_UPDATED}`, '',
  '> **RASCUNHO — pendente de revisão jurídica.** Responsável: Jolian Marco Costa de Araújo (pessoa física). Contato: jolian.araujo@icloud.com.',
  '> Fonte única do texto: `src/terms.ts` (este arquivo é gerado por `node scripts/terms-md.mjs`). Ao alterar o texto, aumente `TERMS_VERSION` para o app pedir novo aceite.', '',
  ...sec('Termos de Uso', T.TERMS), ...sec('Política de Privacidade', T.PRIVACY),
  '---', '', 'A JM Finance não decide por você. Nós auxiliamos na sua gestão financeira!', '',
].join('\n');
fs.writeFileSync('TERMOS.md', md);
console.log('TERMOS.md:', md.length, 'caracteres');
