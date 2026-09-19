/**
 * Roteamento leve baseado em URL:
 *   ?pokemon=25          → view principal com o Pokémon
 *   #explorar?type=fire  → explorador (filtros no hash)
 *   #time                → time
 */
export type ViewName = 'pokemon' | 'explorer' | 'team';

export interface Route {
    view: ViewName;
    pokemon: string | null;
    params: URLSearchParams;
}

type Listener = (route: Route, source: 'push' | 'pop' | 'init') => void;
const listeners = new Set<Listener>();

export function parse(): Route {
    const url = new URL(window.location.href);
    const hash = url.hash.replace(/^#/, '');
    const [path, query = ''] = hash.split('?');
    const view: ViewName = path === 'explorar' ? 'explorer' : path === 'time' ? 'team' : 'pokemon';
    return { view, pokemon: url.searchParams.get('pokemon'), params: new URLSearchParams(query) };
}

function notify(source: 'push' | 'pop' | 'init'): void {
    const route = parse();
    listeners.forEach((fn) => fn(route, source));
}

export function onRoute(fn: Listener): () => void {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

/** Navega para um Pokémon (view principal), registrando no histórico. */
export function goPokemon(idOrName: string | number, replace = false): void {
    const url = new URL(window.location.href);
    url.searchParams.set('pokemon', String(idOrName));
    url.hash = '';
    const same = url.href === window.location.href;
    if (replace || same) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
    notify('push');
}

/** Navega para uma view secundária (explorador/time) com parâmetros no hash. */
export function goView(view: 'explorer' | 'team', params?: Record<string, string | undefined>): void {
    const url = new URL(window.location.href);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v);
    const q = qs.toString();
    url.hash = (view === 'explorer' ? 'explorar' : 'time') + (q ? `?${q}` : '');
    if (url.href !== window.location.href) history.pushState(null, '', url);
    notify('push');
}

/** Atualiza só os parâmetros do hash (sem novo item de histórico). */
export function replaceParams(view: 'explorer' | 'team', params: Record<string, string | undefined>): void {
    const url = new URL(window.location.href);
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const q = qs.toString();
    url.hash = (view === 'explorer' ? 'explorar' : 'time') + (q ? `?${q}` : '');
    history.replaceState(null, '', url);
}

export function goHome(): void {
    const url = new URL(window.location.href);
    url.hash = '';
    if (url.href !== window.location.href) history.pushState(null, '', url);
    notify('push');
}

export function startRouter(): Route {
    window.addEventListener('popstate', () => notify('pop'));
    const route = parse();
    notify('init');
    return route;
}
