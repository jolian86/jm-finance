import { ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * Folhas e modais são renderizados direto no <body> (portal). Dentro de um .card
 * (que tem backdrop-filter) um position:fixed fica preso ao cartão e atrás da barra
 * de abas — era o bug do "Salvar" escondido no iPhone.
 */
let open = 0;
export function useOverlayLock() {
  useEffect(() => {
    open++; document.body.classList.add('has-overlay');
    return () => { open = Math.max(0, open - 1); if (!open) document.body.classList.remove('has-overlay'); };
  }, []);
}
export function Portal({ children }: { children: ReactNode }) {
  useOverlayLock();
  return createPortal(children, document.body);
}

const editable = (el: Element | null) => !!el && (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement ||
  (el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'range', 'color', 'file'].includes(el.type)) || (el as HTMLElement).isContentEditable);

/**
 * Mantém --vvh/--vvt com a área realmente visível (visualViewport): no iOS o teclado
 * não encolhe 100dvh, então as folhas usam essa altura para o "Salvar" ficar acima do teclado.
 * Também marca body.kb-open (teclado aberto) para esconder barra de abas e botão do Consultor.
 */
export function installViewportSync() {
  const root = document.documentElement; const vv = window.visualViewport;
  let maxH = 0, lastW = 0;
  const sync = () => {
    const zoomed = !!vv && vv.scale > 1.01;
    const h = vv && !zoomed ? vv.height : window.innerHeight;
    const t = vv && !zoomed ? vv.offsetTop : 0;
    const w = window.innerWidth; if (w !== lastW) { lastW = w; maxH = 0; } // girou a tela
    maxH = Math.max(maxH, h, window.innerHeight);
    root.style.setProperty('--vvh', `${Math.round(h)}px`);
    root.style.setProperty('--vvt', `${Math.round(t)}px`);
    document.body.classList.toggle('kb-open', editable(document.activeElement) && h < maxH * 0.8);
  };
  sync();
  vv?.addEventListener('resize', sync); vv?.addEventListener('scroll', sync);
  window.addEventListener('resize', sync); window.addEventListener('orientationchange', sync);
  document.addEventListener('focusin', () => { sync(); setTimeout(sync, 350); });
  document.addEventListener('focusout', () => setTimeout(sync, 100));
}
