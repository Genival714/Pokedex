import { STAT_NAMES } from '../data/constants';
import type { PokemonCore } from '../data/pokemon';
import { $ } from '../ui/dom';
import { animateStats } from '../ui/motion';

export function renderStats(p: PokemonCore): void {
    const container = $('#stats-container');
    if (!container) return;
    const maxBase = Math.max(...p.stats.map((s) => s.base));
    let total = 0;

    container.innerHTML = p.stats.map((s) => {
        total += s.base;
        const min = s.base * 2;
        const max = Math.floor((s.base * 2 + 99) * 1.1);
        return `
            <div class="stat${s.base === maxBase ? ' stat--top' : ''}" style="--pct:${Math.min(100, (s.base / 200) * 100)}%" title="Nível 100: ${min} – ${max}">
                <div class="stat__label">${STAT_NAMES[s.name]}</div>
                <div class="stat__value" data-count="${s.base}">0</div>
                <div class="stat__track"><div class="stat__bar"></div></div>
            </div>`;
    }).join('');

    const totalEl = $('#stats-total');
    if (totalEl) totalEl.textContent = `Total ${total}`;
    animateStats(container);
}
