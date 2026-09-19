/**
 * Comparação de Pokémon.
 *  - Dois lados escolhíveis (o atual entra no lado A por padrão), com busca
 *    por sugestões, atalhos (time, favoritos, evoluções, aleatório) e inverter.
 *  - Veredito automático, radar com valores, barras espelhadas com diferença,
 *    vantagem de tipo, físico e habilidades.
 *  - Link compartilhável: ?pokemon=6&vs=9
 */
import { getPokemon, getPokemonIndex, getSpeciesByUrl, getEvolutionChain, getType, spriteUrl, artworkUrl, type IndexEntry } from '../api/pokeapi';
import type { Pokemon, TypeName } from '../api/types';
import { MAX_SPECIES_ID, STAT_NAMES, STAT_ORDER, TYPE_COLORS } from '../data/constants';
import { abilityName, formatName, typeLabel } from '../data/i18n';
import { attackMultiplier, flattenEvolution, formatMultiplier } from '../data/pokemon';
import { getFavorites, getTeam } from '../state/persist';
import { store } from '../state/store';
import { $, $$, debounce, escapeHtml, pad3, prefersReducedMotion } from '../ui/dom';
import { svgIcon, typeBadge } from '../ui/icons';
import { closeModal, openModal } from '../ui/overlays';
import { showToast } from '../ui/toast';

type Side = 'a' | 'b';
const sides: Record<Side, Pokemon | null> = { a: null, b: null };
let activeSide: Side = 'b';
let index: IndexEntry[] = [];
let evoIds: number[] = [];
let renderToken = 0;

const modal = () => $('#compare-modal');
const body = () => $('#compare-body');

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */
export function initCompare(): void {
    const m = modal();
    const b = body();
    if (!m || !b) return;

    b.innerHTML = `
        <div class="cmp-head">
            <div class="cmp-slot" data-side="a"></div>
            <button type="button" class="cmp-swap" id="compare-swap" aria-label="Inverter lados" title="Inverter lados">${svgIcon('i-swap')}</button>
            <div class="cmp-slot" data-side="b"></div>
        </div>

        <div class="cmp-search" id="compare-search">
            <div class="cmp-search__for" id="compare-search-for">Escolher oponente</div>
            <label class="field cmp-search__field">
                ${svgIcon('i-search', 'field__icon')}
                <input type="text" id="compare-search-input" placeholder="Digite nome ou número… (ex.: blastoise, 9)" autocomplete="off" spellcheck="false" aria-label="Buscar Pokémon para comparar" aria-autocomplete="list">
                <button type="button" id="compare-search-button" class="search__submit" aria-label="Buscar">${svgIcon('i-arrow-right')}</button>
            </label>
            <div class="cmp-suggest" id="compare-suggest" role="listbox" hidden></div>
            <div class="cmp-picks" id="compare-picks"></div>
        </div>

        <div class="comparison-results" id="compare-results"></div>`;

    getPokemonIndex().then((list) => { index = list; }).catch(() => { /* busca direta continua */ });

    $('#compare-button')?.addEventListener('click', () => open());
    $('#compare-swap', b)?.addEventListener('click', swap);

    // Slots: clicar em "trocar" define o lado ativo da busca
    b.addEventListener('click', (e) => {
        const change = (e.target as HTMLElement).closest<HTMLElement>('[data-change]');
        if (change) { setActiveSide(change.dataset.change as Side); $<HTMLInputElement>('#compare-search-input')?.focus(); return; }
        const clear = (e.target as HTMLElement).closest<HTMLElement>('[data-clear]');
        if (clear) { sides[clear.dataset.clear as Side] = null; setActiveSide(clear.dataset.clear as Side); renderAll(); return; }
        const pick = (e.target as HTMLElement).closest<HTMLElement>('[data-pick]');
        if (pick) { void choose(Number(pick.dataset.pick)); return; }
        const random = (e.target as HTMLElement).closest('[data-random]');
        if (random) { void choose(Math.ceil(Math.random() * MAX_SPECIES_ID)); return; }
        const sug = (e.target as HTMLElement).closest<HTMLElement>('.suggestion-item[data-id]');
        if (sug) { void choose(Number(sug.dataset.id)); return; }
    });

    const input = $<HTMLInputElement>('#compare-search-input', b)!;
    const suggest = $('#compare-suggest', b)!;

    input.addEventListener('input', debounce(() => renderSuggestions(input.value.trim().toLowerCase()), 120));
    input.addEventListener('focus', () => { if (input.value.trim()) renderSuggestions(input.value.trim().toLowerCase()); });
    input.addEventListener('keydown', (e) => {
        const items = $$('.suggestion-item', suggest);
        const open = !suggest.hidden && items.length > 0;
        const active = items.findIndex((i) => i.classList.contains('is-active'));
        if (e.key === 'Escape' && open) { e.stopPropagation(); suggest.hidden = true; return; }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            if (!open) return;
            e.preventDefault();
            const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items.forEach((it, i) => it.classList.toggle('is-active', i === next));
            items[next].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (open && active >= 0) items[active].click();
            else submitTyped();
        }
    });
    $('#compare-search-button', b)!.addEventListener('click', submitTyped);
    document.addEventListener('click', (e) => {
        if (!$('#compare-search')?.contains(e.target as Node)) suggest.hidden = true;
    });

    // Lado A acompanha o Pokémon atual enquanto o modal está fechado
    store.on('pokemon:core', (p) => {
        if (!m.classList.contains('is-open')) { sides.a = p.raw; }
        void loadEvolutions(p.raw);
        if (m.classList.contains('is-open')) renderAll();
    });

    // Ao fechar o modal (botão, scrim ou Esc), remove ?vs= da URL
    new MutationObserver(() => {
        if (!m.classList.contains('is-open')) {
            try {
                const url = new URL(location.href);
                if (url.searchParams.has('vs')) { url.searchParams.delete('vs'); history.replaceState(null, '', url); }
            } catch { /* ignora */ }
        }
    }).observe(m, { attributes: true, attributeFilter: ['class'] });

    // ?vs= na URL abre a comparação direto
    const vs = new URL(location.href).searchParams.get('vs');
    if (vs) {
        const unsub = store.on('pokemon:core', () => {
            unsub();
            void choose(vs, 'b').then(() => open());
        });
    }
}

/* ------------------------------------------------------------------ */
/* Ações                                                               */
/* ------------------------------------------------------------------ */
function open(): void {
    const m = modal();
    if (!m) return;
    if (!sides.a && store.current) sides.a = store.current.raw;
    setActiveSide(sides.b ? 'b' : 'b');
    openModal(m);
    renderAll();
    if (!sides.b) window.setTimeout(() => $<HTMLInputElement>('#compare-search-input')?.focus({ preventScroll: true }), 80);
}

function setActiveSide(side: Side): void {
    activeSide = side;
    $$('.cmp-slot').forEach((s) => s.classList.toggle('is-active', (s as HTMLElement).dataset.side === side));
    const label = $('#compare-search-for');
    if (label) label.textContent = side === 'a' ? 'Escolher o Pokémon da esquerda' : 'Escolher o oponente';
    const input = $<HTMLInputElement>('#compare-search-input');
    if (input) input.placeholder = side === 'a' ? 'Substituir o Pokémon da esquerda…' : 'Digite nome ou número… (ex.: blastoise, 9)';
}

function submitTyped(): void {
    const input = $<HTMLInputElement>('#compare-search-input');
    const term = input?.value.trim().toLowerCase();
    if (!term) return;
    // Prefere a primeira sugestão, se houver (evita erro de digitação)
    const first = $<HTMLElement>('#compare-suggest .suggestion-item');
    if (first && !$('#compare-suggest')!.hidden) { void choose(Number(first.dataset.id)); return; }
    void choose(term);
}

async function choose(idOrName: string | number, side: Side = activeSide): Promise<void> {
    const input = $<HTMLInputElement>('#compare-search-input');
    const suggest = $('#compare-suggest');
    if (suggest) suggest.hidden = true;
    document.body.classList.add('is-loading');
    try {
        const p = await getPokemon(idOrName);
        sides[side] = p;
        if (input) input.value = '';
        if (side === 'a' && sides.b) setActiveSide('b');
        else if (side === 'b') setActiveSide('b');
        renderAll();
        syncUrl();
    } catch {
        showToast('Pokémon não encontrado. Tente pelo número ou escolha uma sugestão.', 'error');
    } finally {
        document.body.classList.remove('is-loading');
    }
}

function swap(): void {
    if (!sides.a && !sides.b) return;
    [sides.a, sides.b] = [sides.b, sides.a];
    const btn = $('#compare-swap');
    btn?.classList.remove('is-spun'); void btn?.offsetWidth; btn?.classList.add('is-spun');
    renderAll();
    syncUrl();
}

function syncUrl(): void {
    try {
        const url = new URL(location.href);
        if (sides.b && sides.a && sides.a.id === store.current?.id) url.searchParams.set('vs', String(sides.b.id));
        else url.searchParams.delete('vs');
        history.replaceState(null, '', url);
    } catch { /* ignora */ }
}

async function loadEvolutions(p: Pokemon): Promise<void> {
    try {
        const species = await getSpeciesByUrl(p.species.url);
        if (!species.evolution_chain) { evoIds = []; return; }
        const chain = await getEvolutionChain(species.evolution_chain.url);
        evoIds = flattenEvolution(chain.chain).map((n) => n.id).filter((id) => id !== species.id);
        if (modal()?.classList.contains('is-open')) renderPicks();
    } catch { evoIds = []; }
}

/* ------------------------------------------------------------------ */
/* Render: cabeçalho, sugestões, atalhos                               */
/* ------------------------------------------------------------------ */
function renderAll(): void {
    renderSlots();
    renderPicks();
    void renderResults();
}

function slotHtml(side: Side): string {
    const p = sides[side];
    if (!p) {
        return `
            <button type="button" class="cmp-slot__empty" data-change="${side}">
                ${svgIcon('i-pokeball')}
                <span>${side === 'a' ? 'Escolher Pokémon' : 'Escolher oponente'}</span>
            </button>`;
    }
    const c = TYPE_COLORS[p.types[0].type.name];
    return `
        <div class="cmp-slot__card" style="--c:${c}">
            <span class="cmp-slot__halo" aria-hidden="true"></span>
            <img class="cmp-slot__img" src="${artworkUrl(p.id)}" alt="" onerror="this.src='${p.sprites.front_default ?? 'img/placeholder.png'}'">
            <div class="cmp-slot__info">
                <span class="cmp-slot__id">#${pad3(p.id)}</span>
                <h4 class="cmp-slot__name">${escapeHtml(formatName(p.name))}</h4>
                <div class="cmp-slot__types">${p.types.map((t) => typeBadge(t.type.name, typeLabel(t.type.name))).join('')}</div>
            </div>
            <div class="cmp-slot__actions">
                <button type="button" class="icon-btn" data-change="${side}" aria-label="Trocar" title="Trocar">${svgIcon('i-search')}</button>
                <button type="button" class="icon-btn" data-clear="${side}" aria-label="Remover" title="Remover">${svgIcon('i-close')}</button>
            </div>
        </div>`;
}

function renderSlots(): void {
    (['a', 'b'] as Side[]).forEach((side) => {
        const el = $(`.cmp-slot[data-side="${side}"]`);
        if (el) el.innerHTML = slotHtml(side);
    });
    setActiveSide(activeSide);
}

function renderSuggestions(term: string): void {
    const suggest = $('#compare-suggest');
    if (!suggest) return;
    if (!term || !index.length) { suggest.hidden = true; return; }
    const numeric = /^\d+$/.test(term);
    const starts: IndexEntry[] = [];
    const contains: IndexEntry[] = [];
    for (const p of index) {
        if (numeric ? String(p.id).startsWith(term) : p.name.startsWith(term)) starts.push(p);
        else if (!numeric && p.name.includes(term)) contains.push(p);
        if (starts.length >= 8) break;
    }
    const list = [...starts, ...contains].slice(0, 8);
    if (!list.length) { suggest.innerHTML = '<p class="history__empty">Nenhum Pokémon com esse nome.</p>'; suggest.hidden = false; return; }
    suggest.innerHTML = `<ul class="suggestion-list">${list.map((p, i) => `
        <li class="suggestion-item${i === 0 ? ' is-active' : ''}" role="option" data-id="${p.id}">
            <div class="suggestion-item-content">
                <img src="${spriteUrl(p.id)}" alt="" loading="lazy" onerror="this.src='img/placeholder-pixel.png'">
                <span class="suggestion-item-name">${escapeHtml(formatName(p.name))}</span>
                <span class="cmp-suggest__types">${p.types.map((t) => typeBadge(t, typeLabel(t))).join('')}</span>
            </div>
            <span class="suggestion-item-id">#${pad3(p.id)}</span>
        </li>`).join('')}</ul>`;
    suggest.hidden = false;
}

function renderPicks(): void {
    const box = $('#compare-picks');
    if (!box) return;
    const exclude = new Set([sides.a?.id, sides.b?.id].filter(Boolean) as number[]);
    const chip = (id: number, name: string, sprite?: string | null) =>
        `<button type="button" class="history-chip" data-pick="${id}"><img src="${sprite ?? spriteUrl(id)}" alt="" width="22" height="22" loading="lazy">${escapeHtml(formatName(name))}</button>`;

    const team = getTeam().filter((m) => !exclude.has(m.id));
    const favs = getFavorites().filter((f) => !exclude.has(f.id) && !team.some((m) => m.id === f.id)).slice(0, 8);
    const evos = evoIds.filter((id) => !exclude.has(id));
    const evoNames = new Map(index.map((p) => [p.id, p.name]));

    const group = (label: string, items: string) => items ? `<div class="cmp-picks__group"><span class="history__label">${label}</span><div class="history__chips">${items}</div></div>` : '';

    box.innerHTML = `
        ${group('Atalhos', `<button type="button" class="history-chip" data-random>${svgIcon('i-dice')}Aleatório</button>`)}
        <div id="compare-team-picks">${group('Meu time', team.map((m) => chip(m.id, m.name, m.sprite)).join(''))}</div>
        ${group('Favoritos', favs.map((f) => chip(f.id, f.name, f.sprite)).join(''))}
        ${group('Mesma linha evolutiva', evos.map((id) => chip(id, evoNames.get(id) ?? `#${id}`)).join(''))}`;
}

/* ------------------------------------------------------------------ */
/* Render: resultados                                                  */
/* ------------------------------------------------------------------ */
async function renderResults(): Promise<void> {
    const results = $('#compare-results');
    if (!results) return;
    const a = sides.a;
    const b = sides.b;
    if (!a || !b) {
        results.classList.remove('show');
        results.innerHTML = '';
        return;
    }
    const token = ++renderToken;
    results.classList.add('show');
    results.innerHTML = '<div class="skeleton" style="min-height:220px"></div>';

    const typeDatas = await Promise.all([...new Set([...a.types, ...b.types].map((t) => t.type.name))].map((t) => getType(t)));
    if (token !== renderToken) return;
    const td = new Map(typeDatas.map((t) => [t.name, t]));

    const aTypes = a.types.map((t) => t.type.name);
    const bTypes = b.types.map((t) => t.type.name);
    const cA = TYPE_COLORS[aTypes[0]];
    const cB = TYPE_COLORS[bTypes[0]];
    const nameA = formatName(a.name);
    const nameB = formatName(b.name);
    const statOf = (p: Pokemon, s: string) => p.stats.find((x) => x.stat.name === s)?.base_stat ?? 0;
    const valsA = STAT_ORDER.map((s) => statOf(a, s));
    const valsB = STAT_ORDER.map((s) => statOf(b, s));
    const totalA = valsA.reduce((x, y) => x + y, 0);
    const totalB = valsB.reduce((x, y) => x + y, 0);
    const winsA = valsA.filter((v, i) => v > valsB[i]).length;
    const winsB = valsB.filter((v, i) => v > valsA[i]).length;

    const bestAtk = (att: TypeName[], def: TypeName[]) => Math.max(...att.map((t) => attackMultiplier(td.get(t)!, def)));
    const advA = bestAtk(aTypes, bTypes);
    const advB = bestAtk(bTypes, aTypes);

    // Veredito
    let verdict: string;
    let winner: Side | null = null;
    if (winsA !== winsB) { winner = winsA > winsB ? 'a' : 'b'; }
    else if (totalA !== totalB) { winner = totalA > totalB ? 'a' : 'b'; }
    const wName = winner === 'a' ? nameA : nameB;
    verdict = winner
        ? `${wName} leva em ${winner === 'a' ? winsA : winsB} de 6 atributos (total ${winner === 'a' ? totalA : totalB} vs ${winner === 'a' ? totalB : totalA})`
        : `Empate técnico: ${winsA} × ${winsB} atributos, total ${totalA} vs ${totalB}`;
    const typeVerdict = advA > advB ? `${nameA} tem vantagem de tipo (${formatMultiplier(advA)})`
        : advB > advA ? `${nameB} tem vantagem de tipo (${formatMultiplier(advB)})`
        : 'Sem vantagem clara de tipo';

    const matchup = (att: TypeName[], def: TypeName[]) => att.map((t, i) => {
        const m = attackMultiplier(td.get(t)!, def);
        return `<span class="dmg-chip type-${t}" data-mult="${m}" style="--i:${i}">${typeLabel(t)}<span class="dmg-chip__x">${formatMultiplier(m)}</span></span>`;
    }).join('');

    const max = 200;
    const mirrorRows = STAT_ORDER.map((s, i) => {
        const va = valsA[i];
        const vb = valsB[i];
        const d = va - vb;
        const cls = d > 0 ? 'is-a' : d < 0 ? 'is-b' : 'is-tie';
        return `
            <div class="mirror__row ${cls}" style="--wa:${Math.min(100, (va / max) * 100)}%;--wb:${Math.min(100, (vb / max) * 100)}%;--ca:${cA};--cb:${cB}">
                <span class="mirror__val mirror__val--a">${va}</span>
                <span class="mirror__track mirror__track--a"><span class="mirror__bar"></span></span>
                <span class="mirror__label">${STAT_NAMES[s]}<small class="mirror__delta">${d === 0 ? '=' : (d > 0 ? '+' : '−') + Math.abs(d)}</small></span>
                <span class="mirror__track mirror__track--b"><span class="mirror__bar"></span></span>
                <span class="mirror__val mirror__val--b">${vb}</span>
            </div>`;
    }).join('');

    results.innerHTML = `
        <div class="cmp-verdict ${winner ? `is-${winner}` : ''}" style="--ca:${cA};--cb:${cB}">
            <div class="cmp-verdict__main cmp__verdict">${svgIcon('i-trophy')}<span>${escapeHtml(verdict)}</span></div>
            <div class="cmp-verdict__sub">${svgIcon('i-swords')}<span>${escapeHtml(typeVerdict)}</span></div>
        </div>

        <div class="cmp">
            <article class="panel cmp__radar">
                <header class="panel__head"><h2 class="panel__title">Radar de stats</h2><span class="panel__meta">escala 0–200</span></header>
                ${radarSvg(valsA, valsB, cA, cB, nameA, nameB)}
                <div class="cmp__legend">
                    <span><i style="--c:${cA}"></i>${escapeHtml(nameA)} <b>${totalA}</b></span>
                    <span><i style="--c:${cB}"></i>${escapeHtml(nameB)} <b>${totalB}</b></span>
                </div>
            </article>

            <article class="panel cmp__mirror">
                <header class="panel__head"><h2 class="panel__title">Atributo a atributo</h2><span class="panel__meta">${winsA} × ${winsB}</span></header>
                <div class="mirror">
                    <div class="mirror__head" style="--ca:${cA};--cb:${cB}">
                        <span class="mirror__who mirror__who--a"><img src="${a.sprites.front_default ?? spriteUrl(a.id)}" alt="">${escapeHtml(nameA)}</span>
                        <span class="mirror__who mirror__who--b">${escapeHtml(nameB)}<img src="${b.sprites.front_default ?? spriteUrl(b.id)}" alt=""></span>
                    </div>
                    ${mirrorRows}
                    <div class="mirror__row mirror__row--total ${totalA > totalB ? 'is-a' : totalB > totalA ? 'is-b' : 'is-tie'}" style="--wa:${(totalA / Math.max(totalA, totalB)) * 100}%;--wb:${(totalB / Math.max(totalA, totalB)) * 100}%;--ca:${cA};--cb:${cB}">
                        <span class="mirror__val mirror__val--a">${totalA}</span>
                        <span class="mirror__track mirror__track--a"><span class="mirror__bar"></span></span>
                        <span class="mirror__label">Total<small class="mirror__delta">${totalA === totalB ? '=' : (totalA > totalB ? '+' : '−') + Math.abs(totalA - totalB)}</small></span>
                        <span class="mirror__track mirror__track--b"><span class="mirror__bar"></span></span>
                        <span class="mirror__val mirror__val--b">${totalB}</span>
                    </div>
                </div>
            </article>

            <article class="panel">
                <header class="panel__head"><h2 class="panel__title">Vantagem de tipo</h2></header>
                <div class="dmg-group" data-kind="weak">
                    <div class="dmg-group__title">${escapeHtml(nameA)} atacando ${escapeHtml(nameB)}</div>
                    <div class="dmg-list">${matchup(aTypes, bTypes)}</div>
                </div>
                <div class="dmg-group" data-kind="resist" style="margin-top:14px">
                    <div class="dmg-group__title">${escapeHtml(nameB)} atacando ${escapeHtml(nameA)}</div>
                    <div class="dmg-list">${matchup(bTypes, aTypes)}</div>
                </div>
            </article>

            <article class="panel">
                <header class="panel__head"><h2 class="panel__title">Físico e habilidades</h2></header>
                ${bars('Altura', a.height / 10, b.height / 10, 'm', cA, cB)}
                ${bars('Peso', a.weight / 10, b.weight / 10, 'kg', cA, cB)}
                ${bars('EXP base', a.base_experience ?? 0, b.base_experience ?? 0, '', cA, cB)}
                <div class="cmp-abil">
                    ${abilList(a, cA)}
                    ${abilList(b, cB)}
                </div>
            </article>
        </div>`;

    requestAnimationFrame(() => {
        results.querySelectorAll<HTMLElement>('.cmp__bar, .mirror__row').forEach((el) => el.classList.add('is-in'));
    });
}

function abilList(p: Pokemon, color: string): string {
    return `
        <div class="cmp-abil__col" style="--c:${color}">
            <span class="fact__label">${escapeHtml(formatName(p.name))}</span>
            <div class="comparison-abilities-list">
                ${p.abilities.map((ab) => `<span class="comparison-ability-item${ab.is_hidden ? ' hidden-ability' : ''}">${escapeHtml(abilityName(ab.ability.name))}${ab.is_hidden ? ' (oculta)' : ''}</span>`).join('')}
            </div>
        </div>`;
}

function bars(label: string, va: number, vb: number, unit: string, cA: string, cB: string): string {
    const max = Math.max(va, vb, 0.0001);
    const fmt = (v: number) => `${v}${unit ? ' ' + unit : ''}`;
    return `
        <div class="cmp__row">
            <span class="stat__label">${label}</span>
            <div class="cmp__bars">
                <div class="cmp__bar" style="--w:${(va / max) * 100}%;--c:${cA}"><span>${fmt(va)}</span></div>
                <div class="cmp__bar" style="--w:${(vb / max) * 100}%;--c:${cB}"><span>${fmt(vb)}</span></div>
            </div>
        </div>`;
}

/** Radar SVG com 6 eixos (escala 0–200), anéis com valor, pontos com tooltip. */
function radarSvg(a: number[], b: number[], cA: string, cB: string, nameA: string, nameB: string): string {
    const size = 340;
    const cx = size / 2;
    const cy = size / 2;
    const r = 118;
    const max = 200;
    const n = STAT_ORDER.length;
    const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const point = (i: number, v: number) => {
        const k = Math.min(1, v / max) * r;
        return [cx + k * Math.cos(angle(i)), cy + k * Math.sin(angle(i))] as const;
    };
    const poly = (vals: number[]) => vals.map((v, i) => point(i, v).join(',')).join(' ');
    const rings = [0.25, 0.5, 0.75, 1].map((k) =>
        `<polygon points="${STAT_ORDER.map((_, i) => point(i, max * k).join(',')).join(' ')}" class="radar__ring"/>
         <text x="${cx + 4}" y="${cy - k * r - 3}" class="radar__tick">${max * k}</text>`).join('');
    const axes = STAT_ORDER.map((_, i) => { const [x, y] = point(i, max); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar__axis"/>`; }).join('');
    const labels = STAT_ORDER.map((s, i) => {
        const [x, y] = point(i, max * 1.24);
        return `<text x="${x}" y="${y}" class="radar__label" text-anchor="middle" dominant-baseline="middle">${STAT_NAMES[s]}</text>`;
    }).join('');
    const dots = (vals: number[], c: string, name: string) => vals.map((v, i) => {
        const [x, y] = point(i, v);
        return `<circle cx="${x}" cy="${y}" r="4" class="radar__dot" style="--c:${c}"><title>${escapeHtml(name)} · ${STAT_NAMES[STAT_ORDER[i]]}: ${v}</title></circle>`;
    }).join('');
    const anim = prefersReducedMotion() ? '' : 'radar__poly--anim';
    return `
        <svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar comparando estatísticas de ${escapeHtml(nameA)} e ${escapeHtml(nameB)}">
            ${rings}${axes}
            <polygon points="${poly(a)}" class="radar__poly ${anim}" style="--c:${cA}"/>
            <polygon points="${poly(b)}" class="radar__poly ${anim}" style="--c:${cB};animation-delay:.15s"/>
            ${dots(a, cA, nameA)}${dots(b, cB, nameB)}
            ${labels}
        </svg>`;
}

export function closeCompare(): void {
    closeModal(modal());
}
