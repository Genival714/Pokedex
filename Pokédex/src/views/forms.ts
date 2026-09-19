import type { Pokemon } from '../api/types';
import { STAT_SHORT } from '../data/constants';
import { formatName, typeLabel } from '../data/i18n';
import type { PokemonCore } from '../data/pokemon';
import { goPokemon } from '../state/router';
import { $, $$, escapeHtml } from '../ui/dom';
import { svgIcon, typeBadge } from '../ui/icons';
import { swapMainImage } from '../ui/motion';
import { showToast } from '../ui/toast';

interface FormCard {
    name: string;
    label: string;
    image: string;
    data: Pokemon;
    id: number | null; // null = shiny (não navegável)
    current: boolean;
}

function labelFor(name: string, base: string): { name: string; label: string } {
    const b = formatName(base);
    if (name.includes('-mega-x')) return { name: `Mega ${b} X`, label: 'Mega Evolução X' };
    if (name.includes('-mega-y')) return { name: `Mega ${b} Y`, label: 'Mega Evolução Y' };
    if (name.includes('-mega')) return { name: `Mega ${b}`, label: 'Mega Evolução' };
    if (name.includes('-gmax')) return { name: `Gigantamax ${b}`, label: 'Gigantamax' };
    if (name.includes('-alola')) return { name: `${b} de Alola`, label: 'Forma regional' };
    if (name.includes('-galar')) return { name: `${b} de Galar`, label: 'Forma regional' };
    if (name.includes('-hisui')) return { name: `${b} de Hisui`, label: 'Forma regional' };
    if (name.includes('-paldea')) return { name: `${b} de Paldea`, label: 'Forma regional' };
    return { name: formatName(name), label: 'Forma alternativa' };
}

export function renderForms(p: PokemonCore, forms: Pokemon[] | undefined): void {
    const container = $('#alternative-forms-container');
    if (!container) return;
    if (!forms) {
        container.innerHTML = '<div class="skeleton" style="min-height:160px;grid-column:1/-1"></div>';
        return;
    }

    const base = p.species.name;
    const cards: FormCard[] = [
        { name: p.displayName, label: 'Forma padrão', image: p.sprites.front_default ?? p.artwork, data: p.raw, id: p.id, current: true },
        ...forms.map((f) => ({
            ...labelFor(f.name, base),
            image: f.sprites.front_default ?? f.sprites.other?.['official-artwork']?.front_default ?? 'img/placeholder-pixel.png',
            data: f,
            id: f.id,
            current: false,
        })),
    ];
    if (p.sprites.front_shiny) {
        cards.push({ name: `${p.displayName} Shiny`, label: 'Forma brilhante', image: p.sprites.front_shiny, data: p.raw, id: null, current: false });
    }

    if (cards.length <= 1) {
        container.innerHTML = '<p class="forms__empty">Este Pokémon não possui formas alternativas conhecidas.</p>';
        return;
    }

    container.innerHTML = '<p class="forms__note">Toque em "Ver forma" para carregar todos os detalhes daquela variação.</p>';
    for (const c of cards) {
        const el = document.createElement('div');
        el.className = 'form-card' + (c.current ? ' is-current' : '');
        el.innerHTML = `
            <span class="form-card__badge">${c.current ? 'Atual' : escapeHtml(c.label)}</span>
            <div class="form-card__img"><img src="${c.image}" alt="${escapeHtml(c.name)}" loading="lazy" onerror="this.src='img/placeholder-pixel.png'"></div>
            <h4 class="form-card__name">${escapeHtml(c.name)}</h4>
            <div class="form-card__types">${c.data.types.map((t) => typeBadge(t.type.name, typeLabel(t.type.name))).join('')}</div>
            <div class="form-card__stats">${c.data.stats.map((s) => `<div class="form-card__stat"><b>${s.base_stat}</b><span>${STAT_SHORT[s.stat.name]}</span></div>`).join('')}</div>
            <div class="form-card__abilities">${c.data.abilities.map((a) => `<span class="form-card__ability${a.is_hidden ? ' is-hidden' : ''}">${escapeHtml(formatName(a.ability.name))}</span>`).join('')}</div>`;

        if (!c.current) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn btn--sm view-form-button';
            btn.innerHTML = `${svgIcon('i-sparkle')}<span>Ver forma</span>`;
            btn.addEventListener('click', () => {
                if (c.id == null) {
                    swapMainImage(c.image, true);
                    $$('#variants .variant').forEach((v) => v.classList.toggle('is-active', (v as HTMLElement).dataset.variant === 'shiny'));
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                    showToast('Forma shiny: só a aparência muda — os atributos são os mesmos.', 'info');
                    return;
                }
                goPokemon(c.id);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            });
            el.appendChild(btn);
        }
        container.appendChild(el);
    }
}
