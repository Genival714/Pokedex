import type { TypeName } from '../api/types';
import { ALL_TYPES } from '../data/constants';
import { typeLabel } from '../data/i18n';
import { formatMultiplier } from '../data/pokemon';
import { $ } from '../ui/dom';
import { svgIcon } from '../ui/icons';

export function damageChips(list: TypeName[], multipliers: Record<TypeName, number>): string {
    return list.map((t) =>
        `<span class="dmg-chip type-${t}">${typeLabel(t)}<span class="dmg-chip__x">${formatMultiplier(multipliers[t])}</span></span>`,
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

    const group = (kind: string, title: string, list: TypeName[]) => list.length === 0 ? '' : `
        <div class="dmg-group" data-kind="${kind}">
            <div class="dmg-group__title">${title} <span class="pill__count">${list.length}</span></div>
            <div class="dmg-list">${damageChips(list, multipliers)}</div>
        </div>`;

    container.innerHTML = `
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
