/**
 * Player de música "Now Playing": capa com o Pokémon de cada tema, disco com
 * anel de progresso, equalizador, fila de reprodução, Media Session e grito.
 * Layouts: desktop/tablet (pílula), celular em pé (barra + painel), deitado (compacto).
 */
import { artworkUrl } from '../api/pokeapi';
import { TYPE_COLORS } from '../data/constants';
import type { TypeName } from '../api/types';
import { getBool, getNumber, setValue } from '../state/persist';
import { $, $$, escapeHtml } from '../ui/dom';
import { svgIcon } from '../ui/icons';

interface Track {
    file: string;
    title: string;
    game: string;
    region: string;
    pokemon: number;   // Pokémon "capa" do tema
    type: TypeName;    // cor de destaque
}

const TRACKS: Track[] = [
    { file: 'Music/Battle Zone Routes 225-227 & Stark Mountain (Night)[Pokémon  Diamond & Pearl].mp3', title: 'Battle Zone · Stark Mountain (noite)', game: 'Diamond & Pearl', region: 'Sinnoh', pokemon: 485, type: 'fire' },
    { file: 'Music/Pokémon Diamond, Pearl & Platinum - Champion Cynthia Battle Music (HQ).mp3', title: 'Vs. Campeã Cynthia', game: 'Diamond, Pearl & Platinum', region: 'Sinnoh', pokemon: 445, type: 'dragon' },
    { file: 'Music/Pokémon Omega Ruby & Alpha Sapphire - Giratina Battle Music (HQ).mp3', title: 'Vs. Giratina', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', pokemon: 487, type: 'ghost' },
    { file: 'Music/Pokémon Diamond, Pearl & Platinum - Team Galactic Commander Battle Music (HQ).mp3', title: 'Vs. Comandante da Equipe Galáctica', game: 'Diamond, Pearl & Platinum', region: 'Sinnoh', pokemon: 430, type: 'dark' },
    { file: 'Music/Pokémon Omega Ruby & Alpha Sapphire - Frontier Brain Battle Music (HQ).mp3', title: 'Vs. Cérebro da Fronteira', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', pokemon: 65, type: 'psychic' },
    { file: 'Music/Pokémon HeartGold & SoulSilver - Super Ancient Pokémon Battle Music (HQ).mp3', title: 'Vs. Pokémon Super Ancestral', game: 'HeartGold & SoulSilver', region: 'Johto', pokemon: 383, type: 'ground' },
    { file: 'Music/Pokémon Omega Ruby & Alpha Sapphire - Vs Rayquaza (Highest Quality).mp3', title: 'Vs. Rayquaza', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', pokemon: 384, type: 'dragon' },
    { file: 'Music/Pokémon Omega Ruby & Alpha Sapphire - Vs Zinnia (Highest Quality).mp3', title: 'Vs. Zinnia', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', pokemon: 373, type: 'dragon' },
    { file: 'Music/Pokémon Diamond, Pearl & Platinum - Elite Four Battle Music (HQ).mp3', title: 'Vs. Elite dos Quatro', game: 'Diamond, Pearl & Platinum', region: 'Sinnoh', pokemon: 392, type: 'fire' },
    { file: 'Music/Pokémon Omega Ruby & Alpha Sapphire - Rival Battle Music (HQ).mp3', title: 'Vs. Rival', game: 'Omega Ruby & Alpha Sapphire', region: 'Hoenn', pokemon: 260, type: 'water' },
    { file: 'Music/Pokémon HeartGold & SoulSilver - Champion & Red Battle Music (HQ).mp3', title: 'Vs. Campeão & Red', game: 'HeartGold & SoulSilver', region: 'Johto', pokemon: 25, type: 'electric' },
    { file: 'Music/Pokemon FireRed LeafGreen- Trainer Battle!.mp3', title: 'Batalha de Treinador', game: 'FireRed & LeafGreen', region: 'Kanto', pokemon: 6, type: 'fire' },
];

const RING_R = 26;
const RING_LEN = 2 * Math.PI * RING_R;

/* ------------------------------------------------------------------ */
/* Player                                                              */
/* ------------------------------------------------------------------ */
class AudioPlayer {
    readonly audio = new Audio();
    index = 0;
    playing = false;
    volume = 0.5;
    minimized = false;
    shuffle = false;
    autoplayRequested = false;
    private durations = new Map<number, number>();

    constructor() {
        this.volume = Math.max(0, Math.min(1, getNumber('pokedex-music-volume', 0.5)));
        this.index = Math.min(TRACKS.length - 1, Math.max(0, getNumber('pokedex-music-track', 0)));
        this.minimized = getBool('pokedex-music-minimized', false);
        this.shuffle = getBool('pokedex-music-shuffle', false);
        this.autoplayRequested = getBool('pokedex-music-playing', false);
        this.audio.volume = this.volume;
        this.audio.preload = 'none';
        this.audio.src = encodeURI(TRACKS[this.index].file);
        this.audio.addEventListener('ended', () => this.next());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => { this.durations.set(this.index, this.audio.duration); this.updateProgress(); this.renderQueueDurations(); });
        this.audio.addEventListener('play', () => { this.playing = true; this.updateControls(); this.updateSession(); });
        this.audio.addEventListener('pause', () => { this.playing = false; this.updateControls(); this.updateSession(); });
    }

    get track(): Track { return TRACKS[this.index]; }
    trackName(): string { return this.track.title; }

    save(): void {
        setValue('pokedex-music-volume', this.volume);
        setValue('pokedex-music-playing', this.playing);
        setValue('pokedex-music-track', this.index);
        setValue('pokedex-music-minimized', this.minimized);
        setValue('pokedex-music-shuffle', this.shuffle);
    }

    async play(): Promise<void> {
        try {
            await this.audio.play();
            this.save();
        } catch {
            $('#toggle-music')?.classList.add('needs-interaction');
        }
    }

    pause(): void { this.audio.pause(); this.save(); }
    toggle(): void { if (this.playing) this.pause(); else void this.play(); }

    load(index: number, autoplay = this.playing): void {
        this.index = (index + TRACKS.length) % TRACKS.length;
        this.audio.src = encodeURI(this.track.file);
        this.updateTrackInfo();
        if (autoplay) void this.play();
        this.save();
    }

    next(): void {
        if (this.shuffle && TRACKS.length > 1) {
            let n = this.index;
            while (n === this.index) n = Math.floor(Math.random() * TRACKS.length);
            this.load(n);
        } else {
            this.load(this.index + 1);
        }
    }

    prev(): void {
        // Como nos players de verdade: se já passou de 3s, volta ao início
        if (this.audio.currentTime > 3) { this.audio.currentTime = 0; return; }
        this.load(this.index - 1);
    }

    setVolume(v: number): void {
        this.volume = Math.max(0, Math.min(1, v));
        this.audio.volume = this.volume;
        this.save();
        updateVolumeIcon(this.volume);
        const slider = $<HTMLInputElement>('#volume-slider');
        if (slider) { slider.value = String(this.volume); slider.style.setProperty('--vol', `${Math.round(this.volume * 100)}%`); }
    }

    seek(pct: number): void {
        if (Number.isFinite(this.audio.duration)) this.audio.currentTime = this.audio.duration * Math.max(0, Math.min(1, pct));
    }

    toggleMinimize(force?: boolean): void {
        this.minimized = force ?? !this.minimized;
        $('.player')?.classList.toggle('is-min', this.minimized);
        $('#minimize-button')?.setAttribute('aria-label', this.minimized ? 'Expandir player' : 'Minimizar player');
        if (this.minimized) this.toggleQueue(false);
        this.save();
    }

    toggleShuffle(): void {
        this.shuffle = !this.shuffle;
        const b = $('#shuffle-button');
        b?.classList.toggle('is-on', this.shuffle);
        b?.setAttribute('aria-pressed', this.shuffle ? 'true' : 'false');
        this.save();
    }

    toggleQueue(force?: boolean): void {
        const player = $('.player');
        const open = force ?? !player?.classList.contains('is-open');
        player?.classList.toggle('is-open', open);
        $('#queue-button')?.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open) { this.renderQueue(); this.loadDurations(); }
    }

    /* ---------------- UI ---------------- */
    updateTrackInfo(): void {
        const t = this.track;
        const c = TYPE_COLORS[t.type];
        const player = $('.player');
        if (player) {
            player.style.setProperty('--pc', c);
            player.classList.remove('is-switching'); void player.offsetWidth; player.classList.add('is-switching');
        }
        const title = $('#current-track-info');
        if (title) title.textContent = t.title;
        const game = $('#player-game');
        if (game) game.textContent = `${t.game} · ${t.region}`;
        const cover = $<HTMLImageElement>('#player-cover');
        if (cover) cover.src = artworkUrl(t.pokemon);
        const big = $<HTMLImageElement>('#player-cover-big');
        if (big) big.src = artworkUrl(t.pokemon);
        const idx = $('#player-index');
        if (idx) idx.textContent = `${this.index + 1} / ${TRACKS.length}`;
        this.updateProgress();
        this.renderQueue();
        this.updateSession();
    }

    updateProgress(): void {
        const d = this.audio.duration;
        const pct = Number.isFinite(d) && d > 0 ? this.audio.currentTime / d : 0;
        const bar = $('.player .progress-bar');
        if (bar) bar.style.width = `${pct * 100}%`;
        const prog = $('.player__progress');
        if (prog) { prog.style.setProperty('--knob', `${pct * 100}%`); prog.setAttribute('aria-valuenow', String(Math.round(pct * 100))); }
        const ring = $('#player-ring-fg');
        if (ring) ring.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - pct)));
        const cur = $('#current-time');
        const dur = $('#duration');
        if (cur) cur.textContent = fmt(this.audio.currentTime);
        if (dur) dur.textContent = Number.isFinite(d) ? fmt(d) : '--:--';
    }

    updateControls(): void {
        $('.player')?.classList.toggle('is-playing', this.playing);
        const toggle = $('#toggle-music');
        const main = $('#play-button');
        for (const btn of [toggle, main]) {
            if (!btn) continue;
            btn.classList.remove('needs-interaction', 'waiting-interaction');
            btn.setAttribute('aria-label', this.playing ? 'Pausar' : 'Reproduzir');
            btn.querySelector('use')?.setAttribute('href', this.playing ? '#i-pause' : '#i-play');
        }
        updateVolumeIcon(this.volume);
        this.renderQueue();
    }

    updateSession(): void {
        if (!('mediaSession' in navigator)) return;
        try {
            const t = this.track;
            navigator.mediaSession.metadata = new MediaMetadata({
                title: t.title,
                artist: `Pokémon ${t.game}`,
                album: 'Pokédex — trilhas de batalha',
                artwork: [{ src: artworkUrl(t.pokemon), sizes: '475x475', type: 'image/png' }],
            });
            navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
        } catch { /* opcional */ }
    }

    /* ---------------- Fila ---------------- */
    renderQueue(): void {
        const list = $('#player-queue-list');
        if (!list) return;
        list.innerHTML = TRACKS.map((t, i) => `
            <button type="button" class="queue__item${i === this.index ? ' is-current' : ''}" data-track="${i}" style="--c:${TYPE_COLORS[t.type]}">
                <span class="queue__cover"><img src="${artworkUrl(t.pokemon)}" alt="" loading="lazy"></span>
                <span class="queue__meta">
                    <span class="queue__title">${escapeHtml(t.title)}</span>
                    <span class="queue__game">${escapeHtml(t.game)} · ${escapeHtml(t.region)}</span>
                </span>
                <span class="queue__right">
                    ${i === this.index && this.playing ? '<span class="eq" aria-hidden="true"><i></i><i></i><i></i></span>' : `<span class="queue__dur" data-dur="${i}">${this.durations.has(i) ? fmt(this.durations.get(i)!) : '--:--'}</span>`}
                </span>
            </button>`).join('');
    }

    renderQueueDurations(): void {
        $$('[data-dur]').forEach((el) => {
            const i = Number((el as HTMLElement).dataset.dur);
            if (this.durations.has(i)) el.textContent = fmt(this.durations.get(i)!);
        });
    }

    private probe: HTMLAudioElement | null = null;
    private loadingDur = false;
    /** Lê só os metadados (duração) das faixas ainda desconhecidas, com um único elemento reutilizado. */
    loadDurations(): void {
        if (this.loadingDur) return;
        const pending = TRACKS.map((_, i) => i).filter((i) => !this.durations.has(i));
        if (!pending.length) return;
        this.loadingDur = true;
        const a = this.probe ?? (this.probe = new Audio());
        a.preload = 'metadata';
        a.volume = 0;
        let k = 0;
        let settled = true;
        const next = () => {
            if (k >= pending.length) { this.loadingDur = false; return; }
            const i = pending[k++];
            settled = false;
            a.src = encodeURI(TRACKS[i].file);
            const finish = (ok: boolean) => {
                if (settled) return;
                settled = true;
                a.removeEventListener('loadedmetadata', onMeta);
                a.removeEventListener('error', onErr);
                if (ok) { this.durations.set(i, a.duration); this.renderQueueDurations(); }
                next();
            };
            const onMeta = () => finish(true);
            const onErr = () => finish(false);
            a.addEventListener('loadedmetadata', onMeta);
            a.addEventListener('error', onErr);
        };
        next();
    }
}

function fmt(s: number): string {
    if (!Number.isFinite(s)) return '--:--';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function updateVolumeIcon(volume: number): void {
    const use = $('.player__vol use');
    if (use) use.setAttribute('href', volume === 0 ? '#i-vol-off' : volume < 0.5 ? '#i-vol-low' : '#i-vol');
}

export const audioPlayer = new AudioPlayer();

/* ------------------------------------------------------------------ */
/* Grito                                                               */
/* ------------------------------------------------------------------ */
let cryAudio: HTMLAudioElement | null = null;

export function playCry(src: string): Promise<void> {
    return new Promise((resolve) => {
        if (cryAudio) { cryAudio.pause(); cryAudio = null; }
        const a = new Audio(src);
        cryAudio = a;
        a.volume = Math.max(0.15, audioPlayer.volume);
        const done = () => { if (cryAudio === a) cryAudio = null; resolve(); };
        a.addEventListener('ended', done, { once: true });
        a.addEventListener('error', done, { once: true });
        a.play().catch(done);
        window.setTimeout(done, 4000);
    });
}

/* ------------------------------------------------------------------ */
/* Markup + eventos                                                    */
/* ------------------------------------------------------------------ */
export function setupAudioControls(): void {
    const p = audioPlayer;
    const t = p.track;
    const container = document.createElement('div');
    container.className = 'player' + (p.minimized ? ' is-min' : '');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Player de música');
    container.style.setProperty('--pc', TYPE_COLORS[t.type]);
    const vol = Math.round(p.volume * 100);

    container.innerHTML = `
        <div class="player__bar">
            <button id="toggle-music" class="player__disc" aria-label="Reproduzir">
                <svg class="player__ring" viewBox="0 0 60 60" aria-hidden="true">
                    <circle class="player__ring-bg" cx="30" cy="30" r="${RING_R}"/>
                    <circle id="player-ring-fg" class="player__ring-fg" cx="30" cy="30" r="${RING_R}" stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"/>
                </svg>
                <span class="player__disc-face"><img id="player-cover" class="player__cover" src="${artworkUrl(t.pokemon)}" alt=""></span>
                <span class="player__disc-state">${svgIcon('i-play')}</span>
            </button>

            <button type="button" class="player__info" id="player-info" aria-label="Abrir fila de reprodução">
                <span class="player__game" id="player-game">${escapeHtml(t.game)} · ${escapeHtml(t.region)}</span>
                <span class="player__title"><span id="current-track-info">${escapeHtml(t.title)}</span></span>
                <span class="player__time"><span id="current-time">0:00</span><span class="player__sep">/</span><span id="duration">--:--</span></span>
            </button>

            <div class="player__controls">
                <button id="shuffle-button" class="player__btn${p.shuffle ? ' is-on' : ''}" aria-label="Aleatório" aria-pressed="${p.shuffle}" title="Aleatório">${svgIcon('i-shuffle')}</button>
                <button id="previous-track" class="player__btn" aria-label="Faixa anterior" title="Anterior">${svgIcon('i-prev')}</button>
                <button id="play-button" class="player__btn player__btn--main" aria-label="Reproduzir">${svgIcon('i-play')}</button>
                <button id="next-track" class="player__btn" aria-label="Próxima faixa" title="Próxima">${svgIcon('i-next')}</button>
            </div>

            <div class="player__vol volume-control">
                <button type="button" class="player__btn player__mute" id="mute-button" aria-label="Silenciar">${svgIcon('i-vol')}</button>
                <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="${p.volume}" aria-label="Volume" style="--vol:${vol}%">
            </div>

            <button id="queue-button" class="player__btn player__queue-btn" aria-label="Fila de reprodução" aria-expanded="false" title="Fila">${svgIcon('i-queue')}</button>
            <button id="minimize-button" class="player__btn player__collapse" aria-label="${p.minimized ? 'Expandir player' : 'Minimizar player'}">${svgIcon('i-chev-left')}</button>
        </div>

        <div class="player__progress progress-container" role="slider" aria-label="Posição da faixa" aria-valuemin="0" aria-valuemax="100" tabindex="0">
            <div class="progress-bar"></div>
            <span class="player__knob"></span>
        </div>

        <section class="player__queue" aria-label="Fila de reprodução">
            <header class="queue__head">
                <div class="queue__now">
                    <img id="player-cover-big" class="queue__big" src="${artworkUrl(t.pokemon)}" alt="">
                    <div>
                        <span class="queue__label">Tocando agora · <span id="player-index">${p.index + 1} / ${TRACKS.length}</span></span>
                        <span class="queue__nowtitle">Trilhas de batalha</span>
                    </div>
                </div>
                <button type="button" class="icon-btn" id="queue-close" aria-label="Fechar fila">${svgIcon('i-close')}</button>
            </header>
            <div class="queue__list" id="player-queue-list"></div>
        </section>`;

    document.body.appendChild(container);

    // Ações
    $('#toggle-music')!.addEventListener('click', () => {
        if (p.minimized) { p.toggleMinimize(false); return; }
        p.toggle();
        document.body.classList.add('user-interacted');
    });
    $('#play-button')!.addEventListener('click', () => { p.toggle(); document.body.classList.add('user-interacted'); });
    $('#previous-track')!.addEventListener('click', () => p.prev());
    $('#next-track')!.addEventListener('click', () => p.next());
    $('#shuffle-button')!.addEventListener('click', () => p.toggleShuffle());
    $('#minimize-button')!.addEventListener('click', () => p.toggleMinimize());
    $('#queue-button')!.addEventListener('click', () => p.toggleQueue());
    $('#queue-close')!.addEventListener('click', () => p.toggleQueue(false));
    $('#player-info')!.addEventListener('click', () => p.toggleQueue());

    let lastVolume = p.volume || 0.5;
    $('#mute-button')!.addEventListener('click', () => {
        if (p.volume > 0) { lastVolume = p.volume; p.setVolume(0); } else p.setVolume(lastVolume || 0.5);
    });
    const slider = $<HTMLInputElement>('#volume-slider')!;
    slider.addEventListener('input', () => p.setVolume(parseFloat(slider.value)));

    // Fila: clicar toca a faixa
    $('#player-queue-list')!.addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('[data-track]');
        if (!item) return;
        const i = Number(item.dataset.track);
        if (i === p.index) p.toggle(); else p.load(i, true);
        document.body.classList.add('user-interacted');
    });

    // Barra de progresso: clique e arraste (mouse/touch) + teclado
    const progress = $('.player__progress')!;
    let dragging = false;
    const seekFromEvent = (e: PointerEvent) => {
        const r = progress.getBoundingClientRect();
        p.seek((e.clientX - r.left) / r.width);
    };
    progress.addEventListener('pointerdown', (e) => { dragging = true; progress.setPointerCapture(e.pointerId); seekFromEvent(e); });
    progress.addEventListener('pointermove', (e) => { if (dragging) seekFromEvent(e); });
    progress.addEventListener('pointerup', () => { dragging = false; });
    progress.addEventListener('pointercancel', () => { dragging = false; });
    progress.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') { p.audio.currentTime = Math.min(p.audio.duration || 0, p.audio.currentTime + 5); }
        if (e.key === 'ArrowLeft') { p.audio.currentTime = Math.max(0, p.audio.currentTime - 5); }
    });

    // Botão da topbar: mostra/esconde o player inteiro
    $('#music-toggle')?.addEventListener('click', () => {
        const hidden = container.classList.toggle('is-hidden');
        $('#music-toggle')?.setAttribute('aria-label', hidden ? 'Mostrar player de música' : 'Esconder player de música');
    });

    // Fecha a fila ao clicar fora / Esc
    document.addEventListener('click', (e) => {
        // composedPath funciona mesmo se o alvo foi re-renderizado durante o clique
        if (container.classList.contains('is-open') && !e.composedPath().includes(container)) p.toggleQueue(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && container.classList.contains('is-open')) { e.stopImmediatePropagation(); p.toggleQueue(false); }
    }, true);

    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.setActionHandler('play', () => void p.play());
            navigator.mediaSession.setActionHandler('pause', () => p.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => p.prev());
            navigator.mediaSession.setActionHandler('nexttrack', () => p.next());
            navigator.mediaSession.setActionHandler('seekto', (d) => { if (d.seekTime != null) p.audio.currentTime = d.seekTime; });
        } catch { /* opcional */ }
    }

    p.updateControls();
    p.updateTrackInfo();

    if (p.autoplayRequested) {
        const start = () => {
            if (!p.playing) void p.play();
            document.removeEventListener('click', start);
            document.removeEventListener('keydown', start);
            document.removeEventListener('touchstart', start);
        };
        document.addEventListener('click', start);
        document.addEventListener('keydown', start);
        document.addEventListener('touchstart', start);
        $('#toggle-music')?.classList.add('waiting-interaction');
    }
}
