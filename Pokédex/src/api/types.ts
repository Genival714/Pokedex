/**
 * Subconjunto tipado das respostas da PokéAPI v2 usado pela aplicação.
 */

export interface NamedResource {
    name: string;
    url: string;
}

export interface LocalizedName {
    name: string;
    language: NamedResource;
}

export interface FlavorText {
    flavor_text: string;
    language: NamedResource;
    version?: NamedResource;
    version_group?: NamedResource;
}

export interface EffectEntry {
    effect: string;
    short_effect: string;
    language: NamedResource;
}

export type TypeName =
    | 'normal' | 'fire' | 'water' | 'grass' | 'electric' | 'ice' | 'fighting' | 'poison' | 'ground'
    | 'flying' | 'psychic' | 'bug' | 'rock' | 'ghost' | 'dragon' | 'dark' | 'steel' | 'fairy';

export type StatName = 'hp' | 'attack' | 'defense' | 'special-attack' | 'special-defense' | 'speed';

export interface PokemonSprites {
    front_default: string | null;
    back_default: string | null;
    front_shiny: string | null;
    back_shiny: string | null;
    front_female: string | null;
    back_female: string | null;
    front_shiny_female: string | null;
    back_shiny_female: string | null;
    other?: {
        'official-artwork'?: { front_default: string | null; front_shiny: string | null };
        home?: { front_default: string | null; front_shiny: string | null };
        dream_world?: { front_default: string | null };
        showdown?: { front_default: string | null; front_shiny: string | null };
    };
}

export interface PokemonMoveEntry {
    move: NamedResource;
    version_group_details: Array<{
        level_learned_at: number;
        move_learn_method: NamedResource;
        version_group: NamedResource;
    }>;
}

export interface Pokemon {
    id: number;
    name: string;
    height: number;
    weight: number;
    base_experience: number | null;
    order: number;
    is_default: boolean;
    types: Array<{ slot: number; type: NamedResource & { name: TypeName } }>;
    abilities: Array<{ ability: NamedResource; is_hidden: boolean; slot: number }>;
    stats: Array<{ base_stat: number; effort: number; stat: NamedResource & { name: StatName } }>;
    sprites: PokemonSprites;
    moves: PokemonMoveEntry[];
    species: NamedResource;
    cries?: { latest: string | null; legacy: string | null };
}

export interface PokemonSpecies {
    id: number;
    name: string;
    order: number;
    gender_rate: number;
    capture_rate: number;
    base_happiness: number | null;
    is_baby: boolean;
    is_legendary: boolean;
    is_mythical: boolean;
    hatch_counter: number | null;
    growth_rate: NamedResource | null;
    egg_groups: NamedResource[];
    color: NamedResource | null;
    shape: NamedResource | null;
    habitat: NamedResource | null;
    generation: NamedResource;
    evolves_from_species: NamedResource | null;
    evolution_chain: { url: string } | null;
    names: LocalizedName[];
    genera: Array<{ genus: string; language: NamedResource }>;
    flavor_text_entries: FlavorText[];
    varieties: Array<{ is_default: boolean; pokemon: NamedResource }>;
}

export interface EvolutionDetail {
    min_level: number | null;
    item: NamedResource | null;
    held_item: NamedResource | null;
    trigger: NamedResource | null;
    min_happiness: number | null;
    min_affection: number | null;
    min_beauty: number | null;
    time_of_day: string;
    known_move: NamedResource | null;
    known_move_type: NamedResource | null;
    location: NamedResource | null;
    needs_overworld_rain: boolean;
    gender: number | null;
    trade_species: NamedResource | null;
    party_species: NamedResource | null;
    party_type: NamedResource | null;
    relative_physical_stats: number | null;
    turn_upside_down: boolean;
}

export interface EvolutionChainLink {
    species: NamedResource;
    evolution_details: EvolutionDetail[];
    evolves_to: EvolutionChainLink[];
}

export interface EvolutionChain {
    id: number;
    chain: EvolutionChainLink;
}

export interface Encounter {
    location_area: NamedResource;
    version_details: Array<{
        version: NamedResource;
        max_chance: number;
        encounter_details: Array<{ chance: number; min_level: number; max_level: number; method: NamedResource }>;
    }>;
}

export interface TypeData {
    id: number;
    name: TypeName;
    damage_relations: {
        double_damage_from: NamedResource[];
        half_damage_from: NamedResource[];
        no_damage_from: NamedResource[];
        double_damage_to: NamedResource[];
        half_damage_to: NamedResource[];
        no_damage_to: NamedResource[];
    };
    pokemon: Array<{ slot: number; pokemon: NamedResource }>;
}

export interface Move {
    id: number;
    name: string;
    accuracy: number | null;
    power: number | null;
    pp: number | null;
    priority: number;
    effect_chance: number | null;
    damage_class: NamedResource | null;
    type: NamedResource & { name: TypeName };
    target: NamedResource | null;
    effect_entries: EffectEntry[];
    flavor_text_entries: FlavorText[];
    names: LocalizedName[];
    meta?: {
        ailment: NamedResource;
        category: NamedResource;
        crit_rate: number;
        drain: number;
        flinch_chance: number;
        healing: number;
        min_hits: number | null;
        max_hits: number | null;
        ailment_chance: number;
        stat_chance: number;
    } | null;
}

export interface Ability {
    id: number;
    name: string;
    is_main_series: boolean;
    names: LocalizedName[];
    effect_entries: EffectEntry[];
    flavor_text_entries: FlavorText[];
}

export interface ResourceList {
    count: number;
    results: NamedResource[];
}
