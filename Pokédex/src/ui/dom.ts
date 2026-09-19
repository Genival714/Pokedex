/** Helpers de DOM. */
export const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
    root.querySelector(sel) as T | null;

export const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
    Array.from(root.querySelectorAll(sel)) as T[];

export function escapeHtml(value: unknown): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/** Cria um elemento a partir de uma string HTML (um único nó raiz). */
export function html<T extends HTMLElement = HTMLElement>(markup: string): T {
    const tpl = document.createElement('template');
    tpl.innerHTML = markup.trim();
    return tpl.content.firstElementChild as T;
}

export const pad3 = (id: number | string) => String(id).padStart(3, '0');

export function prefersReducedMotion(): boolean {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, delay: number): (...args: A) => void {
    let t: number | undefined;
    return (...args: A) => {
        window.clearTimeout(t);
        t = window.setTimeout(() => fn(...args), delay);
    };
}
