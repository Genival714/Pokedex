/**
 * Bootstrap da Pokédex: router → views, store → render, ações globais.
 */
import './styles/styles.css';
import './styles/features.css';
import './styles/player.css';

import { setupAudioControls } from './audio/player';
import { spriteUrl } from './api/pokeapi';
import { MAX_SPECIES_ID } from './data/constants';
import { formatName, typeLabel } from './data/i18n';
import type { PokemonCore, PokemonExtra, PokemonView } from './data/pokemon';
import { getFavorites, getTeam, getTheme, type SavedPokemon } from './state/persist';
import { goHome, goPokemon, goView, onRoute, startRouter, type Route } from './state/router';
import { store, toSaved } from './state/store';
import { $, $$, escapeHtml, pad3 } from './ui/dom';
import { svgIcon, typeBadge } from './ui/icons';
import { initParallax, reveal, withViewTransition } from './ui/motion';
import { closeDrawer, initOverlays } from './ui/overlays';
import { initSearch, recordHistory } from './ui/search';
import { initShortcuts } from './ui/shortcuts';
import { initSegmentedTabs } from './ui/tabs';
import { showToast } from './ui/toast';
import { renderAbilities } from './views/abilities';
import { initCompare } from './views/compare';
import { renderDamage } from './views/damage';
import { renderEvolution } from './views/evolution';
import { showExplorer } from './views/explorer';
import { renderForms } from './views/forms';
import { initHero, renderHero, updateActionState } from './views/hero';
import { initAccordions, renderLocations } from './views/locations';
import { renderMoves } from './views/moves';
import { renderSpecies } from './views/species';
import { renderSprites } from './views/sprites';
import { renderStats } from './views/stats';
import { renderTeam } from './views/team';

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */
type ViewName = Route['view'];
let currentView: ViewName | null = null;
let lastPokemonKey: string | null = null;

function showView(name: ViewName): void {
    if (currentView === name) return;
    currentView = name;
    withViewTransition(() => {
        $$('.view[data-view]').forEach((el) => {
            const on = (el as HTMLElement).dataset.view === name;
            el.hidden = !on;
        });
        $$('[data-nav]').forEach((el) => el.classList.toggle('is-active', (el as HTMLElement).dataset.nav === name));
        document.body.dataset.currentView = name;
    });
    if (name !== 'pokemon') window.scrollTo({ top: 0 });
}

function handleRoute(route: Route, source: 'push' | 'pop' | 'init'): void {
    showView(route.view);
    if (route.view === 'explorer') {
        showExplorer(route.params);
        document.title = 'Explorar — Pokédex';
        return;
    }
    if (route.view === 'team') {
        void renderTeam();
        document.title = 'Meu time — Pokédex';
        return;
    }
    const key = (route.pokemon ?? '25').toLowerCase();
    if (key !== lastPokemonKey || source === 'init') {
        lastPokemonKey = key;
        void store.load(key);
    } else if (store.current) {
        document.title = `${store.current.displayName} #${pad3(store.current.speciesId)} — Pokédex`;
    }
}

/* ------------------------------------------------------------------ */
/* Render                                                              */
/* ------------------------------------------------------------------ */
let renderSignal: AbortController | null = null;

function onCore(p: PokemonCore): void {
    renderSignal?.abort();
    renderSignal = new AbortController();
    const signal = renderSignal.signal;

    withViewTransition(() => {
        renderHero(p);
        renderSpecies(p);
        renderStats(p);
        renderSprites(p);
        // painéis da rodada 2 entram em skeleton
        renderDamage(undefined);
        renderEvolution(undefined, p.speciesId);
        renderLocations(undefined);
        renderForms(p, undefined);
    });
    renderAbilities(p, signal);
    renderMoves(p, signal);
    reveal($('#view-pokemon') ?? document);

    // A URL pode ter vindo com nome; normaliza para o ID (sem novo histórico)
    if (lastPokemonKey !== String(p.id)) {
        lastPokemonKey = String(p.id);
        goPokemon(p.id, true);
    }
    recordHistory(p.name);
}

function onExtra(p: PokemonView & PokemonExtra): void {
    renderDamage(p.multipliers);
    renderEvolution(p.evolution, p.speciesId);
    renderLocations(p.encounters);
    renderForms(p, p.forms);
}

/* ------------------------------------------------------------------ */
/* Favoritos (drawer) e time (contador)                                */
/* ------------------------------------------------------------------ */
function renderFavorites(list: SavedPokemon[] = getFavorites()): void {
    const badge = $('#favorites-count');
    if (badge) { badge.textContent = String(list.length); badge.hidden = list.length === 0; }

    const box = $('#favorites-list');
    if (!box) return;
    if (list.length === 0) {
        box.innerHTML = `<div class="no-favorites">${svgIcon('i-star')}<p>Nenhum favorito ainda.<br>Use o botão <strong>Favoritar</strong> em qualquer Pokémon.</p></div>`;
        return;
    }
    box.innerHTML = '';
    list.forEach((fav, i) => {
        const item = document.createElement('div');
        item.className = 'favorite-item';
        item.style.animationDelay = `${i * 40}ms`;
        item.setAttribute('role', 'button');
        item.tabIndex = 0;
        item.innerHTML = `
            <img src="${fav.sprite ?? spriteUrl(fav.id)}" alt="" loading="lazy">
            <div class="favorite-info">
                <span class="favorite-name">${escapeHtml(formatName(fav.name))}</span>
                <span class="favorite-id">#${pad3(fav.id)}</span>
                <div class="favorite-types">${fav.types.map((t) => typeBadge(t, typeLabel(t))).join('')}</div>
            </div>
            <button class="icon-btn favorite-remove" aria-label="Remover ${escapeHtml(formatName(fav.name))} dos favoritos">${svgIcon('i-trash')}</button>`;
        const open = () => { goPokemon(fav.id); closeDrawer(); window.scrollTo({ top: 0, behavior: 'smooth' }); };
        item.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('.favorite-remove')) { e.stopPropagation(); store.removeFavorite(fav.id); return; }
            open();
        });
        item.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
        box.appendChild(item);
    });
}

function renderTeamCount(list: SavedPokemon[] = getTeam()): void {
    const badge = $('#team-count');
    if (badge) { badge.textContent = String(list.length); badge.hidden = list.length === 0; }
}

/* ------------------------------------------------------------------ */
/* Ações do hero                                                       */
/* ------------------------------------------------------------------ */
function initActions(): void {
    $('#favorite-button')?.addEventListener('click', () => {
        const p = store.current;
        if (!p) return;
        const added = store.toggleFavorite(toSaved(p));
        showToast(added ? 'Adicionado aos favoritos' : 'Removido dos favoritos', added ? 'success' : 'info');
        updateActionState(p.id);
    });

    $('#team-button')?.addEventListener('click', () => {
        const p = store.current;
        if (!p) return;
        const result = store.toggleTeam(toSaved(p));
        if (result === 'full') { showToast('Seu time já tem 6 Pokémon.', 'error'); return; }
        showToast(result === 'added' ? `${p.displayName} entrou no time` : `${p.displayName} saiu do time`, result === 'added' ? 'success' : 'info');
        updateActionState(p.id);
    });

    $('#share-button')?.addEventListener('click', async () => {
        const p = store.current;
        if (!p) return;
        const url = `${location.origin}${location.pathname}?pokemon=${p.id}`;
        const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> };
        if (nav.share) {
            try { await nav.share({ title: `Pokédex — ${p.displayName}`, text: `Confira ${p.displayName} na Pokédex!`, url }); return; } catch { /* cai no clipboard */ }
        }
        try {
            await navigator.clipboard.writeText(url);
            showToast('Link copiado para a área de transferência', 'success');
        } catch {
            showToast(url, 'info');
        }
    });

    // Base = ID que está sendo carregado (permite cliques rápidos em sequência)
    const targetId = () => {
        const n = Number(lastPokemonKey);
        return Number.isFinite(n) && n > 0 ? n : (store.current?.id ?? 0);
    };
    $('#prev-pokemon')?.addEventListener('click', () => { const id = targetId(); if (id > 1) goPokemon(Math.min(id - 1, MAX_SPECIES_ID)); });
    $('#next-pokemon')?.addEventListener('click', () => { const id = targetId(); if (id < MAX_SPECIES_ID) goPokemon(id + 1); });

    $('#theme-toggle')?.addEventListener('click', () => {
        const t = store.toggleTheme();
        $('#theme-toggle')?.setAttribute('aria-pressed', t === 'dark' ? 'true' : 'false');
    });

    $$('[data-nav]').forEach((el) => el.addEventListener('click', (e) => {
        e.preventDefault();
        const target = (el as HTMLElement).dataset.nav as ViewName;
        if (target === 'pokemon') goHome(); else goView(target);
    }));

    $('#favorites-toggle')?.addEventListener('click', () => renderFavorites());
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */
function boot(): void {
    store.setTheme(getTheme());
    $('#theme-toggle')?.setAttribute('aria-pressed', getTheme() === 'dark' ? 'true' : 'false');

    store.on('loading:start', () => document.body.classList.add('is-loading'));
    store.on('loading:end', () => document.body.classList.remove('is-loading'));
    store.on('pokemon:core', onCore);
    store.on('pokemon:extra', onExtra);
    store.on('error', ({ message }) => {
        const banner = $('#error-message');
        if (banner) { banner.textContent = message; banner.hidden = false; window.setTimeout(() => { banner.hidden = true; }, 5000); }
    });
    store.on('favorites:change', (list) => renderFavorites(list));
    store.on('team:change', (list) => { renderTeamCount(list); if (store.current) updateActionState(store.current.id); });

    initOverlays();
    initShortcuts();
    initSegmentedTabs($('#view-pokemon') ?? document);
    initParallax();
    initAccordions();
    initHero();
    initSearch();
    initCompare();
    initActions();
    renderFavorites();
    renderTeamCount();
    setupAudioControls();

    window.addEventListener('online', () => showToast('Conexão restabelecida', 'success'));
    window.addEventListener('offline', () => showToast('Você está offline — só Pokémon já vistos abrem.', 'error'));

    onRoute(handleRoute);
    startRouter();
}

document.addEventListener('DOMContentLoaded', boot);
