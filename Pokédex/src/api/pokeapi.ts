/**
 * Endpoints tipados da PokéAPI.
 */
import { getJSON, pool } from './client';
import type {
    Ability, Encounter, EvolutionChain, Move, Pokemon, PokemonSpecies, ResourceList, TypeData, TypeName,
} from './types';
import { ALL_TYPES, MAX_SPECIES_ID } from '../data/constants';

export const API = 'https://pokeapi.co/api/v2';
export const SPRITES = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';

export const artworkUrl = (id: number) => `${SPRITES}/other/official-artwork/${id}.png`;
export const spriteUrl = (id: number) => `${SPRITES}/${id}.png`;

export function idFromUrl(url: string): number {
    const parts = url.split('/').filter(Boolean);
    return Number(parts[parts.length - 1]);
}

export const getPokemon = (idOrName: string | number, signal?: AbortSignal) =>
    getJSON<Pokemon>(`${API}/pokemon/${String(idOrName).toLowerCase()}`, signal);

export const getSpeciesByUrl = (url: string, signal?: AbortSignal) => getJSON<PokemonSpecies>(url, signal);

export const getSpecies = (idOrName: string | number, signal?: AbortSignal) =>
    getJSON<PokemonSpecies>(`${API}/pokemon-species/${String(idOrName).toLowerCase()}`, signal);

export const getEvolutionChain = (url: string, signal?: AbortSignal) => getJSON<EvolutionChain>(url, signal);

export const getEncounters = (id: number, signal?: AbortSignal) =>
    getJSON<Encounter[]>(`${API}/pokemon/${id}/encounters`, signal);

export const getType = (name: TypeName | string, signal?: AbortSignal) =>
    getJSON<TypeData>(`${API}/type/${name}`, signal);

export const getMove = (urlOrName: string, signal?: AbortSignal) =>
    getJSON<Move>(urlOrName.startsWith('http') ? urlOrName : `${API}/move/${urlOrName}`, signal);

export const getAbility = (urlOrName: string, signal?: AbortSignal) =>
    getJSON<Ability>(urlOrName.startsWith('http') ? urlOrName : `${API}/ability/${urlOrName}`, signal);

/* ------------------------------------------------------------------ */
/* Índice leve (explorador + busca)                                    */
/* ------------------------------------------------------------------ */
export interface IndexEntry {
    id: number;
    name: string;
    types: TypeName[];
}

let indexPromise: Promise<IndexEntry[]> | null = null;

/**
 * Lista de todas as espécies (id + nome) e, em seguida, os tipos de cada uma
 * via 18 requisições a /type/{t} — tudo cacheado em IndexedDB.
 */
export function getPokemonIndex(onProgress?: (done: number, total: number) => void): Promise<IndexEntry[]> {
    if (indexPromise) return indexPromise;
    indexPromise = (async () => {
        const list = await getJSON<ResourceList>(`${API}/pokemon-species?limit=${MAX_SPECIES_ID}&offset=0`);
        const byId = new Map<number, IndexEntry>();
        for (const r of list.results) {
            const id = idFromUrl(r.url);
            if (id <= MAX_SPECIES_ID) byId.set(id, { id, name: r.name, types: [] });
        }

        let done = 0;
        await pool(
            ALL_TYPES.map((t) => () => getType(t)),
            6,
            (typeData) => {
                done++;
                onProgress?.(done, ALL_TYPES.length);
                if (!typeData) return;
                for (const p of typeData.pokemon) {
                    const id = idFromUrl(p.pokemon.url);
                    const entry = byId.get(id);
                    if (entry && !entry.types.includes(typeData.name)) {
                        // slot garante a ordem tipo primário → secundário
                        if (p.slot === 1) entry.types.unshift(typeData.name);
                        else entry.types.push(typeData.name);
                    }
                }
            },
        );

        return Array.from(byId.values()).sort((a, b) => a.id - b.id);
    })();
    indexPromise.catch(() => { indexPromise = null; });
    return indexPromise;
}
