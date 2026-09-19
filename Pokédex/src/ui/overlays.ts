/**
 * Overlays: drawer lateral (favoritos), modal (comparação) e bottom-sheet
 * (detalhes de movimento). Gerencia foco, Esc, scroll lock e ARIA.
 */
import { $, $$ } from './dom';

let lastFocused: Element | null = null;
const openStack: Array<() => void> = [];

function lockScroll(lock: boolean): void {
    document.body.classList.toggle('no-scroll', lock);
}

function remember(): void {
    lastFocused = document.activeElement;
}

function restoreFocus(): void {
    if (lastFocused instanceof HTMLElement) lastFocused.focus({ preventScroll: true });
}

/* ---------------- Drawer ---------------- */
export function openDrawer(): void {
    const drawer = $('#favorites-menu');
    const scrim = $('#favorites-scrim');
    const toggle = $('#favorites-toggle');
    if (!drawer || drawer.classList.contains('is-open')) return;
    remember();
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
    if (scrim) { scrim.hidden = false; requestAnimationFrame(() => scrim.classList.add('is-open')); }
    toggle?.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    $('.close-favorites', drawer)?.focus({ preventScroll: true });
    openStack.push(closeDrawer);
}

export function closeDrawer(): void {
    const drawer = $('#favorites-menu');
    const scrim = $('#favorites-scrim');
    const toggle = $('#favorites-toggle');
    if (!drawer || !drawer.classList.contains('is-open')) return;
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
    if (scrim) { scrim.classList.remove('is-open'); window.setTimeout(() => { scrim.hidden = true; }, 300); }
    toggle?.setAttribute('aria-expanded', 'false');
    popStack(closeDrawer);
    if (openStack.length === 0) lockScroll(false);
    restoreFocus();
}

/* ---------------- Modal ---------------- */
export function openModal(modal: HTMLElement | null): void {
    if (!modal || modal.classList.contains('is-open')) return;
    remember();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    const first = modal.querySelector<HTMLElement>('input, button');
    if (first) window.setTimeout(() => first.focus({ preventScroll: true }), 50);
    const close = () => closeModal(modal);
    openStack.push(close);
    (modal as HTMLElement & { __close?: () => void }).__close = close;
}

export function closeModal(modal: HTMLElement | null): void {
    if (!modal || !modal.classList.contains('is-open')) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    const close = (modal as HTMLElement & { __close?: () => void }).__close;
    if (close) popStack(close);
    if (openStack.length === 0) lockScroll(false);
    restoreFocus();
}

/* ---------------- Bottom-sheet ---------------- */
export function openSheet(title: string, bodyHtml: string): HTMLElement {
    let sheet = $('#sheet');
    if (!sheet) {
        sheet = document.createElement('div');
        sheet.id = 'sheet';
        sheet.className = 'sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.innerHTML = `
            <div class="sheet__scrim" data-close-sheet></div>
            <div class="sheet__panel">
                <div class="sheet__grip" aria-hidden="true"></div>
                <div class="sheet__head">
                    <h3 class="sheet__title"></h3>
                    <button class="icon-btn" data-close-sheet aria-label="Fechar"><svg aria-hidden="true"><use href="#i-close"/></svg></button>
                </div>
                <div class="sheet__body"></div>
            </div>`;
        document.body.appendChild(sheet);
        sheet.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).closest('[data-close-sheet]')) closeSheet();
        });
    }
    const wasOpen = sheet.classList.contains('is-open');
    if (!wasOpen) remember();
    $('.sheet__title', sheet)!.textContent = title;
    $('.sheet__body', sheet)!.innerHTML = bodyHtml;
    requestAnimationFrame(() => sheet!.classList.add('is-open'));
    sheet.setAttribute('aria-hidden', 'false');
    lockScroll(true);
    if (!wasOpen) openStack.push(closeSheet);
    window.setTimeout(() => $('.sheet__body', sheet!)?.scrollTo({ top: 0 }), 0);
    return sheet;
}

export function closeSheet(): void {
    const sheet = $('#sheet');
    if (!sheet || !sheet.classList.contains('is-open')) return;
    sheet.classList.remove('is-open');
    sheet.setAttribute('aria-hidden', 'true');
    popStack(closeSheet);
    if (openStack.length === 0) lockScroll(false);
    restoreFocus();
}

/* ---------------- Util ---------------- */
function popStack(fn: () => void): void {
    const i = openStack.lastIndexOf(fn);
    if (i >= 0) openStack.splice(i, 1);
}

export function closeTopOverlay(): boolean {
    const top = openStack[openStack.length - 1];
    if (!top) return false;
    top();
    return true;
}

export function initOverlays(): void {
    const drawer = $('#favorites-menu');
    const scrim = $('#favorites-scrim');
    const toggle = $('#favorites-toggle');
    const modal = $('#compare-modal');

    toggle?.addEventListener('click', () => (drawer?.classList.contains('is-open') ? closeDrawer() : openDrawer()));
    scrim?.addEventListener('click', closeDrawer);
    $$('.close-favorites').forEach((b) => b.addEventListener('click', closeDrawer));
    if (modal) {
        $$('[data-close-modal], .close-modal, #close-comparison', modal).forEach((b) => {
            b.addEventListener('click', () => closeModal(modal));
        });
    }

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (closeTopOverlay()) return;
        const dropdown = $('#search-dropdown');
        if (dropdown?.classList.contains('is-open')) {
            dropdown.classList.remove('is-open');
            $<HTMLInputElement>('#search-input')?.blur();
        }
    });
}
