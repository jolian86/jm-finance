// Aviso de mudança de endereço para o site antigo (GitHub Pages).
// PREPARADO, NÃO ATIVO: só aparece num build com VITE_MOVED_TO definido (ex.: VITE_MOVED_TO=https://jmfinance.com.br npm run build).
import { useState } from 'react';
const TO: string = (import.meta.env && import.meta.env.VITE_MOVED_TO) || '';

export function MovedBanner({ onBackup }: { onBackup: () => void }) {
  const [open, setOpen] = useState(false);
  if (!TO) return null;
  return <div className="moved" role="region" aria-label="O JM Finance mudou de endereço">
    <b>O JM Finance mudou de endereço</b>
    <p>O novo endereço é <a href={TO}>{TO.replace(/^https?:\/\//, '')}</a>. Seus dados ficam neste aparelho e não passam sozinhos para o novo endereço — leve-os com um backup:</p>
    <button className="link" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Esconder os passos' : 'Ver como levar meus dados (1 minuto)'}</button>
    {open && <ol>
      <li>Aqui, toque em <b>Exportar backup</b> (abaixo) e salve o arquivo.</li>
      <li>Abra <a href={TO}>{TO.replace(/^https?:\/\//, '')}</a> e aceite os termos.</li>
      <li>Lá, em <b>Meus dados</b>, toque em <b>Importar backup</b> e escolha o arquivo salvo.</li>
      <li>Confira se está tudo certo. Pronto! Se instalou o app na tela inicial, instale de novo pelo novo endereço.</li>
    </ol>}
    <div className="moved-actions"><button className="btn sm" onClick={onBackup}>Exportar backup</button><a className="btn ghost sm" href={TO}>Ir para o novo endereço</a></div>
  </div>;
}
