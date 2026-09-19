/**
 * Store observável minimalista + orquestração do carregamento de um Pokémon
 * com cancelamento (AbortController) e descarte de resultados obsoletos.
 */
import { HttpError, isAbort } from '../api/client';
import { artworkUrl } from '../api/pokeapi';
import { MAX_SPECIES_ID } from '../data/constants';
import { loadCore, loadExtra, type PokemonCore, type PokemonExtra, type PokemonView } from '../data/pokemon';
import * as persist from './persist';

type Events = {
    'loading:start': { idOrName: string | number };
    'loading:end': undefined;
    'pokemon:core': PokemonCore;
    'pokemon:extra': PokemonView & PokemonExtra;
    'error': { message: string };
    'favorites:change': persist.SavedPokemon[];
    'team:change': persist.SavedPokemon[];
    'theme:change': persist.Theme;
};

type Handler<K extends keyof Events> = (payload: Events[K]) => void;

class Emitter {
    private handlers = new Map<keyof Events, Set<(payload: unknown) => void>>();

    on<K extends keyof Events>(event: K, fn: Handler<K>): () => void {
        let set = this.handlers.get(event);
        if (!set) { set = new Set(); this.handlers.set(event, set); }
        const wrapped = fn as (payload: unknown) => void;
        set.add(wrapped);
        return () => { set?.delete(wrapped); };
    }

    emit<K extends keyof Events>(event: K, payload: Events[K]): void {
        this.handlers.get(event)?.forEach((fn) => {
            try { fn(payload); } catch (e) { console.error(`[store] handler ${event}`, e); }
        });
    }
}

class Store extends Emitter {
    current: PokemonView | null = null;
    loading = false;

    private controller: AbortController | null = null;
    private token = 0;

    /** Carrega um Pokémon; chamadas anteriores ainda em voo são canceladas. */
    async load(idOrName: string | number): Promise<PokemonView | null> {
        const key = String(idOrName).trim().toLowerCase();
        if (!key) return null;

        this.controller?.abort();
        const controller = new AbortController();
        this.controller = controller;
        const token = ++this.token;
        const stale = () => token !== this.token;

        this.loading = true;
        this.emit('loading:start', { idOrName: key });

        try {
            const core = await loadCore(key, controller.signal);
            if (stale()) return null;

            this.current = core;
            this.emit('pokemon:core', core);
            this.preloadNeighbors(core.id);

            const extra = await loadExtra(core, controller.signal);
            if (stale()) return null;

            const full = Object.assign(core, extra) as PokemonView & PokemonExtra;
            this.current = full;
            this.emit('pokemon:extra', full);
            return full;
        } catch (err) {
            if (isAbort(err) || stale()) return null;
            const message = err instanceof HttpError && err.status === 404
                ? 'Pokémon não encontrado. Verifique o nome ou número.'
                : navigator.onLine === false
                    ? 'Você está offline. Só é possível abrir Pokémon já visitados.'
                    : 'Não foi possível carregar os dados. Tente novamente.';
            this.emit('error', { message });
            return null;
        } finally {
            if (!stale()) {
                this.loading = false;
                this.emit('loading:end', undefined);
            }
        }
    }

    private preloadNeighbors(id: number): void {
        for (const n of [id - 1, id + 1]) {
            if (n >= 1 && n <= MAX_SPECIES_ID) {
                const img = new Image();
                img.decoding = 'async';
                img.src = artworkUrl(n);
            }
        }
    }

    /* ---------------- Favoritos ---------------- */
    toggleFavorite(p: persist.SavedPokemon): boolean {
        const list = persist.getFavorites();
        const exists = list.some((f) => f.id === p.id);
        const next = exists ? list.filter((f) => f.id !== p.id) : [...list, p];
        persist.setFavorites(next);
        this.emit('favorites:change', next);
        return !exists;
    }

    removeFavorite(id: number): void {
        const next = persist.getFavorites().filter((f) => f.id !== id);
        persist.setFavorites(next);
        this.emit('favorites:change', next);
    }

    /* ---------------- Time ---------------- */
    toggleTeam(p: persist.SavedPokemon): 'added' | 'removed' | 'full' {
        const list = persist.getTeam();
        if (list.some((m) => m.id === p.id)) {
            const next = list.filter((m) => m.id !== p.id);
            persist.setTeam(next);
            this.emit('team:change', next);
            return 'removed';
        }
        if (list.length >= persist.TEAM_MAX) return 'full';
        const next = [...list, p];
        persist.setTeam(next);
        this.emit('team:change', next);
        return 'added';
    }

    setTeam(list: persist.SavedPokemon[]): void {
        persist.setTeam(list);
        this.emit('team:change', persist.getTeam());
    }

    /* ---------------- Tema ---------------- */
    setTheme(theme: persist.Theme): void {
        document.documentElement.setAttribute('data-theme', theme);
        persist.setTheme(theme);
        this.emit('theme:change', theme);
    }

    toggleTheme(): persist.Theme {
        const next: persist.Theme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        this.setTheme(next);
        return next;
    }
}

export const store = new Store();

export function toSaved(p: PokemonView): persist.SavedPokemon {
    return { id: p.id, name: p.name, sprite: p.sprites.front_default, types: p.types };
}
