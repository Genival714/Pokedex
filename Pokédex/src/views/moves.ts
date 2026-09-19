/**
 * Movimentos: tabela renderizada na hora com skeleton nas células de detalhe;
 * detalhes carregados com pool (aba ativa primeiro). Clique abre bottom-sheet.
 */
import { isAbort, pool } from '../api/client';
import { getMove } from '../api/pokeapi';
import type { Move } from '../api/types';
import { LEARN_METHODS_PT, MOVE_TARGETS_PT } from '../data/constants';
import { formatName, pickFlavorText, translateEffect, typeLabel } from '../data/i18n';
import type { MoveRow, PokemonCore } from '../data/pokemon';
import { $, $$, escapeHtml } from '../ui/dom';
import { svgIcon, typeBadge } from '../ui/icons';
import { openSheet } from '../ui/overlays';

type Method = MoveRow['method'];
const METHODS: Method[] = ['level', 'egg', 'tutor', 'machine'];
const METHOD_CELL: Record<Method, string> = { level: '', egg: 'Ovo', tutor: 'Tutor', machine: 'TM/TR' };

const details = new Map<string, Move>();

export function damageClassBadge(cls: string | null | undefined): string {
    switch (cls) {
        case 'physical': return `<span class="damage-physical" title="Movimento Físico">${svgIcon('i-physical')}Físico</span>`;
        case 'special': return `<span class="damage-special" title="Movimento Especial">${svgIcon('i-special')}Especial</span>`;
        case 'status': return `<span class="damage-status" title="Movimento de Status">${svgIcon('i-status')}Status</span>`;
        default: return `<span class="damage-unknown">—</span>`;
    }
}

export function renderMoves(p: PokemonCore, signal?: AbortSignal): void {
    const container = $('#moves-container');
    if (!container) return;

    const byMethod: Record<Method, MoveRow[]> = { level: [], egg: [], tutor: [], machine: [] };
    for (const m of p.moves) byMethod[m.method].push(m);

    const pills = document.createElement('div');
    pills.className = 'pills';
    pills.setAttribute('role', 'tablist');
    const wraps: Partial<Record<Method, HTMLElement>> = {};
    let active: Method = METHODS.find((m) => byMethod[m].length > 0) ?? 'level';

    METHODS.forEach((method) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'pill' + (method === active ? ' active' : '');
        pill.setAttribute('role', 'tab');
        pill.setAttribute('aria-selected', method === active ? 'true' : 'false');
        pill.innerHTML = `${LEARN_METHODS_PT[method === 'level' ? 'level-up' : method]} <span class="pill__count">${byMethod[method].length}</span>`;
        pill.addEventListener('click', () => {
            active = method;
            METHODS.forEach((m) => { const w = wraps[m]; if (w) w.hidden = m !== method; });
            $$('.pill', pills).forEach((b) => {
                const on = b === pill;
                b.classList.toggle('active', on);
                b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            prioritize(method);
        });
        pills.appendChild(pill);
    });

    container.innerHTML = '';
    container.appendChild(pills);

    METHODS.forEach((method) => {
        const wrap = document.createElement('div');
        wrap.className = 'table-wrap';
        wrap.id = `moves-${method}`;
        wrap.hidden = method !== active;
        wraps[method] = wrap;

        const rows = byMethod[method];
        wrap.innerHTML = `
            <table class="moves-table">
                <thead><tr>
                    <th>${method === 'level' ? 'Nível' : 'Método'}</th><th>Movimento</th><th>Tipo</th>
                    <th>Categoria</th><th>Poder</th><th>Precisão</th><th>PP</th>
                </tr></thead>
                <tbody>
                    ${rows.length === 0
                        ? '<tr><td colspan="7" class="no-moves-message">Nenhum movimento nesta categoria.</td></tr>'
                        : rows.map((r) => rowHtml(r, method, details.get(r.url))).join('')}
                </tbody>
            </table>`;
        container.appendChild(wrap);
    });

    // Delegação (atribuição direta evita listeners duplicados entre renders)
    const openFromEvent = (e: Event) => {
        const tr = (e.target as HTMLElement).closest<HTMLElement>('tr[data-url]');
        if (!tr) return;
        const url = tr.dataset.url!;
        const row = p.moves.find((m) => m.url === url);
        if (row) void openMoveSheet(row, details.get(url), signal);
    };
    container.onclick = openFromEvent;
    container.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFromEvent(e); }
    };

    // Carrega detalhes: aba ativa primeiro, depois as demais.
    const fill = (row: MoveRow, mv: Move) => {
        const tr = container.querySelector<HTMLElement>(`tr[data-url="${CSS.escape(row.url)}"]`);
        if (tr) tr.outerHTML = rowHtml(row, row.method, mv);
    };
    const load = (rows: MoveRow[], limit: number) => pool(
        rows.map((row) => async () => {
            const cached = details.get(row.url);
            if (cached) return cached;
            const mv = await getMove(row.url, signal); // dedupe de requisições em voo fica no client
            details.set(row.url, mv);
            return mv;
        }),
        limit,
        (mv, i) => { if (mv) fill(rows[i], mv); },
        signal,
    ).catch((err) => { if (!isAbort(err)) console.error(err); });

    // Ao trocar de aba, antecipa as linhas dela ainda pendentes
    function prioritize(method: Method): void {
        const pending = byMethod[method].filter((r) => !details.has(r.url));
        if (pending.length) void load(pending, 6);
    }

    const order = [active, ...METHODS.filter((m) => m !== active)];
    void load(order.flatMap((m) => byMethod[m]), 8);
}

function rowHtml(r: MoveRow, method: Method, mv?: Move): string {
    const first = method === 'level' ? (r.level || 'Evo.') : METHOD_CELL[method];
    const name = mv ? (mv.names.find((n) => n.language.name === 'en')?.name ?? formatName(mv.name)) : formatName(r.name);
    const cell = (v: string) => `<td class="num">${v}</td>`;
    return `
        <tr data-url="${escapeHtml(r.url)}" class="${mv ? '' : 'is-pending'}" tabindex="0" role="button" title="Ver detalhes">
            ${cell(String(first))}
            <td class="name">${escapeHtml(name)}</td>
            <td>${mv ? typeBadge(mv.type.name, typeLabel(mv.type.name)) : '<span class="skeleton skeleton--chip"></span>'}</td>
            <td>${mv ? damageClassBadge(mv.damage_class?.name) : '<span class="skeleton skeleton--chip"></span>'}</td>
            ${cell(mv ? String(mv.power ?? '—') : '…')}
            ${cell(mv ? (mv.accuracy ? `${mv.accuracy}%` : '—') : '…')}
            ${cell(mv ? String(mv.pp ?? '—') : '…')}
        </tr>`;
}

async function openMoveSheet(row: MoveRow, mv: Move | undefined, signal?: AbortSignal): Promise<void> {
    const title = mv ? (mv.names.find((n) => n.language.name === 'en')?.name ?? formatName(mv.name)) : formatName(row.name);
    if (!mv) {
        openSheet(title, '<div class="skeleton" style="min-height:120px"></div>');
        try {
            mv = await getMove(row.url, signal);
            details.set(row.url, mv);
        } catch {
            openSheet(title, '<p class="error-message">Não foi possível carregar este movimento.</p>');
            return;
        }
    }

    const flavor = pickFlavorText(mv.flavor_text_entries);
    const effectEntry = mv.effect_entries.find((e) => e.language.name === 'en');
    const effect = effectEntry
        ? translateEffect(effectEntry.effect.replace(/\$effect_chance/g, String(mv.effect_chance ?? '')))
        : null;
    const learn = row.method === 'level'
        ? (row.level ? `Nível ${row.level}` : 'Ao evoluir')
        : LEARN_METHODS_PT[row.method === 'egg' ? 'egg' : row.method === 'tutor' ? 'tutor' : 'machine'];

    const stat = (label: string, value: string) => `
        <div class="fact"><span class="fact__label">${label}</span><span class="fact__value">${value}</span></div>`;

    openSheet(title, `
        <div class="sheet__chips">
            ${typeBadge(mv.type.name, typeLabel(mv.type.name))}
            ${damageClassBadge(mv.damage_class?.name)}
            <span class="pill pill--static">${escapeHtml(learn)}</span>
        </div>
        ${flavor ? `<p class="sheet__desc">${escapeHtml(flavor)}</p>` : ''}
        <div class="facts facts--compact">
            ${stat('Poder', String(mv.power ?? '—'))}
            ${stat('Precisão', mv.accuracy ? `${mv.accuracy}%` : '—')}
            ${stat('PP', String(mv.pp ?? '—'))}
            ${stat('Prioridade', mv.priority > 0 ? `+${mv.priority}` : String(mv.priority))}
            ${stat('Alvo', mv.target ? MOVE_TARGETS_PT[mv.target.name] ?? formatName(mv.target.name) : '—')}
            ${mv.effect_chance != null ? stat('Chance de efeito', `${mv.effect_chance}%`) : ''}
            ${mv.meta?.crit_rate ? stat('Crítico', `+${mv.meta.crit_rate}`) : ''}
            ${mv.meta?.min_hits ? stat('Golpes', mv.meta.min_hits === mv.meta.max_hits ? String(mv.meta.min_hits) : `${mv.meta.min_hits}–${mv.meta.max_hits}`) : ''}
        </div>
        ${effect ? `<h4 class="sheet__subtitle">Efeito</h4><p class="sheet__effect">${escapeHtml(effect)}</p>` : ''}
    `);
}
