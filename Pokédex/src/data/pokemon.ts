/**
 * Monta o modelo de visualização de um Pokémon a partir da PokéAPI,
 * em duas rodadas paralelas (core → extra), e utilitários de domínio.
 */
import { pool } from '../api/client';
import {
    getEncounters, getEvolutionChain, getPokemon, getSpeciesByUrl, getType, idFromUrl,
} from '../api/pokeapi';
import type {
    Encounter, EvolutionChainLink, EvolutionDetail, Pokemon, PokemonMoveEntry, PokemonSpecies, StatName, TypeData, TypeName,
} from '../api/types';
import { ALL_TYPES, VERSION_PRIORITY, generationOf } from './constants';
import { formatName, pickFlavorText, typeLabel } from './i18n';

/* ------------------------------------------------------------------ */
/* Modelo                                                              */
/* ------------------------------------------------------------------ */
export interface EvoNode {
    id: number;
    name: string;
    stage: number;
    condition: string | null; // condição para chegar a este estágio
}

export interface MoveRow {
    name: string;
    url: string;
    method: 'level' | 'egg' | 'tutor' | 'machine';
    level: number;
}

export interface PokemonCore {
    id: number;
    speciesId: number;
    name: string;
    displayName: string;
    genus: string;
    height: number; // m
    weight: number; // kg
    baseExperience: number | null;
    types: TypeName[];
    stats: Array<{ name: StatName; base: number; effort: number }>;
    abilities: Array<{ name: string; url: string; hidden: boolean }>;
    sprites: Pokemon['sprites'];
    artwork: string;
    cry: string | null;
    description: string;
    eggGroups: string[];
    moves: MoveRow[];
    species: PokemonSpecies;
    raw: Pokemon;
}

export interface PokemonExtra {
    multipliers: Record<TypeName, number>;
    evolution: EvoNode[];
    encounters: Encounter[];
    forms: Pokemon[];
}

export type PokemonView = PokemonCore & Partial<PokemonExtra>;

/* ------------------------------------------------------------------ */
/* Rodada 1: pokémon + espécie                                         */
/* ------------------------------------------------------------------ */
export async function loadCore(idOrName: string | number, signal?: AbortSignal): Promise<PokemonCore> {
    const pokemon = await getPokemon(idOrName, signal);
    const species = await getSpeciesByUrl(pokemon.species.url, signal);
    return buildCore(pokemon, species);
}

export function buildCore(pokemon: Pokemon, species: PokemonSpecies): PokemonCore {
    const genusEntry = species.genera.find((g) => ['pt-br', 'pt'].includes(g.language.name))
        ?? species.genera.find((g) => g.language.name === 'en');
    const other = pokemon.sprites.other ?? {};

    return {
        id: pokemon.id,
        speciesId: species.id,
        name: pokemon.name,
        displayName: formatName(pokemon.name),
        genus: genusEntry?.genus ?? '',
        height: pokemon.height / 10,
        weight: pokemon.weight / 10,
        baseExperience: pokemon.base_experience,
        types: pokemon.types.slice().sort((a, b) => a.slot - b.slot).map((t) => t.type.name),
        stats: pokemon.stats.map((s) => ({ name: s.stat.name, base: s.base_stat, effort: s.effort })),
        abilities: pokemon.abilities
            .slice().sort((a, b) => a.slot - b.slot)
            .map((a) => ({ name: a.ability.name, url: a.ability.url, hidden: a.is_hidden })),
        sprites: pokemon.sprites,
        artwork: other['official-artwork']?.front_default ?? pokemon.sprites.front_default ?? 'img/placeholder.png',
        cry: pokemon.cries?.latest ?? pokemon.cries?.legacy ?? null,
        description: pickFlavorText(species.flavor_text_entries) ?? 'Descrição não disponível.',
        eggGroups: species.egg_groups.map((g) => g.name),
        moves: normalizeMoves(pokemon.moves),
        species,
        raw: pokemon,
    };
}

/* ------------------------------------------------------------------ */
/* Rodada 2: evolução, encontros, tipos (dano), formas                 */
/* ------------------------------------------------------------------ */
export async function loadExtra(core: PokemonCore, signal?: AbortSignal): Promise<PokemonExtra> {
    const { species } = core;

    const [chain, encounters, typeDatas, forms] = await Promise.all([
        species.evolution_chain
            ? getEvolutionChain(species.evolution_chain.url, signal).catch(() => null)
            : Promise.resolve(null),
        getEncounters(core.id, signal).catch(() => [] as Encounter[]),
        Promise.all(core.types.map((t) => getType(t, signal))),
        loadForms(species, core.id, signal),
    ]);

    return {
        multipliers: damageMultipliers(typeDatas),
        evolution: chain ? flattenEvolution(chain.chain) : [],
        encounters,
        forms,
    };
}

async function loadForms(species: PokemonSpecies, currentId: number, signal?: AbortSignal): Promise<Pokemon[]> {
    const others = species.varieties.filter((v) => idFromUrl(v.pokemon.url) !== currentId);
    if (others.length === 0) return [];
    const results = await pool(
        others.map((v) => () => getPokemon(idFromUrl(v.pokemon.url), signal)),
        4, undefined, signal,
    );
    return results.filter((p): p is Pokemon => Boolean(p));
}

/* ------------------------------------------------------------------ */
/* Dano recebido                                                       */
/* ------------------------------------------------------------------ */
export function damageMultipliers(typeDatas: TypeData[]): Record<TypeName, number> {
    const m = Object.fromEntries(ALL_TYPES.map((t) => [t, 1])) as Record<TypeName, number>;
    for (const td of typeDatas) {
        for (const t of td.damage_relations.double_damage_from) m[t.name as TypeName] *= 2;
        for (const t of td.damage_relations.half_damage_from) m[t.name as TypeName] *= 0.5;
        for (const t of td.damage_relations.no_damage_from) m[t.name as TypeName] = 0;
    }
    return m;
}

/** Multiplicador de um tipo atacante contra uma lista de tipos defensores. */
export function attackMultiplier(attacker: TypeData, defenders: TypeName[]): number {
    let m = 1;
    const rel = attacker.damage_relations;
    for (const d of defenders) {
        if (rel.double_damage_to.some((t) => t.name === d)) m *= 2;
        else if (rel.half_damage_to.some((t) => t.name === d)) m *= 0.5;
        else if (rel.no_damage_to.some((t) => t.name === d)) m = 0;
    }
    return m;
}

export function formatMultiplier(m: number): string {
    if (m === 0) return '×0';
    if (m === 0.25) return '×¼';
    if (m === 0.5) return '×½';
    return `×${m}`;
}

/* ------------------------------------------------------------------ */
/* Evolução                                                            */
/* ------------------------------------------------------------------ */
export function flattenEvolution(chain: EvolutionChainLink): EvoNode[] {
    const out: EvoNode[] = [];
    const walk = (link: EvolutionChainLink, stage: number, condition: string | null) => {
        out.push({ id: idFromUrl(link.species.url), name: link.species.name, stage, condition });
        for (const next of link.evolves_to) {
            walk(next, stage + 1, describeCondition(next.evolution_details[0]));
        }
    };
    walk(chain, 0, null);
    return out;
}

export function describeCondition(d: EvolutionDetail | undefined): string {
    if (!d) return 'Condição especial';
    const parts: string[] = [];
    if (d.min_level) parts.push(`Nv. ${d.min_level}`);
    if (d.item) parts.push(formatName(d.item.name));
    if (d.trigger?.name === 'trade') parts.push('Troca');
    if (d.held_item) parts.push(`Segurando ${formatName(d.held_item.name)}`);
    if (d.min_happiness) parts.push('Amizade');
    if (d.min_affection) parts.push('Afeição');
    if (d.min_beauty) parts.push('Beleza');
    if (d.time_of_day) parts.push(d.time_of_day === 'day' ? 'Dia' : 'Noite');
    if (d.known_move) parts.push(`Golpe ${formatName(d.known_move.name)}`);
    if (d.known_move_type) parts.push(`Golpe ${typeLabel(d.known_move_type.name)}`);
    if (d.location) parts.push(formatName(d.location.name));
    if (d.needs_overworld_rain) parts.push('Chuva');
    if (d.gender === 1) parts.push('Fêmea');
    if (d.gender === 2) parts.push('Macho');
    if (d.trade_species) parts.push(`Troca por ${formatName(d.trade_species.name)}`);
    if (d.party_species) parts.push(`${formatName(d.party_species.name)} no time`);
    if (d.relative_physical_stats === 1) parts.push('Atq > Def');
    if (d.relative_physical_stats === -1) parts.push('Atq < Def');
    if (d.relative_physical_stats === 0) parts.push('Atq = Def');
    if (d.turn_upside_down) parts.push('Console invertido');
    if (d.trigger?.name === 'shed') parts.push('Espaço no time');
    if (parts.length === 0 && d.trigger?.name === 'level-up') parts.push('Subir de nível');
    return parts.join(' · ') || 'Condição especial';
}

/* ------------------------------------------------------------------ */
/* Movimentos                                                          */
/* ------------------------------------------------------------------ */
function normalizeMoves(moves: PokemonMoveEntry[]): MoveRow[] {
    const rows: MoveRow[] = [];
    for (const entry of moves) {
        const latest = entry.version_group_details.slice().sort((a, b) => {
            const ia = VERSION_PRIORITY.indexOf(a.version_group.name);
            const ib = VERSION_PRIORITY.indexOf(b.version_group.name);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        })[0];
        if (!latest) continue;
        const method = latest.move_learn_method.name;
        const mapped = method === 'level-up' ? 'level' : method === 'egg' ? 'egg' : method === 'tutor' ? 'tutor' : method === 'machine' ? 'machine' : null;
        if (!mapped) continue;
        rows.push({ name: entry.move.name, url: entry.move.url, method: mapped, level: latest.level_learned_at });
    }
    // Ordena por método; dentro de "level" por nível, nos demais por nome
    const order = { level: 0, egg: 1, tutor: 2, machine: 3 } as const;
    rows.sort((a, b) => order[a.method] - order[b.method]
        || (a.method === 'level' ? a.level - b.level : 0)
        || a.name.localeCompare(b.name));
    return rows;
}

/* ------------------------------------------------------------------ */
/* Espécie                                                             */
/* ------------------------------------------------------------------ */
export function generationLabel(species: PokemonSpecies): string {
    const fromId = generationOf(species.id);
    const num = Number((species.generation?.name ?? '').replace('generation-', '').toUpperCase()
        .replace(/^I$/, '1').replace(/^II$/, '2').replace(/^III$/, '3').replace(/^IV$/, '4')
        .replace(/^V$/, '5').replace(/^VI$/, '6').replace(/^VII$/, '7').replace(/^VIII$/, '8').replace(/^IX$/, '9'));
    const gen = Number.isFinite(num) && num > 0 ? num : fromId?.gen ?? 0;
    return gen ? `Geração ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'][gen - 1]}${fromId ? ` · ${fromId.region}` : ''}` : '—';
}

export function genderRatio(rate: number): { female: number; male: number } | null {
    if (rate < 0) return null;
    const female = (rate / 8) * 100;
    return { female, male: 100 - female };
}
