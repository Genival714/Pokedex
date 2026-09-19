/**
 * Painel "Ficha": dados da espécie (geração, habitat, captura, gênero,
 * felicidade, crescimento, EXP base, EVs, cor/forma, badges).
 */
import { COLORS_PT, GROWTH_RATES, HABITATS, SHAPES_PT, STAT_NAMES } from '../data/constants';
import { generationLabel, genderRatio, type PokemonCore } from '../data/pokemon';
import { $, escapeHtml } from '../ui/dom';
import { svgIcon } from '../ui/icons';

export function renderSpecies(p: PokemonCore): void {
    const container = $('#species-container');
    if (!container) return;
    const s = p.species;

    const badges: string[] = [];
    if (s.is_legendary) badges.push('<span class="badge badge--legendary">Lendário</span>');
    if (s.is_mythical) badges.push('<span class="badge badge--mythical">Mítico</span>');
    if (s.is_baby) badges.push('<span class="badge badge--baby">Bebê</span>');

    const gender = genderRatio(s.gender_rate);
    const genderHtml = gender
        ? `<div class="gender" style="--f:${gender.female}%">
               <div class="gender__bar"><span class="gender__m"></span><span class="gender__f"></span></div>
               <div class="gender__legend"><span>♂ ${fmtPct(gender.male)}</span><span>♀ ${fmtPct(gender.female)}</span></div>
           </div>`
        : '<span class="tile__value">Sem gênero</span>';

    const evs = p.stats.filter((st) => st.effort > 0).map((st) => `${st.effort} ${STAT_NAMES[st.name]}`).join(' · ') || '—';
    const capturePct = Math.round((s.capture_rate / 255) * 1000) / 10;

    container.innerHTML = `
        ${badges.length ? `<div class="badges">${badges.join('')}</div>` : ''}
        <div class="facts">
            ${fact('i-sparkle', 'Geração', generationLabel(s))}
            ${fact('i-pokeball', 'Taxa de captura', `${s.capture_rate} <small>(${capturePct}%)</small>`)}
            ${fact('i-egg', 'Habitat', s.habitat ? HABITATS[s.habitat.name] ?? s.habitat.name : '—')}
            ${fact('i-info', 'Felicidade base', s.base_happiness != null ? String(s.base_happiness) : '—')}
            ${fact('i-arrow-right', 'Crescimento', s.growth_rate ? GROWTH_RATES[s.growth_rate.name] ?? s.growth_rate.name : '—')}
            ${fact('i-special', 'EXP base', p.baseExperience != null ? String(p.baseExperience) : '—')}
            ${fact('i-physical', 'EVs concedidos', evs)}
            ${fact('i-status', 'Cor · forma', `${s.color ? COLORS_PT[s.color.name] ?? s.color.name : '—'} · ${s.shape ? SHAPES_PT[s.shape.name] ?? s.shape.name : '—'}`)}
            <div class="fact fact--wide">
                ${svgIcon('i-scale', 'fact__icon')}
                <span class="fact__label">Gênero</span>
                ${genderHtml}
            </div>
            ${s.hatch_counter != null ? fact('i-egg', 'Passos para chocar', `${(s.hatch_counter + 1) * 255}`) : ''}
        </div>`;
}

function fact(icon: string, label: string, value: string): string {
    return `
        <div class="fact">
            ${svgIcon(icon, 'fact__icon')}
            <span class="fact__label">${escapeHtml(label)}</span>
            <span class="fact__value">${value}</span>
        </div>`;
}

function fmtPct(v: number): string {
    return `${Number.isInteger(v) ? v : v.toFixed(1)}%`;
}
