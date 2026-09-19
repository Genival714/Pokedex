import type { StatName, TypeName } from '../api/types';

export const MAX_SPECIES_ID = 1025;

export const ALL_TYPES: TypeName[] = [
    'normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground',
    'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy',
];

export const TYPE_COLORS: Record<TypeName, string> = {
    normal: '#9da0aa',
    fire: '#ff6b3d',
    water: '#4a90ff',
    grass: '#5fc46b',
    electric: '#f9d23c',
    ice: '#7ed8e8',
    fighting: '#e0483f',
    poison: '#b55ad8',
    ground: '#d9a45b',
    flying: '#94a8ff',
    psychic: '#ff5c9c',
    bug: '#a3c13a',
    rock: '#c7a94f',
    ghost: '#7a62b8',
    dragon: '#6f5cf5',
    dark: '#6d5f6e',
    steel: '#9aa7c4',
    fairy: '#f58bc0',
};

export const TYPE_NAMES_PT: Record<TypeName, string> = {
    normal: 'Normal', fire: 'Fogo', water: 'Água', grass: 'Planta', electric: 'Elétrico',
    ice: 'Gelo', fighting: 'Lutador', poison: 'Veneno', ground: 'Terra', flying: 'Voador',
    psychic: 'Psíquico', bug: 'Inseto', rock: 'Pedra', ghost: 'Fantasma', dragon: 'Dragão',
    dark: 'Sombrio', steel: 'Aço', fairy: 'Fada',
};

export const STAT_NAMES: Record<StatName, string> = {
    hp: 'HP',
    attack: 'Ataque',
    defense: 'Defesa',
    'special-attack': 'Atq. Esp.',
    'special-defense': 'Def. Esp.',
    speed: 'Velocidade',
};

export const STAT_SHORT: Record<StatName, string> = {
    hp: 'HP', attack: 'ATQ', defense: 'DEF', 'special-attack': 'ATQ.E', 'special-defense': 'DEF.E', speed: 'VEL',
};

export const STAT_ORDER: StatName[] = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];

/** Faixas de ID por geração (espécies). */
export const GENERATION_RANGES: Array<{ gen: number; region: string; from: number; to: number }> = [
    { gen: 1, region: 'Kanto', from: 1, to: 151 },
    { gen: 2, region: 'Johto', from: 152, to: 251 },
    { gen: 3, region: 'Hoenn', from: 252, to: 386 },
    { gen: 4, region: 'Sinnoh', from: 387, to: 493 },
    { gen: 5, region: 'Unova', from: 494, to: 649 },
    { gen: 6, region: 'Kalos', from: 650, to: 721 },
    { gen: 7, region: 'Alola', from: 722, to: 809 },
    { gen: 8, region: 'Galar', from: 810, to: 905 },
    { gen: 9, region: 'Paldea', from: 906, to: 1025 },
];

export function generationOf(id: number): { gen: number; region: string } | null {
    const g = GENERATION_RANGES.find((r) => id >= r.from && id <= r.to);
    return g ? { gen: g.gen, region: g.region } : null;
}

export const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];

/** Prioridade de version groups (mais recente primeiro) para escolher o método de aprendizado. */
export const VERSION_PRIORITY = [
    'scarlet-violet', 'legends-arceus', 'brilliant-diamond-shining-pearl',
    'sword-shield', 'lets-go-pikachu-lets-go-eevee', 'ultra-sun-ultra-moon',
    'sun-moon', 'omega-ruby-alpha-sapphire', 'x-y', 'black-2-white-2',
    'black-white', 'heartgold-soulsilver', 'platinum', 'diamond-pearl',
    'firered-leafgreen', 'emerald', 'ruby-sapphire', 'crystal', 'gold-silver', 'yellow', 'red-blue',
];

export const GROWTH_RATES: Record<string, string> = {
    slow: 'Lento', medium: 'Médio', fast: 'Rápido', 'medium-slow': 'Médio-lento',
    'slow-then-very-fast': 'Lento → muito rápido', 'fast-then-very-slow': 'Rápido → muito lento',
};

export const HABITATS: Record<string, string> = {
    cave: 'Caverna', forest: 'Floresta', grassland: 'Campo', mountain: 'Montanha', rare: 'Raro',
    'rough-terrain': 'Terreno acidentado', sea: 'Mar', urban: 'Urbano', 'waters-edge': 'Beira d\'água',
};

export const COLORS_PT: Record<string, string> = {
    black: 'Preto', blue: 'Azul', brown: 'Marrom', gray: 'Cinza', green: 'Verde', pink: 'Rosa',
    purple: 'Roxo', red: 'Vermelho', white: 'Branco', yellow: 'Amarelo',
};

export const SHAPES_PT: Record<string, string> = {
    ball: 'Esfera', squiggle: 'Serpentina', fish: 'Peixe', arms: 'Braços', blob: 'Amorfo', upright: 'Ereto',
    legs: 'Pernas', quadruped: 'Quadrúpede', wings: 'Asas', tentacles: 'Tentáculos', heads: 'Cabeças',
    humanoid: 'Humanoide', 'bug-wings': 'Inseto alado', armor: 'Blindado',
};

export const EGG_GROUPS_PT: Record<string, string> = {
    monster: 'Monstro', water1: 'Água 1', water2: 'Água 2', water3: 'Água 3', bug: 'Inseto', flying: 'Voador',
    ground: 'Terrestre', fairy: 'Fada', plant: 'Planta', humanshape: 'Humanoide', mineral: 'Mineral',
    indeterminate: 'Amorfo', ditto: 'Ditto', dragon: 'Dragão', 'no-eggs': 'Sem ovos',
};

export const MOVE_TARGETS_PT: Record<string, string> = {
    'selected-pokemon': 'Um alvo', 'all-opponents': 'Todos os oponentes', user: 'Usuário',
    'users-field': 'Campo do usuário', 'opponents-field': 'Campo adversário', 'entire-field': 'Campo inteiro',
    'random-opponent': 'Oponente aleatório', 'all-other-pokemon': 'Todos os outros', ally: 'Aliado',
    'user-or-ally': 'Usuário ou aliado', 'user-and-allies': 'Usuário e aliados', 'all-pokemon': 'Todos',
    'specific-move': 'Movimento específico', 'selected-pokemon-me-first': 'Um alvo (Me First)', 'all-allies': 'Todos os aliados',
    'fainting-pokemon': 'Pokémon desmaiando',
};

export const LEARN_METHODS_PT: Record<string, string> = {
    'level-up': 'Por nível', egg: 'Por ovo', tutor: 'Por tutor', machine: 'TM / TR',
};
