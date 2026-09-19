/** Ícone do sprite SVG inline definido em index.html. */
export function svgIcon(id: string, cls = ''): string {
    return `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
}

export function typeBadge(type: string, label: string, extra = ''): string {
    return `<span class="type-badge type-${type} ${extra}">${label}</span>`;
}
