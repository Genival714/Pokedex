/**
 * Persistência local (localStorage) com try/catch — favoritos, time,
 * histórico de buscas e tema.
 */
import type { TypeName } from '../api/types';

function read<T>(key: string, fallback: T): T {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function write(key: string, value: unknown): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch { /* quota / modo privado */ }
}

/* ---------------- Favoritos ---------------- */
export interface SavedPokemon {
    id: number;
    name: string;
    sprite: string | null;
    types: TypeName[];
}

const FAV_KEY = 'pokedex-favorites';
export const getFavorites = () => read<SavedPokemon[]>(FAV_KEY, []);
export const setFavorites = (list: SavedPokemon[]) => write(FAV_KEY, list);
export const isFavorite = (id: number) => getFavorites().some((f) => f.id === id);

/* ---------------- Time ---------------- */
const TEAM_KEY = 'pokedex-team';
export const TEAM_MAX = 6;
export const getTeam = () => read<SavedPokemon[]>(TEAM_KEY, []);
export const setTeam = (list: SavedPokemon[]) => write(TEAM_KEY, list.slice(0, TEAM_MAX));
export const isInTeam = (id: number) => getTeam().some((m) => m.id === id);

/* ---------------- Histórico ---------------- */
const HISTORY_KEY = 'pokedex-search-history';
export const getHistory = () => read<string[]>(HISTORY_KEY, []);
export function pushHistory(term: string): string[] {
    const list = getHistory().filter((t) => t !== term);
    list.unshift(term);
    const trimmed = list.slice(0, 10);
    write(HISTORY_KEY, trimmed);
    return trimmed;
}

/* ---------------- Tema ---------------- */
const THEME_KEY = 'pokedex-theme';
export type Theme = 'dark' | 'light';
export const getTheme = (): Theme => (read<string>(THEME_KEY, 'dark') === 'light' ? 'light' : 'dark');
export const setTheme = (t: Theme) => write(THEME_KEY, t);

/* ---------------- Player ---------------- */
export const getNumber = (key: string, fallback: number) => read<number>(key, fallback);
export const getBool = (key: string, fallback: boolean) => read<boolean>(key, fallback);
export const setValue = write;
