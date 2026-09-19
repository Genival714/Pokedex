import type { Encounter } from '../api/types';
import { formatName } from '../data/i18n';
import { $ } from '../ui/dom';
import { svgIcon } from '../ui/icons';

export function renderLocations(encounters: Encounter[] | undefined): void {
    const container = $('#locations-container');
    if (!container) return;
    if (!encounters) {
        container.innerHTML = '<div class="skeleton" style="min-height:120px"></div>';
        return;
    }
    if (encounters.length === 0) {
        container.innerHTML = '<p class="locations__empty">Este Pokémon não é encontrado na natureza em nenhum jogo registrado.</p>';
        return;
    }

    const byVersion = new Map<string, Array<{ name: string; rate: number; levels: string }>>();
    for (const loc of encounters) {
        for (const vd of loc.version_details) {
            const list = byVersion.get(vd.version.name) ?? [];
            const rate = Math.min(100, vd.encounter_details.reduce((acc, d) => acc + d.chance, 0));
            const min = Math.min(...vd.encounter_details.map((d) => d.min_level));
            const max = Math.max(...vd.encounter_details.map((d) => d.max_level));
            list.push({ name: loc.location_area.name, rate, levels: min === max ? `Nv. ${min}` : `Nv. ${min}–${max}` });
            byVersion.set(vd.version.name, list);
        }
    }

    const list = document.createElement('div');
    list.className = 'locations';
    let i = 0;
    for (const [version, entries] of byVersion) {
        entries.sort((a, b) => b.rate - a.rate);
        const open = i++ === 0;
        const acc = document.createElement('div');
        acc.className = 'accordion' + (open ? ' is-open' : '');
        acc.innerHTML = `
            <button type="button" class="accordion__head" aria-expanded="${open}">
                <span>${formatName(version)}</span>
                <span class="accordion__meta">${entries.length} ${entries.length === 1 ? 'área' : 'áreas'}</span>
                ${svgIcon('i-chev-down')}
            </button>
            <div class="accordion__body"><div class="accordion__inner"><div class="accordion__list">
                ${entries.map((e) => `
                    <div class="loc" style="--pct:${e.rate}%">
                        <span class="loc__name">${e.name.replace(/-/g, ' ')} <small class="loc__levels">${e.levels}</small></span>
                        <span class="loc__rate">${e.rate}%</span>
                        <div class="loc__track"><div class="loc__bar"></div></div>
                    </div>`).join('')}
            </div></div></div>`;
        list.appendChild(acc);
    }
    container.innerHTML = '';
    container.appendChild(list);
}

export function initAccordions(): void {
    document.addEventListener('click', (e) => {
        const head = (e.target as HTMLElement).closest<HTMLElement>('.accordion__head');
        if (!head) return;
        const acc = head.closest('.accordion');
        const open = acc?.classList.toggle('is-open') ?? false;
        head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
}
