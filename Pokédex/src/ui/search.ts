/**
 * Busca no topo: sugestões com sprites, navegação por teclado e histórico.
 */
import { getPokemonIndex, spriteUrl, type IndexEntry } from '../api/pokeapi';
import { formatName } from '../data/i18n';
import { getHistory, pushHistory } from '../state/persist';
import { goPokemon } from '../state/router';
import { $, $$, debounce, escapeHtml, pad3 } from './dom';

let index: IndexEntry[] = [];

const el = {
    container: () => $('#search-container'),
    input: () => $<HTMLInputElement>('#search-input'),
    form: () => $<HTMLFormElement>('#search-form'),
    dropdown: () => $('#search-dropdown'),
    suggestions: () => $('#search-suggestions-container'),
    history: () => $('#search-history-container'),
};

export function initSearch(): void {
    const input = el.input();
    const form = el.form();
    const suggestions = el.suggestions();
    if (!input || !form || !suggestions) return;

    getPokemonIndex().then((list) => { index = list; }).catch(() => { /* busca direta ainda funciona */ });

    renderHistory();

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const term = input.value.trim().toLowerCase();
        if (!term) return;
        submit(term);
    });

    input.addEventListener('input', debounce(() => {
        const term = input.value.trim().toLowerCase();
        if (!term) { suggestions.classList.remove('show'); openDropdown(); return; }
        renderSuggestions(filter(term));
    }, 150));

    input.addEventListener('focus', () => {
        const term = input.value.trim().toLowerCase();
        if (term) renderSuggestions(filter(term));
        else suggestions.classList.remove('show');
        openDropdown();
    });

    input.addEventListener('keydown', (e) => {
        const items = $$('.suggestion-item', suggestions);
        if (!items.length || !suggestions.classList.contains('show')) return;
        const active = items.findIndex((i) => i.classList.contains('is-active'));
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items.forEach((it, i) => it.classList.toggle('is-active', i === next));
            items[next].scrollIntoView({ block: 'nearest' });
        } else if (e.key === 'Enter' && active >= 0) {
            e.preventDefault();
            items[active].click();
        }
    });

    document.addEventListener('click', (e) => {
        const c = el.container();
        if (c && !c.contains(e.target as Node)) closeDropdown();
    });
}

function submit(term: string): void {
    const input = el.input();
    closeDropdown();
    input?.blur();
    if (input) input.value = '';
    goPokemon(term);
}

/** Chamado pelo app quando um Pokémon carrega, para registrar no histórico. */
export function recordHistory(name: string): void {
    pushHistory(name);
    renderHistory();
}

function filter(term: string): IndexEntry[] {
    if (!index.length) return [];
    const numeric = /^\d+$/.test(term);
    const starts: IndexEntry[] = [];
    const contains: IndexEntry[] = [];
    for (const p of index) {
        if (numeric) {
            if (String(p.id).startsWith(term)) starts.push(p);
        } else if (p.name.startsWith(term)) starts.push(p);
        else if (p.name.includes(term)) contains.push(p);
        if (starts.length >= 8) break;
    }
    return [...starts, ...contains].slice(0, 8);
}

function renderSuggestions(list: IndexEntry[]): void {
    const suggestions = el.suggestions();
    if (!suggestions) return;
    suggestions.innerHTML = '';
    if (!list.length) { suggestions.classList.remove('show'); openDropdown(); return; }

    const ul = document.createElement('ul');
    ul.className = 'suggestion-list';
    list.forEach((p, i) => {
        const li = document.createElement('li');
        li.className = 'suggestion-item' + (i === 0 ? ' is-active' : '');
        li.setAttribute('role', 'option');
        li.innerHTML = `
            <div class="suggestion-item-content">
                <img src="${spriteUrl(p.id)}" alt="" loading="lazy" onerror="this.src='img/placeholder-pixel.png'">
                <span class="suggestion-item-name">${escapeHtml(formatName(p.name))}</span>
            </div>
            <span class="suggestion-item-id">#${pad3(p.id)}</span>`;
        li.addEventListener('click', () => submit(String(p.id)));
        ul.appendChild(li);
    });
    suggestions.appendChild(ul);
    suggestions.classList.add('show');
    openDropdown();
}

function renderHistory(): void {
    const history = el.history();
    if (!history) return;
    const items = getHistory();
    history.innerHTML = '';
    if (!items.length) {
        history.innerHTML = '<p class="history__empty">Digite um nome ou número para começar.</p>';
        return;
    }
    const label = document.createElement('span');
    label.className = 'history__label';
    label.textContent = 'Buscas recentes';
    const chips = document.createElement('div');
    chips.className = 'history__chips';
    for (const item of items) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'history-chip';
        chip.textContent = item.replace(/-/g, ' ');
        chip.addEventListener('click', () => submit(item));
        chips.appendChild(chip);
    }
    history.append(label, chips);
}

function openDropdown(): void {
    const dropdown = el.dropdown();
    const suggestions = el.suggestions();
    const history = el.history();
    if (!dropdown) return;
    const hasSuggestions = suggestions?.classList.contains('show') ?? false;
    history?.classList.toggle('is-visible', !hasSuggestions);
    dropdown.classList.add('is-open');
}

function closeDropdown(): void {
    el.dropdown()?.classList.remove('is-open');
}
