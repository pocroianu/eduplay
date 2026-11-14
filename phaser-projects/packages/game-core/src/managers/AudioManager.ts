import Phaser from 'phaser';

export type SoundEffectType = 'correct' | 'incorrect' | 'click' | 'hover' | 'complete' | 'star';

export interface AudioManagerConfig {
    musicVolume?: number;
    sfxVolume?: number;
    musicEnabled?: boolean;
    sfxEnabled?: boolean;
}

/**
 * Options for creating an AudioManager instance
 */
export interface AudioManagerOptions {
    /** Storage key prefix for isolated localStorage (optional) */
    storagePrefix?: string;
    /** Whether to use shared global storage (default: true) */
    shared?: boolean;
}

const DEFAULT_STORAGE_KEY = 'edu-play-audio-settings';

const DEFAULT_CONFIG: Required<AudioManagerConfig> = {
    musicVolume: 0.3,
    sfxVolume: 0.5,
    musicEnabled: true,
    sfxEnabled: true
};

// Lazy getter to avoid circular dependency with GameContextProvider
// The provider is accessed through a getter function that resolves at runtime
function getContextProvider(): any {
    // Dynamic import at runtime to break circular dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return (globalThis as any).__CONTEXT_PROVIDER__;
}

/**
 * AudioManager - Centralized audio control for music and sound effects
 *
 * Supports both context-based usage (recommended) and legacy singleton pattern.
 */
export default class AudioManager {
    /** Legacy singleton instance for backward compatibility */
    private static legacyInstance: AudioManager | null = null;

    private scene: Phaser.Scene | null = null;
    private storageKey: string;

    private musicVolume: number;
    private sfxVolume: number;
    private musicEnabled: boolean;
    private sfxEnabled: boolean;

    private currentMusic: Phaser.Sound.BaseSound | null = null;
    private currentMusicKey: string | null = null;

    // Sound effect keys mapping
    private readonly sfxKeys: Record<SoundEffectType, string> = {
        correct: 'sfx-correct',
        incorrect: 'sfx-incorrect',
        click: 'sfx-click',
        hover: 'sfx-hover',
        complete: 'sfx-complete',
        star: 'sfx-star'
    };

    /**
     * Create a new AudioManager instance
     * @param options - Configuration options
     */
    constructor(options: AudioManagerOptions = {}) {
        // Determine storage key
        if (options.shared !== false && !options.storagePrefix) {
            this.storageKey = DEFAULT_STORAGE_KEY;
        } else if (options.storagePrefix) {
            this.storageKey = `${options.storagePrefix}-audio-settings`;
        } else {
            this.storageKey = DEFAULT_STORAGE_KEY;
        }

        const saved = this.loadSettings();
        this.musicVolume = saved.musicVolume;
        this.sfxVolume = saved.sfxVolume;
        this.musicEnabled = saved.musicEnabled;
        this.sfxEnabled = saved.sfxEnabled;
    }

    /**
     * Get singleton instance
     * @deprecated Use GameContextProvider.getActiveContext().audioManager instead
     *
     * Returns the active context's AudioManager if available,
     * otherwise falls back to legacy singleton for backward compatibility.
     */
    static getInstance(): AudioManager {
        // Try to get from active context first (via window global set by index.ts)
        const provider = getContextProvider();
        if (provider) {
            const context = provider.getActiveContext();
            if (context) {
                return context.audioManager;
            }
        }

        // Fallback to legacy singleton
        if (!AudioManager.legacyInstance) {
            AudioManager.legacyInstance = new AudioManager({ shared: true });
        }
        return AudioManager.legacyInstance;
    }

    /**
     * Initialize with a Phaser scene (call this in scene create)
     */
    init(scene: Phaser.Scene): void {
        this.scene = scene;
    }

    // ============================================
    // MUSIC CONTROLS
    // ============================================

    /**
     * Play background music (loops by default)
     */
    playMusic(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
        if (!this.scene || !this.musicEnabled) return;

        // Don't restart if same music is already playing
        if (this.currentMusicKey === key && this.currentMusic?.isPlaying) {
            return;
        }

        this.stopMusic();

        try {
            if (this.scene.cache.audio.exists(key)) {
                this.currentMusic = this.scene.sound.add(key, {
                    loop: true,
                    volume: this.musicVolume,
                    ...config
                });
                this.currentMusic.play();
                this.currentMusicKey = key;
            } else {
                console.warn(`AudioManager: Music key "${key}" not found in cache`);
            }
        } catch (error) {
            console.error('AudioManager: Error playing music', error);
        }
    }

    /**
     * Stop current background music
     */
    stopMusic(fadeOut: boolean = true): void {
        if (!this.currentMusic) return;

        if (fadeOut && this.scene) {
            this.scene.tweens.add({
                targets: this.currentMusic,
                volume: 0,
                duration: 500,
                onComplete: () => {
                    this.currentMusic?.stop();
                    this.currentMusic?.destroy();
                    this.currentMusic = null;
                    this.currentMusicKey = null;
                }
            });
        } else {
            this.currentMusic.stop();
            this.currentMusic.destroy();
            this.currentMusic = null;
            this.currentMusicKey = null;
        }
    }

    /**
     * Pause current music
     */
    pauseMusic(): void {
        if (this.currentMusic?.isPlaying) {
            this.currentMusic.pause();
        }
    }

    /**
     * Resume paused music
     */
    resumeMusic(): void {
        if (this.currentMusic && !this.currentMusic.isPlaying && this.musicEnabled) {
            this.currentMusic.resume();
        }
    }

    // ============================================
    // SOUND EFFECTS
    // ============================================

    /**
     * Play a sound effect by type
     */
    playSfx(type: SoundEffectType): void {
        if (!this.scene || !this.sfxEnabled) return;

        const key = this.sfxKeys[type];

        try {
            if (this.scene.cache.audio.exists(key)) {
                this.scene.sound.play(key, { volume: this.sfxVolume });
            } else {
                // Fallback: generate simple tone for missing sounds
                this.playGeneratedSfx(type);
            }
        } catch (error) {
            console.warn(`AudioManager: Error playing SFX "${type}"`, error);
        }
    }

    /**
     * Play a custom sound by key
     */
    playSound(key: string, config?: Phaser.Types.Sound.SoundConfig): void {
        if (!this.scene || !this.sfxEnabled) return;

        try {
            if (this.scene.cache.audio.exists(key)) {
                this.scene.sound.play(key, {
                    volume: this.sfxVolume,
                    ...config
                });
            }
        } catch (error) {
            console.warn(`AudioManager: Error playing sound "${key}"`, error);
        }
    }

    /**
     * Generate simple synthesized sounds as fallback
     */
    private playGeneratedSfx(type: SoundEffectType): void {
        if (!this.scene) return;

        // Use Web Audio API to generate simple tones
        const audioContext = (this.scene.sound as any).context as AudioContext;
        if (!audioContext) return;

        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        const now = audioContext.currentTime;
        gainNode.gain.setValueAtTime(this.sfxVolume * 0.3, now);

        switch (type) {
            case 'correct':
                // Rising happy tone
                oscillator.frequency.setValueAtTime(523.25, now); // C5
                oscillator.frequency.setValueAtTime(659.25, now + 0.1); // E5
                oscillator.frequency.setValueAtTime(783.99, now + 0.2); // G5
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
                oscillator.start(now);
                oscillator.stop(now + 0.4);
                break;

            case 'incorrect':
                // Descending sad tone
                oscillator.frequency.setValueAtTime(311.13, now); // Eb4
                oscillator.frequency.setValueAtTime(277.18, now + 0.15); // Db4
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
                oscillator.start(now);
                oscillator.stop(now + 0.3);
                break;

            case 'click':
                // Short click
                oscillator.frequency.setValueAtTime(800, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                oscillator.start(now);
                oscillator.stop(now + 0.05);
                break;

            case 'hover':
                // Soft hover
                oscillator.frequency.setValueAtTime(600, now);
                gainNode.gain.setValueAtTime(this.sfxVolume * 0.1, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.03);
                oscillator.start(now);
                oscillator.stop(now + 0.03);
                break;

            case 'complete':
                // Victory fanfare
                oscillator.frequency.setValueAtTime(523.25, now); // C5
                oscillator.frequency.setValueAtTime(659.25, now + 0.15); // E5
                oscillator.frequency.setValueAtTime(783.99, now + 0.3); // G5
                oscillator.frequency.setValueAtTime(1046.50, now + 0.45); // C6
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
                oscillator.start(now);
                oscillator.stop(now + 0.7);
                break;

            case 'star':
                // Sparkle sound
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(1200, now);
                oscillator.frequency.exponentialRampToValueAtTime(2400, now + 0.1);
                gainNode.gain.setValueAtTime(this.sfxVolume * 0.2, now);
                gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
                oscillator.start(now);
                oscillator.stop(now + 0.15);
                break;
        }
    }

    // ============================================
    // VOLUME & SETTINGS
    // ============================================

    setMusicVolume(volume: number): void {
        this.musicVolume = Phaser.Math.Clamp(volume, 0, 1);
        if (this.currentMusic) {
            (this.currentMusic as any).setVolume(this.musicVolume);
        }
        this.saveSettings();
    }

    getMusicVolume(): number {
        return this.musicVolume;
    }

    setSfxVolume(volume: number): void {
        this.sfxVolume = Phaser.Math.Clamp(volume, 0, 1);
        this.saveSettings();
    }

    getSfxVolume(): number {
        return this.sfxVolume;
    }

    setMusicEnabled(enabled: boolean): void {
        this.musicEnabled = enabled;
        if (!enabled) {
            this.stopMusic(false);
        }
        this.saveSettings();
    }

    isMusicEnabled(): boolean {
        return this.musicEnabled;
    }

    setSfxEnabled(enabled: boolean): void {
        this.sfxEnabled = enabled;
        this.saveSettings();
    }

    isSfxEnabled(): boolean {
        return this.sfxEnabled;
    }

    /**
     * Toggle all audio (music + sfx)
     */
    toggleMute(): boolean {
        const newState = !(this.musicEnabled && this.sfxEnabled);
        this.setMusicEnabled(newState);
        this.setSfxEnabled(newState);
        return newState;
    }

    isMuted(): boolean {
        return !this.musicEnabled && !this.sfxEnabled;
    }

    // ============================================
    // PERSISTENCE
    // ============================================

    private saveSettings(): void {
        try {
            const settings: AudioManagerConfig = {
                musicVolume: this.musicVolume,
                sfxVolume: this.sfxVolume,
                musicEnabled: this.musicEnabled,
                sfxEnabled: this.sfxEnabled
            };
            localStorage.setItem(this.storageKey, JSON.stringify(settings));
        } catch (error) {
            console.warn('AudioManager: Could not save settings', error);
        }
    }

    private loadSettings(): Required<AudioManagerConfig> {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
            }
        } catch (error) {
            console.warn('AudioManager: Could not load settings', error);
        }
        return DEFAULT_CONFIG;
    }

    // ============================================
    // CLEANUP
    // ============================================

    /**
     * Clean up when changing scenes
     */
    cleanup(): void {
        this.stopMusic(false);
        this.scene = null;
    }
}
