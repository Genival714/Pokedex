import { svgIcon } from './icons';

type ToastType = 'info' | 'success' | 'error';
let timer: number | undefined;

export function showToast(message: string, type: ToastType = 'info'): void {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        document.body.appendChild(toast);
    }
    const icon = type === 'success' ? 'i-check' : type === 'error' ? 'i-alert' : 'i-info';
    toast.dataset.type = type;
    toast.innerHTML = `${svgIcon(icon)}<span>${message}</span>`;
    toast.classList.add('show');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => toast?.classList.remove('show'), 3000);
}
