import type { TypeName } from '../api/types';
import { ALL_TYPES } from '../data/constants';
import { typeLabel } from '../data/i18n';
import { formatMultiplier } from '../data/pokemon';
import { $ } from '../ui/dom';
import { svgIcon } from '../ui/icons';

/** Chips de tipo com multiplicador; `offset` mantém a animação escalonada entre grupos. */
export function damageChips(list: TypeName[], multipliers: Record<TypeName, number>, offset = 0): string {
    return list.map((t, i) =>
        `<span class="dmg-chip type-${t}" data-mult="${multipliers[t]}" style="--i:${offset + i}" title="${typeLabel(t)} causa ${formatMultiplier(multipliers[t])} de dano">${typeLabel(t)}<span class="dmg-chip__x">${formatMultiplier(multipliers[t])}</span></span>`,
    ).join('');
}

export function renderDamage(multipliers: Record<TypeName, number> | undefined): void {
    const container = $('#damage-relations-container');
    if (!container) return;
    if (!multipliers) {
        container.innerHTML = '<div class="skeleton" style="min-height:120px"></div>';
        return;
    }

    const weak = ALL_TYPES.filter((t) => multipliers[t] > 1).sort((a, b) => multipliers[b] - multipliers[a] || a.localeCompare(b));
    const resist = ALL_TYPES.filter((t) => multipliers[t] > 0 && multipliers[t] < 1).sort((a, b) => multipliers[a] - multipliers[b] || a.localeCompare(b));
    const immune = ALL_TYPES.filter((t) => multipliers[t] === 0);
    const normal = ALL_TYPES.filter((t) => multipliers[t] === 1);

    // Resumo: quanto do "espectro" de 18 tipos cai em cada faixa
    const total = ALL_TYPES.length;
    const pct = (n: number) => `${(n / total) * 100}%`;
    const score = resist.length + immune.length * 1.5 - weak.reduce((acc, t) => acc + (multipliers[t] >= 4 ? 2 : 1), 0);
    const grade = score >= 3 ? 'great' : score <= -2 ? 'bad' : 'ok';
    const gradeLabel = grade === 'great' ? 'Defesa sólida' : grade === 'bad' ? 'Defesa frágil' : 'Defesa equilibrada';

    let offset = 0;
    const group = (kind: string, title: string, list: TypeName[]) => {
        if (list.length === 0) return '';
        const html = `
            <div class="dmg-group" data-kind="${kind}">
                <div class="dmg-group__title">${title} <span class="pill__count">${list.length}</span></div>
                <div class="dmg-list">${damageChips(list, multipliers, offset)}</div>
            </div>`;
        offset += list.length;
        return html;
    };

    container.innerHTML = `
        <div class="dmg-summary">
            <div class="dmg-summary__bar" aria-hidden="true">
                ${weak.length ? `<span class="dmg-summary__seg" data-kind="weak" style="--w:${pct(weak.length)}"></span>` : ''}
                ${normal.length ? `<span class="dmg-summary__seg" data-kind="normal" style="--w:${pct(normal.length)}"></span>` : ''}
                ${resist.length ? `<span class="dmg-summary__seg" data-kind="resist" style="--w:${pct(resist.length)}"></span>` : ''}
                ${immune.length ? `<span class="dmg-summary__seg" data-kind="immune" style="--w:${pct(immune.length)}"></span>` : ''}
            </div>
            <div class="dmg-summary__legend">
                <span style="--kind-c:#ff5c6c"><i></i><b>${weak.length}</b> fraquezas</span>
                <span style="--kind-c:#5fc46b"><i></i><b>${resist.length}</b> resistências</span>
                <span style="--kind-c:#94a8ff"><i></i><b>${immune.length}</b> imunidades</span>
                <span class="dmg-summary__score" data-grade="${grade}">${gradeLabel}</span>
            </div>
        </div>
        ${group('weak', 'Fraco contra', weak)}
        ${group('resist', 'Resistente a', resist)}
        ${group('immune', 'Imune a', immune)}
        ${normal.length === 0 ? '' : `
        <div class="dmg-group" data-kind="normal">
            <details>
                <summary>Dano normal (${normal.length}) ${svgIcon('i-chev-down')}</summary>
                <div class="dmg-list">${damageChips(normal, multipliers)}</div>
            </details>
        </div>`}`;
}
