/**
 * Comparação: dois Pokémon lado a lado com radar SVG de stats,
 * altura/peso, vantagem de tipo e habilidades.
 */
import { getPokemon, getType, spriteUrl } from '../api/pokeapi';
import type { Pokemon, TypeName } from '../api/types';
import { STAT_NAMES, STAT_ORDER, TYPE_COLORS } from '../data/constants';
import { formatName, typeLabel } from '../data/i18n';
import { attackMultiplier, formatMultiplier } from '../data/pokemon';
import { getTeam } from '../state/persist';
import { store } from '../state/store';
import { $, escapeHtml, pad3, prefersReducedMotion } from '../ui/dom';
import { svgIcon, typeBadge } from '../ui/icons';
import { openModal } from '../ui/overlays';
import { showToast } from '../ui/toast';

let rival: Pokemon | null = null;

export function initCompare(): void {
    const modal = $('#compare-modal');
    const button = $('#compare-button');
    const input = $<HTMLInputElement>('#compare-search-input');
    const search = $('#compare-search-button');
    if (!modal || !button || !input || !search) return;

    button.addEventListener('click', () => {
        openModal(modal);
        renderSlot1();
        renderTeamPicks();
        if (rival) void renderResults();
    });

    const go = () => {
        const term = input.value.trim().toLowerCase();
        if (term) void fetchRival(term);
    };
    search.addEventListener('click', go);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } });

    store.on('pokemon:core', () => { if (modal.classList.contains('is-open')) { renderSlot1(); if (rival) void renderResults(); } });
}

async function fetchRival(idOrName: string | number): Promise<void> {
    document.body.classList.add('is-loading');
    try {
        rival = await getPokemon(idOrName);
        renderSlot2();
        await renderResults();
    } catch {
        showToast('Pokémon não encontrado para comparação.', 'error');
    } finally {
        document.body.classList.remove('is-loading');
    }
}

function infoCard(p: Pokemon): string {
    return `
        <div class="compare-info">
            <img src="${p.sprites.front_default ?? spriteUrl(p.id)}" alt="">
            <div>
                <h4>${escapeHtml(formatName(p.name))}</h4>
                <div class="pokemon-types">${p.types.map((t) => typeBadge(t.type.name, typeLabel(t.type.name))).join('')}</div>
            </div>
        </div>`;
}

function renderSlot1(): void {
    const content = $('#compare-pokemon-1 .compare-pokemon-content');
    const current = store.current;
    if (content && current) content.innerHTML = infoCard(current.raw);
}

function renderSlot2(): void {
    const content = $('#compare-pokemon-2 .compare-pokemon-content');
    if (content && rival) content.innerHTML = infoCard(rival);
}

function renderTeamPicks(): void {
    const box = $('#compare-team-picks');
    if (!box) return;
    const team = getTeam().filter((m) => m.id !== store.current?.id);
    box.innerHTML = team.length
        ? `<span class="history__label">Comparar com o time</span><div class="history__chips">${team.map((m) =>
            `<button type="button" class="history-chip" data-id="${m.id}"><img src="${m.sprite ?? spriteUrl(m.id)}" alt="" width="22" height="22">${escapeHtml(formatName(m.name))}</button>`).join('')}</div>`
        : '';
    box.querySelectorAll<HTMLElement>('[data-id]').forEach((b) => b.addEventListener('click', () => void fetchRival(Number(b.dataset.id))));
}

async function renderResults(): Promise<void> {
    const results = $('.comparison-results');
    const a = store.current?.raw;
    const b = rival;
    if (!results || !a || !b) return;
    results.classList.add('show');

    const typeDatas = await Promise.all(
        [...new Set([...a.types, ...b.types].map((t) => t.type.name))].map((t) => getType(t)),
    );
    const td = new Map(typeDatas.map((t) => [t.name, t]));
    const aTypes = a.types.map((t) => t.type.name);
    const bTypes = b.types.map((t) => t.type.name);
    const cA = TYPE_COLORS[aTypes[0]];
    const cB = TYPE_COLORS[bTypes[0]];

    const statOf = (p: Pokemon, s: string) => p.stats.find((x) => x.stat.name === s)?.base_stat ?? 0;
    const totalA = STAT_ORDER.reduce((acc, s) => acc + statOf(a, s), 0);
    const totalB = STAT_ORDER.reduce((acc, s) => acc + statOf(b, s), 0);

    const matchup = (att: TypeName[], def: TypeName[]) => att.map((t) => {
        const m = attackMultiplier(td.get(t)!, def);
        return `<span class="dmg-chip type-${t}">${typeLabel(t)}<span class="dmg-chip__x">${formatMultiplier(m)}</span></span>`;
    }).join('');

    const bestAtk = (att: TypeName[], def: TypeName[]) => Math.max(...att.map((t) => attackMultiplier(td.get(t)!, def)));
    const advA = bestAtk(aTypes, bTypes);
    const advB = bestAtk(bTypes, aTypes);
    const verdict = advA > advB ? `${formatName(a.name)} leva vantagem de tipo`
        : advB > advA ? `${formatName(b.name)} leva vantagem de tipo` : 'Sem vantagem clara de tipo';

    results.innerHTML = `
        <div class="cmp">
            <article class="panel cmp__radar">
                <header class="panel__head"><h2 class="panel__title">Radar de stats</h2><span class="panel__meta">${totalA} vs ${totalB}</span></header>
                ${radarSvg(STAT_ORDER.map((s) => statOf(a, s)), STAT_ORDER.map((s) => statOf(b, s)), cA, cB)}
                <div class="cmp__legend">
                    <span><i style="--c:${cA}"></i>${escapeHtml(formatName(a.name))}</span>
                    <span><i style="--c:${cB}"></i>${escapeHtml(formatName(b.name))}</span>
                </div>
            </article>

            <article class="panel">
                <header class="panel__head"><h2 class="panel__title">Vantagem de tipo</h2></header>
                <p class="cmp__verdict">${svgIcon('i-swords')} ${escapeHtml(verdict)}</p>
                <div class="dmg-group" data-kind="weak">
                    <div class="dmg-group__title">${escapeHtml(formatName(a.name))} atacando</div>
                    <div class="dmg-list">${matchup(aTypes, bTypes)}</div>
                </div>
                <div class="dmg-group" data-kind="resist" style="margin-top:12px">
                    <div class="dmg-group__title">${escapeHtml(formatName(b.name))} atacando</div>
                    <div class="dmg-list">${matchup(bTypes, aTypes)}</div>
                </div>
            </article>

            <article class="panel">
                <header class="panel__head"><h2 class="panel__title">Físico</h2></header>
                ${bars('Altura', a.height / 10, b.height / 10, 'm', cA, cB)}
                ${bars('Peso', a.weight / 10, b.weight / 10, 'kg', cA, cB)}
                ${bars('EXP base', a.base_experience ?? 0, b.base_experience ?? 0, '', cA, cB)}
            </article>

            <div class="comparison-cards-container">
                ${card(a, b, cA)}
                ${card(b, a, cB)}
            </div>
        </div>`;

    requestAnimationFrame(() => results.querySelectorAll<HTMLElement>('.cmp__bar').forEach((el) => el.classList.add('is-in')));
}

function bars(label: string, va: number, vb: number, unit: string, cA: string, cB: string): string {
    const max = Math.max(va, vb, 0.0001);
    return `
        <div class="cmp__row">
            <span class="stat__label">${label}</span>
            <div class="cmp__bars">
                <div class="cmp__bar" style="--w:${(va / max) * 100}%;--c:${cA}"><span>${va}${unit ? ' ' + unit : ''}</span></div>
                <div class="cmp__bar" style="--w:${(vb / max) * 100}%;--c:${cB}"><span>${vb}${unit ? ' ' + unit : ''}</span></div>
            </div>
        </div>`;
}

function card(p: Pokemon, other: Pokemon, color: string): string {
    return `
        <div class="comparison-card" style="--c:${color}">
            <div class="comparison-card-header">
                <div class="comparison-name-container">
                    <h3>${escapeHtml(formatName(p.name))}</h3>
                    <div class="pokemon-id">#${pad3(p.id)}</div>
                </div>
                <div class="pokemon-types">${p.types.map((t) => typeBadge(t.type.name, typeLabel(t.type.name))).join('')}</div>
            </div>
            <div class="comparison-stats-container">
                <h4 class="comparison-section-title">Estatísticas</h4>
                <div class="comparison-stats-list">
                    ${STAT_ORDER.map((s) => {
                        const v = p.stats.find((x) => x.stat.name === s)?.base_stat ?? 0;
                        const o = other.stats.find((x) => x.stat.name === s)?.base_stat ?? 0;
                        return `
                            <div class="comparison-stat-item">
                                <div class="comparison-stat-name">${STAT_NAMES[s]}</div>
                                <div class="comparison-stat-value${v > o ? ' is-better' : ''}">${v}</div>
                                <div class="comparison-stat-bar-container"><div class="comparison-stat-bar" style="width:${Math.min(100, (v / 200) * 100)}%"></div></div>
                            </div>`;
                    }).join('')}
                </div>
            </div>
            <div class="comparison-abilities-container">
                <h4 class="comparison-section-title">Habilidades</h4>
                <div class="comparison-abilities-list">
                    ${p.abilities.map((ab) => `<span class="comparison-ability-item${ab.is_hidden ? ' hidden-ability' : ''}">${escapeHtml(formatName(ab.ability.name))}${ab.is_hidden ? ' (Oculta)' : ''}</span>`).join('')}
                </div>
            </div>
        </div>`;
}

/** Radar SVG com 6 eixos (escala 0–200). */
function radarSvg(a: number[], b: number[], cA: string, cB: string): string {
    const size = 320;
    const cx = size / 2;
    const cy = size / 2;
    const r = 120;
    const max = 200;
    const n = STAT_ORDER.length;
    const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const point = (i: number, v: number) => {
        const k = Math.min(1, v / max) * r;
        return [cx + k * Math.cos(angle(i)), cy + k * Math.sin(angle(i))] as const;
    };
    const poly = (vals: number[]) => vals.map((v, i) => point(i, v).join(',')).join(' ');
    const rings = [0.25, 0.5, 0.75, 1].map((k) =>
        `<polygon points="${STAT_ORDER.map((_, i) => point(i, max * k).join(',')).join(' ')}" class="radar__ring"/>`).join('');
    const axes = STAT_ORDER.map((_, i) => { const [x, y] = point(i, max); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar__axis"/>`; }).join('');
    const labels = STAT_ORDER.map((s, i) => {
        const [x, y] = point(i, max * 1.22);
        return `<text x="${x}" y="${y}" class="radar__label" text-anchor="middle" dominant-baseline="middle">${STAT_NAMES[s]}</text>`;
    }).join('');
    const anim = prefersReducedMotion() ? '' : 'radar__poly--anim';
    return `
        <svg class="radar" viewBox="0 0 ${size} ${size}" role="img" aria-label="Radar comparando estatísticas">
            ${rings}${axes}
            <polygon points="${poly(a)}" class="radar__poly ${anim}" style="--c:${cA}"/>
            <polygon points="${poly(b)}" class="radar__poly ${anim}" style="--c:${cB};animation-delay:.15s"/>
            ${labels}
        </svg>`;
}
