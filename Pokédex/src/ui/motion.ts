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

/** Modo de exibição da imagem principal: artwork (suave), pixel art (nítido) ou animado (suave, tamanho natural ampliado). */
export type StageMode = 'art' | 'pixel' | 'anim';

function applyMode(img: HTMLImageElement, mode: StageMode): void {
    img.classList.toggle('is-pixel', mode === 'pixel');
    img.classList.toggle('is-anim', mode === 'anim');
    if (mode !== 'anim') { img.style.removeProperty('height'); img.style.removeProperty('width'); }
}

/**
 * Sprite animado (GIF de ~100px): ampliação em ESCALA INTEIRA com vizinho-mais-próximo.
 * Cada pixel do sprite vira um bloco uniforme — sem borrão (interpolação) nem blocos
 * irregulares (escala fracionária). Considera o devicePixelRatio para que a escala
 * também seja inteira em pixels físicos (ex.: DPR 1.5 → 2x CSS = 3 px físicos).
 */
function fitAnimated(img: HTMLImageElement): void {
    if (!img.classList.contains('is-anim') || !img.naturalHeight) return;
    const stage = img.closest<HTMLElement>('.stage');
    const limit = Math.min(300, (stage?.clientWidth ?? 440) * 0.62);
    const maxK = Math.max(1, Math.floor(Math.min(limit / img.naturalHeight, limit / img.naturalWidth)));
    const dpr = window.devicePixelRatio || 1;
    let k = maxK;
    // Prefere o maior k cujo produto com o DPR seja inteiro (blocos exatos na tela física)
    for (let c = maxK; c >= 1; c--) {
        if (Math.abs(c * dpr - Math.round(c * dpr)) < 0.01) { k = c; break; }
    }
    img.style.height = `${img.naturalHeight * k}px`;
    img.style.width = `${img.naturalWidth * k}px`;
}

/** Troca a imagem principal do palco com crossfade. */
export function swapMainImage(src: string, mode: StageMode | boolean = 'art'): void {
    const main = $<HTMLImageElement>('#main-pokemon-image');
    if (!main) return;
    const m: StageMode = typeof mode === 'boolean' ? (mode ? 'pixel' : 'art') : mode;
    if (main.getAttribute('src') === src) { applyMode(main, m); fitAnimated(main); return; }
    main.classList.add('is-swapping');
    const done = () => {
        applyMode(main, m);
        main.src = src;
        const show = () => { fitAnimated(main); main.classList.remove('is-swapping'); };
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
