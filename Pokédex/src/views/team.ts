/**
 * Time: até 6 Pokémon salvos localmente, com análise defensiva combinada
 * (heatmap tipos × membros), buracos defensivos e stats agregados.
 */
import { pool } from '../api/client';
import { artworkUrl, getPokemon, getType } from '../api/pokeapi';
import type { Pokemon, TypeName } from '../api/types';
import { ALL_TYPES, STAT_ORDER, STAT_SHORT, TYPE_COLORS } from '../data/constants';
import { formatName, typeLabel } from '../data/i18n';
import { damageMultipliers, formatMultiplier } from '../data/pokemon';
import { getTeam, TEAM_MAX, type SavedPokemon } from '../state/persist';
import { goPokemon, goView } from '../state/router';
import { store } from '../state/store';
import { $, escapeHtml, pad3 } from '../ui/dom';
import { svgIcon, typeBadge } from '../ui/icons';
import { showToast } from '../ui/toast';

interface Member {
    saved: SavedPokemon;
    data: Pokemon;
    multipliers: Record<TypeName, number>;
}

let initialized = false;
let renderToken = 0;

export function initTeam(): void {
    if (initialized) return;
    initialized = true;
    store.on('team:change', () => { if (!$('#view-team')?.hidden) void renderTeam(); });
}

export async function renderTeam(): Promise<void> {
    initTeam();
    const root = $('#view-team');
    if (!root) return;
    const token = ++renderToken;
    const team = getTeam();

    root.innerHTML = `
        <header class="explorer__head reveal" style="--i:0">
            <div>
                <h1 class="explorer__title">Meu time</h1>
                <p class="explorer__subtitle">${team.length} de ${TEAM_MAX} Pokémon${team.length ? ' · arraste para reordenar' : ''}</p>
            </div>
            <div class="explorer__actions">
                <button type="button" class="btn btn--ghost" id="team-explore">${svgIcon('i-search')}<span>Explorar</span></button>
                ${team.length ? `<button type="button" class="btn btn--ghost" id="team-clear">${svgIcon('i-trash')}<span>Limpar</span></button>` : ''}
            </div>
        </header>
        <div class="team__slots reveal" id="team-slots" style="--i:1"></div>
        <div id="team-analysis"></div>`;

    $('#team-explore', root)!.addEventListener('click', () => goView('explorer'));
    $('#team-clear', root)?.addEventListener('click', () => { store.setTeam([]); showToast('Time limpo', 'info'); });

    renderSlots(team);

    if (team.length === 0) {
        $('#team-analysis', root)!.innerHTML = `
            <div class="panel team__empty reveal" style="--i:2">
                ${svgIcon('i-pokeball')}
                <p>Seu time está vazio. Abra qualquer Pokémon e toque em <strong>Time</strong> para adicioná-lo — ou use o explorador.</p>
            </div>`;
        return;
    }

    $('#team-analysis', root)!.innerHTML = '<div class="panel reveal" style="--i:2"><div class="skeleton" style="min-height:200px"></div></div>';

    const [pokemons, typeDatas] = await Promise.all([
        pool(team.map((m) => () => getPokemon(m.id)), 6),
        Promise.all(ALL_TYPES.map((t) => getType(t))),
    ]);
    if (token !== renderToken) return;

    const typeMap = new Map(typeDatas.map((td) => [td.name, td]));
    const members: Member[] = [];
    team.forEach((saved, i) => {
        const data = pokemons[i];
        if (!data) return;
        const tds = data.types.map((t) => typeMap.get(t.type.name)!).filter(Boolean);
        members.push({ saved, data, multipliers: damageMultipliers(tds) });
    });

    renderAnalysis(members);
}

function renderSlots(team: SavedPokemon[]): void {
    const slots = $('#team-slots');
    if (!slots) return;
    slots.innerHTML = '';
    for (let i = 0; i < TEAM_MAX; i++) {
        const m = team[i];
        const el = document.createElement('div');
        el.className = 'slot' + (m ? ' is-filled' : '');
        if (m) {
            el.draggable = true;
            el.dataset.id = String(m.id);
            el.style.setProperty('--c', TYPE_COLORS[m.types[0] ?? 'normal']);
            el.innerHTML = `
                <button type="button" class="icon-btn slot__remove" aria-label="Remover ${escapeHtml(formatName(m.name))}">${svgIcon('i-close')}</button>
                <button type="button" class="slot__open" data-open="${m.id}">
                    <span class="slot__halo" aria-hidden="true"></span>
                    <img src="${artworkUrl(m.id)}" alt="" loading="lazy" onerror="this.src='img/placeholder.png'">
                    <span class="slot__id">#${pad3(m.id)}</span>
                    <span class="slot__name">${escapeHtml(formatName(m.name))}</span>
                    <span class="slot__types">${m.types.map((t) => typeBadge(t, typeLabel(t))).join('')}</span>
                </button>`;
            el.querySelector('.slot__remove')!.addEventListener('click', () => {
                store.toggleTeam(m);
                showToast(`${formatName(m.name)} removido do time`, 'info');
            });
            el.querySelector('.slot__open')!.addEventListener('click', () => goPokemon(m.id));
            el.addEventListener('dragstart', (e) => { e.dataTransfer?.setData('text/plain', String(i)); el.classList.add('is-dragging'); });
            el.addEventListener('dragend', () => el.classList.remove('is-dragging'));
        } else {
            el.innerHTML = `<button type="button" class="slot__add" data-add>${svgIcon('i-pokeball')}<span>Slot ${i + 1}</span></button>`;
            el.querySelector('[data-add]')!.addEventListener('click', () => goView('explorer'));
        }
        el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('is-over'); });
        el.addEventListener('dragleave', () => el.classList.remove('is-over'));
        el.addEventListener('drop', (e) => {
            e.preventDefault();
            el.classList.remove('is-over');
            const from = Number(e.dataTransfer?.getData('text/plain'));
            if (!Number.isFinite(from) || from === i) return;
            const list = getTeam();
            const [moved] = list.splice(from, 1);
            list.splice(Math.min(i, list.length), 0, moved);
            store.setTeam(list);
        });
        slots.appendChild(el);
    }
}

function renderAnalysis(members: Member[]): void {
    const root = $('#team-analysis');
    if (!root) return;

    // Heatmap: tipo atacante × membro
    const rows = ALL_TYPES.map((t) => {
        const weak = members.filter((m) => m.multipliers[t] > 1).length;
        const resist = members.filter((m) => m.multipliers[t] < 1).length;
        return { t, weak, resist, cells: members.map((m) => m.multipliers[t]) };
    });
    const holes = rows.filter((r) => r.weak >= Math.max(2, Math.ceil(members.length / 2)) && r.resist === 0);
    const solid = rows.filter((r) => r.weak === 0 && r.resist >= 2);

    // Cobertura ofensiva (tipos presentes no time)
    const coverage = new Set<TypeName>();
    members.forEach((m) => m.data.types.forEach((t) => coverage.add(t.type.name)));

    // Stats agregados
    const totals = STAT_ORDER.map((s) => ({
        name: s,
        sum: members.reduce((acc, m) => acc + (m.data.stats.find((x) => x.stat.name === s)?.base_stat ?? 0), 0),
    }));
    const maxSum = Math.max(...totals.map((t) => t.sum));

    const cellClass = (v: number) => v === 0 ? 'is-immune' : v >= 4 ? 'is-weak4' : v > 1 ? 'is-weak' : v < 1 ? 'is-resist' : '';

    root.innerHTML = `
        <div class="team__grid">
            <article class="panel reveal" style="--i:2">
                <header class="panel__head">
                    <h2 class="panel__title">Defesa combinada</h2>
                    <span class="panel__meta">Dano recebido por tipo</span>
                </header>
                <div class="table-wrap heat-wrap">
                    <table class="heat">
                        <thead><tr>
                            <th>Tipo atacante</th>
                            ${members.map((m) => `<th><img src="${m.saved.sprite ?? artworkUrl(m.saved.id)}" alt="${escapeHtml(formatName(m.saved.name))}" title="${escapeHtml(formatName(m.saved.name))}"></th>`).join('')}
                            <th>Fracos</th><th>Resistem</th>
                        </tr></thead>
                        <tbody>
                            ${rows.map((r) => `
                                <tr>
                                    <td>${typeBadge(r.t, typeLabel(r.t))}</td>
                                    ${r.cells.map((v) => `<td class="heat__cell ${cellClass(v)}">${formatMultiplier(v)}</td>`).join('')}
                                    <td class="num ${r.weak ? 'is-weak' : ''}">${r.weak}</td>
                                    <td class="num ${r.resist ? 'is-resist' : ''}">${r.resist}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </article>

            <article class="panel reveal" style="--i:3">
                <header class="panel__head"><h2 class="panel__title">Diagnóstico</h2></header>
                <div class="dmg-group" data-kind="weak">
                    <div class="dmg-group__title">Buracos defensivos <span class="pill__count">${holes.length}</span></div>
                    <div class="dmg-list">${holes.length ? holes.map((r) => `<span class="dmg-chip type-${r.t}">${typeLabel(r.t)}<span class="dmg-chip__x">${r.weak} fracos</span></span>`).join('') : '<span class="empty">Nenhum — boa cobertura!</span>'}</div>
                </div>
                <div class="dmg-group" data-kind="resist" style="margin-top:14px">
                    <div class="dmg-group__title">Bem protegido contra <span class="pill__count">${solid.length}</span></div>
                    <div class="dmg-list">${solid.length ? solid.map((r) => `<span class="dmg-chip type-${r.t}">${typeLabel(r.t)}<span class="dmg-chip__x">${r.resist} resistem</span></span>`).join('') : '<span class="empty">—</span>'}</div>
                </div>
                <div class="dmg-group" data-kind="normal" style="margin-top:14px">
                    <div class="dmg-group__title">Tipos no time <span class="pill__count">${coverage.size}</span></div>
                    <div class="dmg-list">${[...coverage].map((t) => typeBadge(t, typeLabel(t))).join('')}</div>
                </div>
            </article>

            <article class="panel reveal" style="--i:4">
                <header class="panel__head">
                    <h2 class="panel__title">Stats somados</h2>
                    <span class="panel__meta">Média ${Math.round(totals.reduce((a, t) => a + t.sum, 0) / members.length)}</span>
                </header>
                <div class="stats">
                    ${totals.map((t) => `
                        <div class="stat is-in" style="--pct:${(t.sum / maxSum) * 100}%">
                            <div class="stat__label">${STAT_SHORT[t.name]}</div>
                            <div class="stat__value">${t.sum}</div>
                            <div class="stat__track"><div class="stat__bar"></div></div>
                        </div>`).join('')}
                </div>
            </article>
        </div>`;
}
