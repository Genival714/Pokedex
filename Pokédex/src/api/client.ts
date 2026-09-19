/**
 * Cliente HTTP com três camadas de cache (memória → IndexedDB → rede),
 * deduplicação de requisições em voo, cancelamento por AbortSignal e
 * pool de concorrência.
 */

const DB_NAME = 'pokedex-cache';
const DB_VERSION = 1;
const STORE = 'responses';
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias — os dados da PokéAPI quase não mudam

interface CacheRow {
    url: string;
    data: unknown;
    ts: number;
}

const memory = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

/* ------------------------------------------------------------------ */
/* IndexedDB                                                           */
/* ------------------------------------------------------------------ */
let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDB(): Promise<IDBDatabase | null> {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve) => {
        if (typeof indexedDB === 'undefined') { resolve(null); return; }
        try {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'url' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
    return dbPromise;
}

async function idbGet(url: string): Promise<CacheRow | null> {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
        try {
            const tx = db.transaction(STORE, 'readonly');
            const req = tx.objectStore(STORE).get(url);
            req.onsuccess = () => resolve((req.result as CacheRow) ?? null);
            req.onerror = () => resolve(null);
        } catch {
            resolve(null);
        }
    });
}

async function idbSet(row: CacheRow): Promise<void> {
    const db = await openDB();
    if (!db) return;
    try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(row);
    } catch {
        /* cache é opcional */
    }
}

export async function clearCache(): Promise<void> {
    memory.clear();
    const db = await openDB();
    if (!db) return;
    try {
        db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
    } catch { /* ignora */ }
}

/* ------------------------------------------------------------------ */
/* fetch com cache                                                     */
/* ------------------------------------------------------------------ */
export class HttpError extends Error {
    constructor(public status: number, url: string) {
        super(`HTTP ${status} em ${url}`);
        this.name = 'HttpError';
    }
}

function abortError(): DOMException {
    return new DOMException('Requisição cancelada', 'AbortError');
}

export function isAbort(err: unknown): boolean {
    return err instanceof DOMException && err.name === 'AbortError';
}

/**
 * Busca JSON com cache. O `signal` cancela apenas a espera do chamador:
 * a requisição de rede continua e alimenta o cache para o próximo uso.
 */
export async function getJSON<T>(url: string, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw abortError();

    const cached = memory.get(url);
    if (cached !== undefined) return cached as T;

    let promise = inflight.get(url) as Promise<T> | undefined;
    if (!promise) {
        promise = (async () => {
            const row = await idbGet(url);
            if (row && Date.now() - row.ts < TTL_MS) {
                memory.set(url, row.data);
                return row.data as T;
            }
            const res = await fetch(url);
            if (!res.ok) throw new HttpError(res.status, url);
            const data = (await res.json()) as T;
            memory.set(url, data);
            void idbSet({ url, data, ts: Date.now() });
            return data;
        })();
        inflight.set(url, promise);
        promise.finally(() => inflight.delete(url)).catch(() => { /* já tratado pelo chamador */ });
    }

    if (!signal) return promise;

    return new Promise<T>((resolve, reject) => {
        const onAbort = () => reject(abortError());
        signal.addEventListener('abort', onAbort, { once: true });
        promise!.then(
            (v) => { signal.removeEventListener('abort', onAbort); resolve(v); },
            (e) => { signal.removeEventListener('abort', onAbort); reject(e); },
        );
    });
}

/** Executa tarefas assíncronas com concorrência limitada, na ordem de entrada. */
export async function pool<T>(
    tasks: Array<() => Promise<T>>,
    limit = 8,
    onResult?: (result: T, index: number) => void,
    signal?: AbortSignal,
): Promise<Array<T | undefined>> {
    const results: Array<T | undefined> = new Array(tasks.length);
    let next = 0;

    async function worker(): Promise<void> {
        while (next < tasks.length) {
            if (signal?.aborted) return;
            const index = next++;
            try {
                const value = await tasks[index]();
                results[index] = value;
                onResult?.(value, index);
            } catch (err) {
                if (isAbort(err)) return;
                results[index] = undefined;
            }
        }
    }

    await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker));
    return results;
}
