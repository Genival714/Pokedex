/**
 * Animações: reveal escalonado, count-up, parallax do palco, troca de imagem.
 */
import { $, $$, prefersReducedMotion } from './dom';

export function setAccent(primary: string, secondary?: string): void {
    const root = document.documentElement;
    root.style.setProperty('--accent', primary);
    root.style.setProperty('--accent-2', secondary ?? primary);
    const meta = $<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = primary;
}

/** Reinicia as animações `.reveal` dentro de `root`. */
export function reveal(root: ParentNode = document): void {
    for (const el of $$('.reveal', root)) {
        el.classList.add('is-replay');
        void el.offsetWidth; // força reflow
        el.classList.remove('is-replay');
    }
}

export function countUp(el: HTMLElement, to: number, duration = 700): void {
    if (prefersReducedMotion()) { el.textContent = String(to); return; }
    const start = performance.now();
    const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(to * eased));
        if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
}

export function animateStats(container: HTMLElement | null): void {
    if (!container) return;
    $$('.stat', container).forEach((row, i) => {
        const valueEl = $('.stat__value', row);
        const to = valueEl ? Number(valueEl.dataset.count) : NaN;
        window.setTimeout(() => {
            row.classList.add('is-in');
            if (valueEl && Number.isFinite(to)) countUp(valueEl, to);
        }, 60 * i);
    });
}

/** Parallax leve do palco com o ponteiro (desativado em touch / reduced motion). */
export function initParallax(): void {
    const stage = $('#stage');
    if (!stage || prefersReducedMotion() || window.matchMedia('(pointer: coarse)').matches) return;

    let raf: number | null = null;
    let tx = 0;
    let ty = 0;
    const apply = () => {
        stage.style.setProperty('--px', tx.toFixed(3));
        stage.style.setProperty('--py', ty.toFixed(3));
        raf = null;
    };
    window.addEventListener('pointermove', (e) => {
        const r = stage.getBoundingClientRect();
        tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
        ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
        if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    window.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(apply); });
}

/** Troca a imagem principal do palco com crossfade. */
export function swapMainImage(src: string, pixel = false): void {
    const main = $<HTMLImageElement>('#main-pokemon-image');
    if (!main) return;
    if (main.getAttribute('src') === src) { main.classList.toggle('is-pixel', pixel); return; }
    main.classList.add('is-swapping');
    const done = () => {
        main.classList.toggle('is-pixel', pixel);
        main.src = src;
        const show = () => main.classList.remove('is-swapping');
        if (main.complete) requestAnimationFrame(show);
        else {
            main.addEventListener('load', show, { once: true });
            main.addEventListener('error', show, { once: true });
        }
    };
    window.setTimeout(done, prefersReducedMotion() ? 0 : 200);
}

/** Envolve uma atualização de DOM na View Transitions API quando disponível. */
export function withViewTransition(update: () => void): void {
    type VT = { ready?: Promise<void>; finished?: Promise<void>; updateCallbackDone?: Promise<void> };
    const doc = document as Document & { startViewTransition?: (cb: () => void) => VT };
    if (typeof doc.startViewTransition === 'function' && !prefersReducedMotion()) {
        const t = doc.startViewTransition(update);
        // Uma transição interrompida por outra rejeita estas promessas ("Transition was skipped")
        t.ready?.catch(() => {});
        t.finished?.catch(() => {});
        t.updateCallbackDone?.catch(() => {});
    } else {
        update();
    }
}
