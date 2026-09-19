import { spriteUrl } from '../api/pokeapi';
import { formatName } from '../data/i18n';
import type { EvoNode } from '../data/pokemon';
import { goPokemon } from '../state/router';
import { $, escapeHtml, pad3 } from '../ui/dom';
import { svgIcon } from '../ui/icons';

export function renderEvolution(nodes: EvoNode[] | undefined, currentSpeciesId: number): void {
    const container = $('#evolution-chain-container');
    if (!container) return;
    if (!nodes) {
        container.innerHTML = '<div class="skeleton" style="min-height:140px;width:100%"></div>';
        return;
    }
    container.innerHTML = '';
    if (nodes.length === 0) {
        container.innerHTML = '<p class="evo-chain__empty">Este Pokémon não evolui.</p>';
        return;
    }

    nodes.forEach((n, i) => {
        if (i > 0) {
            const arrow = document.createElement('div');
            arrow.className = 'evo__arrow';
            arrow.innerHTML = `${svgIcon('i-arrow-right')}<span class="evolution-condition">${escapeHtml(n.condition ?? '')}</span>`;
            container.appendChild(arrow);
        }
        const card = document.createElement('div');
        card.className = 'evo' + (n.id === currentSpeciesId ? ' is-current' : '');
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        card.innerHTML = `
            <span class="evo__stage">${n.stage === 0 ? 'BASE' : `EST. ${n.stage + 1}`}</span>
            <div class="evo__img"><img src="${spriteUrl(n.id)}" alt="" loading="lazy" onerror="this.src='img/placeholder-pixel.png'"></div>
            <div class="evo__name">${escapeHtml(formatName(n.name))}</div>
            <div class="evo__id">#${pad3(n.id)}</div>`;
        const go = () => { goPokemon(n.id); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        card.addEventListener('click', go);
        card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        container.appendChild(card);
    });

    if (nodes.length === 1) {
        const note = document.createElement('p');
        note.className = 'evo-chain__empty';
        note.textContent = 'Este Pokémon não possui evoluções conhecidas.';
        container.appendChild(note);
    }
}
