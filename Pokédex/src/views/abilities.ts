/**
 * Habilidades: renderiza os cards imediatamente e preenche descrições
 * conforme os detalhes chegam (stream).
 */
import { getAbility } from '../api/pokeapi';
import { isAbort, pool } from '../api/client';
import { ABILITY_DESCRIPTIONS_PT, abilityName, pickFlavorText, translateEffect } from '../data/i18n';
import type { PokemonCore } from '../data/pokemon';
import { $, escapeHtml } from '../ui/dom';
import { svgIcon } from '../ui/icons';

export function renderAbilities(p: PokemonCore, signal?: AbortSignal): void {
    const container = $('#abilities-container');
    if (!container) return;

    container.innerHTML = p.abilities.map((a, i) => `
        <div class="ability-card" data-index="${i}">
            <div class="ability-card__head">
                <h4 class="ability-card__name">${escapeHtml(abilityName(a.name))}</h4>
                ${a.hidden ? '<span class="ability-card__badge">Oculta</span>' : ''}
            </div>
            <div class="ability-card__body"><div class="skeleton" style="min-height:36px"></div></div>
        </div>`).join('');

    void pool(
        p.abilities.map((a) => () => getAbility(a.url, signal)),
        4,
        (ability, index) => {
            if (!ability) return;
            const card = container.querySelector<HTMLElement>(`.ability-card[data-index="${index}"] .ability-card__body`);
            if (!card) return;
            const original = p.abilities[index].name;
            const short = pickFlavorText(ability.flavor_text_entries);
            const detailed = ABILITY_DESCRIPTIONS_PT[original];
            const effect = ability.effect_entries.find((e) => e.language.name === 'en')?.effect;

            card.innerHTML = `
                ${short ? `<p class="ability-card__desc">${escapeHtml(short)}</p>` : ''}
                ${detailed ? `<p class="ability-card__detail">${escapeHtml(detailed)}</p>` : (!short ? '<p class="ability-card__desc">Descrição não disponível.</p>' : '')}
                ${effect ? `
                    <details>
                        <summary>Efeito em jogo ${svgIcon('i-chev-down')}</summary>
                        <p class="ability-card__effect">${escapeHtml(translateEffect(effect))}</p>
                    </details>` : ''}`;
        },
        signal,
    ).catch((err) => { if (!isAbort(err)) console.error(err); });
}
