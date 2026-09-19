/**
 * Explorador: grade de todos os Pokémon com filtros (texto, tipos, geração),
 * ordenação, scroll infinito, aleatório e estado na URL.
 */
import { artworkUrl, getPokemonIndex, type IndexEntry } from '../api/pokeapi';
import type { TypeName } from '../api/types';
import { ALL_TYPES, GENERATION_RANGES, MAX_SPECIES_ID, ROMAN, TYPE_COLORS, generationOf } from '../data/constants';
import { formatName, typeLabel } from '../data/i18n';
import { getFavorites, getTeam } from '../state/persist';
import { goPokemon, replaceParams } from '../state/router';
import { $, $$, debounce, escapeHtml, pad3 } from '../ui/dom';
import { svgIcon, typeBadge } from '../ui/icons';

type Sort = 'id' | 'id-desc' | 'name' | 'name-desc';

interface Filters {
    q: string;
    types: TypeName[];
    gen: number | null;
    sort: Sort;
}

const BATCH = 40;
let index: IndexEntry[] = [];
let filters: Filters = { q: '', types: [], gen: null, sort: 'id' };
let visible = 0;
let results: IndexEntry[] = [];
let observer: IntersectionObserver | null = null;
let initialized = false;

export function initExplorer(): void {
    if (initialized) return;
    initialized = true;
    const root = $('#view-explorer');
    if (!root) return;

    root.innerHTML = `
        <header class="explorer__head reveal" style="--i:0">
            <div>
                <h1 class="explorer__title">Explorar</h1>
                <p class="explorer__subtitle" id="explorer-count">Carregando índice…</p>
            </div>
            <div class="explorer__actions">
                <button type="button" class="btn btn--accent" id="explorer-random">${svgIcon('i-sparkle')}<span>Aleatório</span></button>
            </div>
        </header>

        <div class="explorer__filters panel reveal" style="--i:1">
            <div class="explorer__row">
                <label class="field">
                    ${svgIcon('i-search', 'field__icon')}
                    <input type="search" id="explorer-q" placeholder="Filtrar por nome ou número…" autocomplete="off" aria-label="Filtrar por nome">
                </label>
                <label class="field field--select">
                    <span class="field__label">Geração</span>
                    <select id="explorer-gen" aria-label="Geração">
                        <option value="">Todas</option>
                        ${GENERATION_RANGES.map((g) => `<option value="${g.gen}">Geração ${ROMAN[g.gen - 1]} · ${g.region}</option>`).join('')}
                    </select>
                </label>
                <label class="field field--select">
                    <span class="field__label">Ordenar</span>
                    <select id="explorer-sort" aria-label="Ordenar">
                        <option value="id">Número ↑</option>
                        <option value="id-desc">Número ↓</option>
                        <option value="name">Nome A–Z</option>
                        <option value="name-desc">Nome Z–A</option>
                    </select>
                </label>
                <button type="button" class="btn btn--ghost btn--sm" id="explorer-clear">${svgIcon('i-close')}<span>Limpar</span></button>
            </div>
            <div class="explorer__types" id="explorer-types" role="group" aria-label="Filtrar por tipo">
                ${ALL_TYPES.map((t) => `<button type="button" class="type-badge type-${t}" data-type="${t}" aria-pressed="false">${typeLabel(t)}</button>`).join('')}
            </div>
        </div>

        <div class="explorer__grid" id="explorer-grid" aria-live="polite"></div>
        <div class="explorer__sentinel" id="explorer-sentinel"></div>
        <p class="explorer__empty" id="explorer-empty" hidden>Nenhum Pokémon corresponde aos filtros.</p>
    `;

    const q = $<HTMLInputElement>('#explorer-q', root)!;
    const gen = $<HTMLSelectElement>('#explorer-gen', root)!;
    const sort = $<HTMLSelectElement>('#explorer-sort', root)!;

    q.addEventListener('input', debounce(() => { filters.q = q.value.trim().toLowerCase(); apply(); }, 150));
    gen.addEventListener('change', () => { filters.gen = gen.value ? Number(gen.value) : null; apply(); });
    sort.addEventListener('change', () => { filters.sort = sort.value as Sort; apply(); });
    $('#explorer-clear', root)!.addEventListener('click', () => { setFilters({ q: '', types: [], gen: null, sort: 'id' }); apply(); });
    $('#explorer-random', root)!.addEventListener('click', () => {
        const pool = results.length ? results : index;
        const pick = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : Math.ceil(Math.random() * MAX_SPECIES_ID);
        goPokemon(pick);
        window.scrollTo({ top: 0 });
    });
    $('#explorer-types', root)!.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-type]');
        if (!btn) return;
        const t = btn.dataset.type as TypeName;
        filters.types = filters.types.includes(t) ? filters.types.filter((x) => x !== t) : [...filters.types, t].slice(-2);
        syncTypeButtons();
        apply();
    });

    $('#explorer-grid', root)!.addEventListener('click', (e) => {
        const card = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
        if (!card) return;
        goPokemon(Number(card.dataset.id));
        window.scrollTo({ top: 0 });
    });

    observer = new IntersectionObserver((entries) => {
        if (entries.some((en) => en.isIntersecting)) renderMore();
    }, { rootMargin: '600px 0px' });
    observer.observe($('#explorer-sentinel', root)!);

    const count = $('#explorer-count', root)!;
    getPokemonIndex((done, total) => { count.textContent = `Carregando tipos… ${done}/${total}`; })
        .then((list) => { index = list; apply(); })
        .catch(() => { count.textContent = 'Não foi possível carregar o índice. Verifique sua conexão.'; });
}

/** Aplica filtros vindos da URL (#explorar?type=fire&gen=1&q=char). */
export function showExplorer(params: URLSearchParams): void {
    initExplorer();
    const types = (params.get('type') ?? '').split(',').filter((t): t is TypeName => (ALL_TYPES as string[]).includes(t));
    const gen = params.get('gen') ? Number(params.get('gen')) : null;
    const sort = (params.get('sort') as Sort) || 'id';
    setFilters({ q: params.get('q') ?? '', types, gen: Number.isFinite(gen) && gen ? gen : null, sort });
    if (index.length) apply(false);
}

function setFilters(f: Filters): void {
    filters = f;
    const root = $('#view-explorer')!;
    $<HTMLInputElement>('#explorer-q', root)!.value = f.q;
    $<HTMLSelectElement>('#explorer-gen', root)!.value = f.gen ? String(f.gen) : '';
    $<HTMLSelectElement>('#explorer-sort', root)!.value = f.sort;
    syncTypeButtons();
}

function syncTypeButtons(): void {
    $$('#explorer-types [data-type]').forEach((b) => {
        const on = filters.types.includes((b as HTMLElement).dataset.type as TypeName);
        b.classList.toggle('is-on', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

function apply(syncUrl = true): void {
    const { q, types, gen, sort } = filters;
    const numeric = /^\d+$/.test(q);
    results = index.filter((p) => {
        if (q && !(numeric ? String(p.id).startsWith(q) : p.name.includes(q))) return false;
        if (types.length && !types.every((t) => p.types.includes(t))) return false;
        if (gen && generationOf(p.id)?.gen !== gen) return false;
        return true;
    });
    results.sort((a, b) => {
        switch (sort) {
            case 'id-desc': return b.id - a.id;
            case 'name': return a.name.localeCompare(b.name);
            case 'name-desc': return b.name.localeCompare(a.name);
            default: return a.id - b.id;
        }
    });

    const count = $('#explorer-count');
    if (count) count.textContent = `${results.length} de ${index.length} Pokémon`;
    const empty = $('#explorer-empty');
    if (empty) empty.hidden = results.length > 0;

    const grid = $('#explorer-grid');
    if (grid) grid.innerHTML = '';
    visible = 0;
    renderMore();

    if (syncUrl) {
        replaceParams('explorer', {
            q: q || undefined,
            type: types.length ? types.join(',') : undefined,
            gen: gen ? String(gen) : undefined,
            sort: sort !== 'id' ? sort : undefined,
        });
    }
}

function renderMore(): void {
    const grid = $('#explorer-grid');
    if (!grid || visible >= results.length) return;
    const favs = new Set(getFavorites().map((f) => f.id));
    const team = new Set(getTeam().map((m) => m.id));
    const slice = results.slice(visible, visible + BATCH);
    const frag = document.createDocumentFragment();
    slice.forEach((p, i) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'pcard';
        card.dataset.id = String(p.id);
        card.style.setProperty('--c', TYPE_COLORS[p.types[0] ?? 'normal']);
        card.style.setProperty('--i', String(i % BATCH));
        const gen = generationOf(p.id);
        card.innerHTML = `
            <span class="pcard__id">#${pad3(p.id)}</span>
            <span class="pcard__marks">
                ${favs.has(p.id) ? `<span class="pcard__mark" title="Favorito">${svgIcon('i-star')}</span>` : ''}
                ${team.has(p.id) ? `<span class="pcard__mark" title="No time">${svgIcon('i-pokeball')}</span>` : ''}
            </span>
            <span class="pcard__halo" aria-hidden="true"></span>
            <img class="pcard__img" src="${artworkUrl(p.id)}" alt="" loading="lazy" decoding="async" onerror="this.src='img/placeholder.png'">
            <span class="pcard__name">${escapeHtml(formatName(p.name))}</span>
            <span class="pcard__types">${p.types.map((t) => typeBadge(t, typeLabel(t))).join('')}</span>
            ${gen ? `<span class="pcard__gen">Gen ${ROMAN[gen.gen - 1]}</span>` : ''}`;
        frag.appendChild(card);
    });
    grid.appendChild(frag);
    visible += slice.length;
}
