// Aviso de mudança de endereço: aparece só nos endereços antigos (detectado pelo hostname, mesmo build em todo lugar).
// Não redireciona sozinho: os dados ficam no aparelho e se perderiam.
import { useState } from 'react';
import { createPortal } from 'react-dom';
export const NEW_URL = 'https://app.jmfinance.com.br';
const OLD_HOSTS = ['jolian86.github.io', 'jm-finance.pages.dev'];
export const isOldHost = () => { try { const h = location.hostname; return OLD_HOSTS.includes(h) || new URLSearchParams(location.search).has('moved'); } catch { return false; } };
const KEY = 'jm:movedSeen';

export function MovedBanner({ onBackup }: { onBackup: () => void }) {
  const [full, setFull] = useState(() => { try { return !sessionStorage.getItem(KEY); } catch { return true; } });
  const [saved, setSaved] = useState(false);
  if (!isOldHost()) return null;
  const host = NEW_URL.replace(/^https?:\/\//, '');
  const close = () => { try { sessionStorage.setItem(KEY, '1'); } catch { /* ok */ } setFull(false); };
  const backup = () => { onBackup(); setSaved(true); };
  if (!full) return <div className="moved" role="region" aria-label="O JM Finance mudou de endereço">
    <b>O JM Finance mudou de endereço</b>
    <p>Agora é <a href={NEW_URL}>{host}</a>. Leve seus dados com um backup.</p>
    <div className="moved-actions"><button className="btn sm" onClick={() => setFull(true)}>Ver os passos</button><a className="btn ghost sm" href={NEW_URL}>Abrir o novo endereço</a></div>
  </div>;
  return createPortal(<div className="moved-wrap" role="dialog" aria-modal="true" aria-label="O JM Finance mudou de endereço">
    <div className="moved-card">
      <h2>O JM Finance mudou de endereço 🏠</h2>
      <p>O novo endereço é <a href={NEW_URL}><b>{host}</b></a>. Seus dados ficam guardados só neste aparelho e <b>não passam sozinhos</b> para o novo endereço. Leve-os em 1 minuto:</p>
      <ol>
        <li>Toque em <b>Exportar backup</b> aqui embaixo e salve o arquivo.<div><button className="btn sm" onClick={backup}>Exportar backup</button>{saved && <span className="moved-ok"> ✓ Backup gerado</span>}</div></li>
        <li>Abra o novo endereço: <a href={NEW_URL}>{host}</a> e aceite os termos.</li>
        <li>Lá, em <b>Meus dados</b>, toque em <b>Importar backup</b> e escolha o arquivo salvo.</li>
        <li>Instale o ícone de novo pelo novo endereço:<br />iPhone: <b>Compartilhar → Adicionar à Tela de Início</b><br />Android: <b>menu (⋮) → Instalar app</b><br />Depois, pode apagar o ícone antigo.</li>
      </ol>
      <div className="moved-actions"><a className="btn" href={NEW_URL}>Abrir {host}</a><button className="btn ghost" onClick={close}>Agora não</button></div>
    </div>
  </div>, document.body);
}
