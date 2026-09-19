/**
 * Player de música de fundo (pílula flutuante) + Media Session API + grito.
 */
import { getBool, getNumber, setValue } from '../state/persist';
import { $ } from '../ui/dom';
import { svgIcon } from '../ui/icons';

const PLAYLIST = [
    'Music/Battle Zone Routes 225-227 & Stark Mountain (Night)[Pokémon  Diamond & Pearl].mp3',
    'Music/Pokémon Diamond, Pearl & Platinum - Champion Cynthia Battle Music (HQ).mp3',
    'Music/Pokémon Omega Ruby & Alpha Sapphire - Giratina Battle Music (HQ).mp3',
    'Music/Pokémon Diamond, Pearl & Platinum - Team Galactic Commander Battle Music (HQ).mp3',
    'Music/Pokémon Omega Ruby & Alpha Sapphire - Frontier Brain Battle Music (HQ).mp3',
    'Music/Pokémon HeartGold & SoulSilver - Super Ancient Pokémon Battle Music (HQ).mp3',
    'Music/Pokémon Omega Ruby & Alpha Sapphire - Vs Rayquaza (Highest Quality).mp3',
    'Music/Pokémon Omega Ruby & Alpha Sapphire - Vs Zinnia (Highest Quality).mp3',
    'Music/Pokémon Diamond, Pearl & Platinum - Elite Four Battle Music (HQ).mp3',
    'Music/Pokémon Omega Ruby & Alpha Sapphire - Rival Battle Music (HQ).mp3',
    'Music/Pokémon HeartGold & SoulSilver - Champion & Red Battle Music (HQ).mp3',
    'Music/Pokemon FireRed LeafGreen- Trainer Battle!.mp3',
];

class AudioPlayer {
    readonly audio = new Audio();
    index = 0;
    playing = false;
    volume = 0.5;
    minimized = false;
    shuffle = false;
    autoplayRequested = false;

    constructor() {
        this.volume = Math.max(0, Math.min(1, getNumber('pokedex-music-volume', 0.5)));
        this.index = Math.min(PLAYLIST.length - 1, Math.max(0, getNumber('pokedex-music-track', 0)));
        this.minimized = getBool('pokedex-music-minimized', false);
        this.shuffle = getBool('pokedex-music-shuffle', false);
        this.autoplayRequested = getBool('pokedex-music-playing', false);
        this.audio.volume = this.volume;
        this.audio.preload = 'none';
        this.audio.src = encodeURI(PLAYLIST[this.index]);
        this.audio.addEventListener('ended', () => this.next());
        this.audio.addEventListener('timeupdate', () => this.updateProgress());
        this.audio.addEventListener('loadedmetadata', () => this.updateProgress());
        this.audio.addEventListener('play', () => { this.playing = true; this.updateControls(); this.updateSession(); });
        this.audio.addEventListener('pause', () => { this.playing = false; this.updateControls(); this.updateSession(); });
    }

    trackName(): string {
        return PLAYLIST[this.index].split('/').pop()!.replace('.mp3', '');
    }

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

    pause(): void {
        this.audio.pause();
        this.save();
    }

    toggle(): void {
        if (this.playing) this.pause(); else void this.play();
    }

    load(index: number): void {
        this.index = (index + PLAYLIST.length) % PLAYLIST.length;
        this.audio.src = encodeURI(PLAYLIST[this.index]);
        this.updateTrackInfo();
        if (this.playing) void this.play();
        this.save();
    }

    next(): void {
        if (this.shuffle && PLAYLIST.length > 1) {
            let n = this.index;
            while (n === this.index) n = Math.floor(Math.random() * PLAYLIST.length);
            this.load(n);
        } else {
            this.load(this.index + 1);
        }
    }

    prev(): void { this.load(this.index - 1); }

    setVolume(v: number): void {
        this.volume = Math.max(0, Math.min(1, v));
        this.audio.volume = this.volume;
        this.save();
    }

    seek(pct: number): void {
        if (Number.isFinite(this.audio.duration)) this.audio.currentTime = this.audio.duration * pct;
    }

    toggleMinimize(): void {
        this.minimized = !this.minimized;
        $('.player')?.classList.toggle('is-min', this.minimized);
        $('#minimize-button')?.setAttribute('aria-label', this.minimized ? 'Expandir player' : 'Minimizar player');
        this.save();
    }

    toggleShuffle(): void {
        this.shuffle = !this.shuffle;
        $('#shuffle-button')?.classList.toggle('is-on', this.shuffle);
        $('#shuffle-button')?.setAttribute('aria-pressed', this.shuffle ? 'true' : 'false');
        this.save();
    }

    updateTrackInfo(): void {
        const el = $('#current-track-info');
        if (el) el.textContent = this.trackName();
        this.updateSession();
    }

    updateProgress(): void {
        const bar = $('.player .progress-bar');
        const d = this.audio.duration;
        if (bar && Number.isFinite(d) && d > 0) bar.style.width = `${(this.audio.currentTime / d) * 100}%`;
        const cur = $('#current-time');
        const dur = $('#duration');
        if (cur) cur.textContent = fmt(this.audio.currentTime);
        if (dur) dur.textContent = Number.isFinite(d) ? fmt(d) : '0:00';
    }

    updateControls(): void {
        $('.player')?.classList.toggle('is-playing', this.playing);
        const toggle = $('#toggle-music');
        if (toggle) {
            toggle.classList.remove('needs-interaction', 'waiting-interaction');
            toggle.setAttribute('aria-label', this.playing ? 'Pausar' : 'Reproduzir');
            toggle.querySelector('use')?.setAttribute('href', this.playing ? '#i-pause' : '#i-play');
        }
        updateVolumeIcon(this.volume);
    }

    updateSession(): void {
        if (!('mediaSession' in navigator)) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: this.trackName(),
                artist: 'Pokédex — trilhas de batalha',
                album: 'Pokémon',
                artwork: [{ src: new URL('img/pokeball-icon.png', document.baseURI).href, sizes: '30x30', type: 'image/png' }],
            });
            navigator.mediaSession.playbackState = this.playing ? 'playing' : 'paused';
        } catch { /* opcional */ }
    }
}

function fmt(s: number): string {
    if (!Number.isFinite(s)) return '0:00';
    const m = Math.floor(s / 60);
    const r = Math.floor(s % 60);
    return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function updateVolumeIcon(volume: number): void {
    const use = $('.player__vol use');
    if (!use) return;
    use.setAttribute('href', volume === 0 ? '#i-vol-off' : volume < 0.5 ? '#i-vol-low' : '#i-vol');
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
        // segurança: gritos duram < 3s
        window.setTimeout(done, 4000);
    });
}

/* ------------------------------------------------------------------ */
/* UI                                                                  */
/* ------------------------------------------------------------------ */
export function setupAudioControls(): void {
    const p = audioPlayer;
    const container = document.createElement('div');
    container.className = 'player' + (p.minimized ? ' is-min' : '');
    container.setAttribute('role', 'region');
    container.setAttribute('aria-label', 'Player de música');
    const vol = Math.round(p.volume * 100);

    container.innerHTML = `
        <button id="toggle-music" class="player__disc" aria-label="Reproduzir">${svgIcon('i-play')}</button>
        <button id="previous-track" class="player__btn" aria-label="Faixa anterior" title="Faixa anterior">${svgIcon('i-prev')}</button>
        <button id="next-track" class="player__btn" aria-label="Próxima faixa" title="Próxima faixa">${svgIcon('i-next')}</button>
        <button id="shuffle-button" class="player__btn${p.shuffle ? ' is-on' : ''}" aria-label="Aleatório" aria-pressed="${p.shuffle}" title="Aleatório">${svgIcon('i-shuffle')}</button>
        <div class="player__info" id="track-info">
            <div class="player__title"><span id="current-track-info">${p.trackName()}</span></div>
            <div class="player__progress progress-container" title="Ir para posição"><div class="progress-bar"></div></div>
            <div class="player__time time-display"><span id="current-time">0:00</span> / <span id="duration">0:00</span></div>
        </div>
        <div class="player__vol volume-control">
            ${svgIcon('i-vol')}
            <input type="range" id="volume-slider" min="0" max="1" step="0.01" value="${p.volume}" aria-label="Volume" style="--vol:${vol}%">
        </div>
        <button id="minimize-button" class="player__btn player__collapse" aria-label="${p.minimized ? 'Expandir player' : 'Minimizar player'}">${svgIcon('i-chev-left')}</button>`;

    document.body.appendChild(container);

    $('#toggle-music')!.addEventListener('click', () => { p.toggle(); document.body.classList.add('user-interacted'); });
    $('#previous-track')!.addEventListener('click', () => p.prev());
    $('#next-track')!.addEventListener('click', () => p.next());
    $('#shuffle-button')!.addEventListener('click', () => p.toggleShuffle());
    $('#minimize-button')!.addEventListener('click', () => p.toggleMinimize());

    const slider = $<HTMLInputElement>('#volume-slider')!;
    slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        p.setVolume(v);
        slider.style.setProperty('--vol', `${Math.round(v * 100)}%`);
        updateVolumeIcon(v);
    });

    $('.player .progress-container')!.addEventListener('click', (e) => {
        const el = e.currentTarget as HTMLElement;
        const r = el.getBoundingClientRect();
        p.seek((e.clientX - r.left) / r.width);
    });

    $('#music-toggle')?.addEventListener('click', () => {
        const hidden = container.classList.toggle('is-hidden');
        $('#music-toggle')?.setAttribute('aria-label', hidden ? 'Mostrar player de música' : 'Esconder player de música');
    });

    if ('mediaSession' in navigator) {
        try {
            navigator.mediaSession.setActionHandler('play', () => void p.play());
            navigator.mediaSession.setActionHandler('pause', () => p.pause());
            navigator.mediaSession.setActionHandler('previoustrack', () => p.prev());
            navigator.mediaSession.setActionHandler('nexttrack', () => p.next());
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
