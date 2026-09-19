/**
 * Hero: cabeçalho (nº, gênero, nome, tipos), tiles, palco com variações,
 * ações (favorito, time, comparar, compartilhar) e grito.
 */
import type { PokemonCore } from '../data/pokemon';
import { eggGroupLabel, typeLabel } from '../data/i18n';
import { MAX_SPECIES_ID, TYPE_COLORS } from '../data/constants';
import { isFavorite, isInTeam } from '../state/persist';
import { goView } from '../state/router';
import { $, $$, escapeHtml, pad3 } from '../ui/dom';
import { setAccent, swapMainImage } from '../ui/motion';
import { playCry } from '../audio/player';

const PLACEHOLDER = 'img/placeholder.png';
const PLACEHOLDER_PIXEL = 'img/placeholder-pixel.png';
const PLACEHOLDER_3D = 'img/placeholder-3d.png';

export function renderHero(p: PokemonCore): void {
    setAccent(TYPE_COLORS[p.types[0]], TYPE_COLORS[p.types[1] ?? p.types[0]]);

    $('#pokemon-id')!.textContent = `#${pad3(p.speciesId)}`;
    $('#pokemon-genus')!.textContent = p.genus;
    $('#pokemon-name')!.textContent = p.displayName;
    $('#pokemon-description')!.textContent = p.description;
    $('#pokemon-height')!.textContent = `${p.height} m`;
    $('#pokemon-weight')!.textContent = `${p.weight} kg`;
    $('#egg-groups')!.textContent = p.eggGroups.length ? p.eggGroups.map(eggGroupLabel).join(', ') : 'Não disponível';
    $('#stage-watermark')!.textContent = pad3(p.speciesId);

    // Tipos como links para o explorador filtrado
    $('#pokemon-types')!.innerHTML = p.types.map((t) =>
        `<button type="button" class="type-badge type-${t}" data-type="${t}" title="Explorar tipo ${typeLabel(t)}">${typeLabel(t)}</button>`,
    ).join('');
    $$('#pokemon-types [data-type]').forEach((b) => {
        b.addEventListener('click', () => goView('explorer', { type: (b as HTMLElement).dataset.type }));
    });

    renderStage(p);
    updateActionState(p.id);
    updateNav(p.id);

    const cryBtn = $<HTMLButtonElement>('#cry-button');
    if (cryBtn) {
        cryBtn.hidden = !p.cry;
        cryBtn.dataset.src = p.cry ?? '';
    }

    document.title = `${p.displayName} #${pad3(p.speciesId)} — Pokédex`;
}

function renderStage(p: PokemonCore): void {
    const s = p.sprites;
    const home = s.other?.home?.front_default ?? null;
    const shiny = s.other?.['official-artwork']?.front_shiny ?? s.front_shiny ?? null;
    const showdown = s.other?.showdown?.front_default ?? null;

    swapMainImage(p.artwork, !s.other?.['official-artwork']?.front_default);
    $<HTMLImageElement>('#main-pokemon-image')!.alt = p.displayName;

    setVariant('variant-art', p.artwork || PLACEHOLDER, 'art');
    setVariant('pixel-art-image', s.front_default ?? PLACEHOLDER_PIXEL, 'pixel', Boolean(s.front_default));
    setVariant('variant-shiny', shiny ?? PLACEHOLDER_PIXEL, 'shiny', Boolean(shiny));
    setVariant('model-3d', home ?? PLACEHOLDER_3D, 'home', Boolean(home));
    setVariant('variant-anim', showdown ?? PLACEHOLDER_PIXEL, 'anim', Boolean(showdown));

    $$('#variants .variant').forEach((v) => v.classList.toggle('is-active', (v as HTMLElement).dataset.variant === 'art'));
}

function setVariant(imgId: string, src: string, _variant: string, visible = true): void {
    const img = $<HTMLImageElement>(`#${imgId}`);
    const btn = img?.closest<HTMLElement>('.variant');
    if (!img) return;
    img.src = src;
    if (btn) btn.hidden = !visible;
}

export function updateActionState(id: number): void {
    const fav = $<HTMLButtonElement>('#favorite-button');
    if (fav) {
        const on = isFavorite(id);
        fav.setAttribute('aria-pressed', on ? 'true' : 'false');
        fav.title = on ? 'Remover dos favoritos' : 'Adicionar aos favoritos';
        const label = $('.favorite-label', fav);
        if (label) label.textContent = on ? 'Favorito' : 'Favoritar';
    }
    const team = $<HTMLButtonElement>('#team-button');
    if (team) {
        const on = isInTeam(id);
        team.setAttribute('aria-pressed', on ? 'true' : 'false');
        team.title = on ? 'Remover do time' : 'Adicionar ao time';
        const label = $('.team-label', team);
        if (label) label.textContent = on ? 'No time' : 'Time';
    }
}

function updateNav(id: number): void {
    const prev = $<HTMLButtonElement>('#prev-pokemon');
    const next = $<HTMLButtonElement>('#next-pokemon');
    if (prev) prev.disabled = id <= 1;
    // formas alternativas têm IDs 10000+: sem "próximo" natural
    if (next) next.disabled = id >= MAX_SPECIES_ID;
}

/** Wiring único (uma vez) dos controles do palco. */
export function initHero(): void {
    const group = $('#variants');
    group?.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.variant');
        if (!btn) return;
        const img = $<HTMLImageElement>('img', btn);
        if (!img?.src) return;
        const pixel = ['pixel', 'shiny', 'anim'].includes(btn.dataset.variant ?? '');
        swapMainImage(img.src, pixel);
        $$('.variant', group).forEach((v) => v.classList.toggle('is-active', v === btn));
    });

    const cryBtn = $<HTMLButtonElement>('#cry-button');
    cryBtn?.addEventListener('click', () => {
        const src = cryBtn.dataset.src;
        if (!src) return;
        const stage = $('#stage');
        stage?.classList.add('is-crying');
        cryBtn.classList.add('is-playing');
        playCry(src).finally(() => {
            stage?.classList.remove('is-crying');
            cryBtn.classList.remove('is-playing');
        });
    });
}

export function heroSkeleton(): void {
    $('#pokemon-name')!.textContent = 'Carregando…';
    $('#pokemon-description')!.textContent = escapeHtml('Buscando dados…');
}
