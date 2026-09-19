/** Segmented control com indicador deslizante e semântica de abas. */
import { $, $$ } from './dom';

export function initSegmentedTabs(root: ParentNode = document, onChange?: (tab: string) => void): void {
    const seg = $('.segmented', root);
    if (!seg) return;
    const thumb = $('.segmented__thumb', seg);
    const buttons = $$<HTMLButtonElement>('.segmented__btn', seg);
    const panels = $$('.tab-panel', root);

    const moveThumb = (btn: HTMLElement) => {
        if (!thumb) return;
        thumb.style.width = `${btn.offsetWidth}px`;
        thumb.style.transform = `translateX(${btn.offsetLeft - 4}px)`;
    };

    const activate = (btn: HTMLButtonElement, focus = false) => {
        buttons.forEach((b) => {
            const on = b === btn;
            b.classList.toggle('active', on);
            b.setAttribute('aria-selected', on ? 'true' : 'false');
            b.tabIndex = on ? 0 : -1;
        });
        const id = btn.dataset.tab;
        panels.forEach((p) => {
            const on = p.id === `${id}-tab`;
            p.classList.toggle('active', on);
            p.hidden = !on;
        });
        moveThumb(btn);
        if (focus) btn.focus();
        if (id) onChange?.(id);
    };

    buttons.forEach((btn, i) => {
        btn.addEventListener('click', () => activate(btn));
        btn.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') activate(buttons[(i + 1) % buttons.length], true);
            if (e.key === 'ArrowLeft') activate(buttons[(i - 1 + buttons.length) % buttons.length], true);
        });
    });

    const initial = buttons.find((b) => b.classList.contains('active')) ?? buttons[0];
    if (!initial) return;
    activate(initial);
    const measure = () => moveThumb(buttons.find((b) => b.classList.contains('active')) ?? initial);
    document.fonts?.ready.then(measure);
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);
}

export function activeTab(root: ParentNode = document): string | null {
    return $<HTMLButtonElement>('.segmented__btn.active', root)?.dataset.tab ?? null;
}
