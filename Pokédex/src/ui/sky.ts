/**
 * Céu ambiente atrás da página:
 *  - tema escuro: estrelas cintilando, estrelas cadentes e a Lunala como lua;
 *  - tema claro: o Solgaleo como sol, com raios girando e brilho pulsante.
 * As cores por tipo (blobs do body::before) continuam por baixo.
 */
import { artworkUrl } from '../api/pokeapi';
import { prefersReducedMotion } from './dom';

const SOLGALEO = 791;
const LUNALA = 792;
const STARS = 90;

export function initSky(): void {
    if (document.querySelector('.sky')) return;
    const sky = document.createElement('div');
    sky.className = 'sky';
    sky.setAttribute('aria-hidden', 'true');

    // Estrelas com posição, tamanho e cadência aleatórios (só uma vez)
    const stars: string[] = [];
    for (let i = 0; i < STARS; i++) {
        const x = (Math.random() * 100).toFixed(2);
        const y = (Math.random() * 70).toFixed(2);          // concentradas na metade superior
        const size = (Math.random() * 1.6 + 0.8).toFixed(2);
        const dur = (Math.random() * 3 + 2.5).toFixed(2);
        const delay = (Math.random() * 6).toFixed(2);
        const bright = Math.random() > 0.8 ? ' star--bright' : '';
        stars.push(`<i class="star${bright}" style="--x:${x}%;--y:${y}%;--s:${size}px;--d:${dur}s;--dl:${delay}s"></i>`);
    }

    sky.innerHTML = `
        <div class="sky__stars">${stars.join('')}</div>
        <div class="sky__shooting sky__shooting--1"></div>
        <div class="sky__shooting sky__shooting--2"></div>
        <div class="sky__wash"></div>
        <div class="sky__celestial">
            <div class="sky__rays"></div>
            <div class="sky__glow"></div>
            <img class="sky__mon sky__mon--sol" src="${artworkUrl(SOLGALEO)}" alt="" decoding="async" loading="lazy">
            <img class="sky__mon sky__mon--luna" src="${artworkUrl(LUNALA)}" alt="" decoding="async" loading="lazy">
        </div>`;

    document.body.prepend(sky);

    if (!prefersReducedMotion()) {
        // Parallax mínimo do astro com o scroll (fica "longe")
        let raf: number | null = null;
        window.addEventListener('scroll', () => {
            if (raf) return;
            raf = requestAnimationFrame(() => {
                sky.style.setProperty('--scroll', String(Math.min(600, window.scrollY)));
                raf = null;
            });
        }, { passive: true });
    }
}
