import type { PokemonCore } from '../data/pokemon';
import { $, $$ } from '../ui/dom';
import { swapMainImage } from '../ui/motion';

const LABELS: Array<[keyof PokemonCore['sprites'], string]> = [
    ['front_default', 'Frente'], ['back_default', 'Costas'],
    ['front_shiny', 'Shiny'], ['back_shiny', 'Shiny costas'],
    ['front_female', 'Fêmea'], ['back_female', 'Fêmea costas'],
    ['front_shiny_female', 'Shiny fêmea'], ['back_shiny_female', 'Shiny fêmea costas'],
];

export function renderSprites(p: PokemonCore): void {
    const container = $('#sprites-container');
    if (!container) return;
    container.innerHTML = '';
    let count = 0;
    for (const [key, label] of LABELS) {
        const src = p.sprites[key];
        if (typeof src !== 'string' || !src) continue;
        count++;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'sprite-thumb';
        btn.title = 'Ver no palco';
        btn.innerHTML = `<img src="${src}" alt="${p.displayName} — ${label}" loading="lazy"><span>${label}</span>`;
        btn.addEventListener('click', () => {
            swapMainImage(src, true);
            $$('#variants .variant').forEach((v) => v.classList.remove('is-active'));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        container.appendChild(btn);
    }
    if (count === 0) container.innerHTML = '<p class="sprites__empty">Nenhum sprite disponível.</p>';
}
