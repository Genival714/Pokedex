import { $ } from './dom';

/** Atalhos globais: "/" foca a busca, Alt+←/→ navega. Esc é tratado em overlays.ts. */
export function initShortcuts(): void {
    document.addEventListener('keydown', (e) => {
        const target = e.target as HTMLElement;
        const tag = (target.tagName || '').toLowerCase();
        const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable;

        if (e.key === '/' && !typing) {
            e.preventDefault();
            const input = $<HTMLInputElement>('#search-input');
            if (input) { input.focus(); input.select(); }
        }
        if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !typing) {
            e.preventDefault();
            const btn = $<HTMLButtonElement>(e.key === 'ArrowLeft' ? '#prev-pokemon' : '#next-pokemon');
            if (btn && !btn.disabled) btn.click();
        }
    });
}
