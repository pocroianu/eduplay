import { Page } from '@playwright/test';

/**
 * Audio Mocking Utilities for Phaser Game Testing
 *
 * Headless browsers cannot play audio, so we mock the audio APIs
 * and track calls to verify audio behavior.
 */

export interface AudioCall {
  type: 'WebAudio' | 'HTMLAudio' | 'Phaser';
  key?: string;
  src?: string;
  frequency?: number;
  timestamp: number;
  soundType?: string;
}

/**
 * Set up AudioManager wrapper after game boots
 * This provides an additional layer of sound tracking
 * Call this after the game is ready
 */
export async function wrapAudioManager(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as any).__PHASER_GAME__?.isBooted);

  await page.evaluate(() => {
    const am = (window as any).__AUDIO_MANAGER__;
    if (am && !am.__wrapped__) {
      const originalPlaySfx = am.playSfx.bind(am);
      const originalPlayMusic = am.playMusic.bind(am);

      am.playSfx = function(key: string) {
        // Extract sound type from key
        let soundType = 'unknown';
        if (key.includes('correct')) soundType = 'correct';
        else if (key.includes('incorrect')) soundType = 'incorrect';
        else if (key.includes('click')) soundType = 'click';
        else if (key.includes('hover')) soundType = 'hover';
        else if (key.includes('complete')) soundType = 'complete';
        else if (key.includes('star')) soundType = 'star';

        (window as any).__AUDIO_CALLS__.push({
          type: 'Phaser',
          key: key,
          soundType: soundType,
          timestamp: Date.now()
        });

        return originalPlaySfx(key);
      };

      am.playMusic = function(key: string) {
        (window as any).__AUDIO_CALLS__.push({
          type: 'Phaser',
          key: key,
          soundType: 'music',
          timestamp: Date.now()
        });

        return originalPlayMusic(key);
      };

      am.__wrapped__ = true;
    }
  });
}

/**
 * Set up audio mocking before the page loads
 * Call this before navigating to the game
 */
export async function setupAudioMocks(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Storage for audio calls
    (window as any).__AUDIO_CALLS__ = [];
    (window as any).__AUDIO_MUTED__ = false;

    // Mock HTMLAudioElement
    const originalAudioPlay = HTMLAudioElement.prototype.play;
    HTMLAudioElement.prototype.play = function() {
      (window as any).__AUDIO_CALLS__.push({
        type: 'HTMLAudio',
        src: this.src,
        timestamp: Date.now()
      });
      return Promise.resolve();
    };

    // Mock Web Audio API oscillator (used for generated sounds)
    const originalCreateOscillator = AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator = function() {
      const osc = originalCreateOscillator.call(this);
      const originalStart = osc.start;
      const originalSetValueAtTime = osc.frequency.setValueAtTime;

      // Track the frequencies being set
      let frequencies: number[] = [];

      osc.frequency.setValueAtTime = function(value: number, ...args) {
        frequencies.push(value);
        return originalSetValueAtTime.call(this, value, ...args);
      };

      osc.start = function(...args) {
        // Record the sound with all frequencies
        (window as any).__AUDIO_CALLS__.push({
          type: 'WebAudio',
          frequency: frequencies[0] || osc.frequency.value,
          frequencies: frequencies,
          timestamp: Date.now()
        });
        // Don't actually start the oscillator in tests
        return undefined;
      };

      // stop() throws InvalidStateError in Chrome headless when called on a
      // node whose start() was never invoked (EDU-445). Suppress it so that
      // AudioManager.playGeneratedSfx doesn't surface an uncaught rejection
      // in the headless error handler, which would abort the
      // delayedCall(1500) chain in Level.ts:onGameComplete.
      osc.stop = function(..._args) { return undefined; };

      return osc;
    };

    // Store original GainNode connect to prevent actual audio output
    const originalGainConnect = GainNode.prototype.connect;
    GainNode.prototype.connect = function(destination, ...args) {
      // Only connect if not the final destination (speakers)
      if (destination instanceof AudioDestinationNode) {
        return this;
      }
      return originalGainConnect.call(this, destination, ...args);
    };

    // Hook into Phaser sound system by patching the prototype
    // This must happen before Phaser creates the sound manager
    const checkForPhaser = setInterval(() => {
      // Check if Phaser namespace is available
      if (typeof (window as any).Phaser !== 'undefined') {
        clearInterval(checkForPhaser);

        const Phaser = (window as any).Phaser;

        // Hook the BaseSoundManager.play method
        if (Phaser.Sound && Phaser.Sound.BaseSoundManager) {
          const originalPlay = Phaser.Sound.BaseSoundManager.prototype.play;

          Phaser.Sound.BaseSoundManager.prototype.play = function(key: string, config?: any) {
            // Extract sound type from key
            let soundType = 'unknown';
            if (key.includes('correct')) soundType = 'correct';
            else if (key.includes('incorrect')) soundType = 'incorrect';
            else if (key.includes('click')) soundType = 'click';
            else if (key.includes('hover')) soundType = 'hover';
            else if (key.includes('complete')) soundType = 'complete';
            else if (key.includes('star')) soundType = 'star';

            (window as any).__AUDIO_CALLS__.push({
              type: 'Phaser',
              key: key,
              soundType: soundType,
              timestamp: Date.now()
            });

            // Still call original to maintain game behavior
            return originalPlay.call(this, key, config);
          };
        }
      }
    }, 10);

    // Clear interval after 10 seconds if Phaser doesn't load
    setTimeout(() => clearInterval(checkForPhaser), 10000);
  });
}

/**
 * Get all audio calls made since the page loaded
 */
export async function getAudioCalls(page: Page): Promise<AudioCall[]> {
  return page.evaluate(() => {
    return (window as any).__AUDIO_CALLS__ || [];
  });
}

/**
 * Clear recorded audio calls
 */
export async function clearAudioCalls(page: Page): Promise<void> {
  await page.evaluate(() => {
    (window as any).__AUDIO_CALLS__ = [];
  });
}

/**
 * Check if a specific sound type was played
 * Sound types: 'correct', 'incorrect', 'click', 'hover', 'complete', 'star'
 */
export async function wasSoundPlayed(page: Page, soundType: string): Promise<boolean> {
  const calls = await getAudioCalls(page);

  // Check for Phaser sounds (most reliable)
  const phaserMatch = calls.some(
    call => call.type === 'Phaser' && call.soundType === soundType
  );

  // Check for HTML audio with matching filename
  const htmlMatch = calls.some(
    call => call.type === 'HTMLAudio' && call.src?.includes(soundType)
  );

  // Check for WebAudio (generated sounds) - map sound types to frequency patterns
  const soundFrequencies: Record<string, number[]> = {
    correct: [523.25, 659.25, 783.99], // C5, E5, G5
    incorrect: [311.13, 277.18], // Eb4, Db4
    click: [800],
    hover: [600],
    complete: [523.25, 659.25, 783.99, 1046.50],
    star: [1200, 2400]
  };

  const expectedFreqs = soundFrequencies[soundType];
  if (!expectedFreqs) return phaserMatch || htmlMatch;

  const webAudioMatch = calls.some(
    call => call.type === 'WebAudio' && expectedFreqs.some(freq =>
      Math.abs((call.frequency || 0) - freq) < 1
    )
  );

  return phaserMatch || htmlMatch || webAudioMatch;
}

/**
 * Wait for a specific sound to be played
 */
export async function waitForSound(
  page: Page,
  soundType: string,
  timeout = 3000
): Promise<void> {
  await page.waitForFunction(
    (type) => {
      const calls = (window as any).__AUDIO_CALLS__ || [];

      // Check for Phaser sounds (most reliable)
      if (calls.some(c => c.type === 'Phaser' && c.soundType === type)) {
        return true;
      }

      // Check HTML audio
      if (calls.some(c => c.type === 'HTMLAudio' && c.src?.includes(type))) {
        return true;
      }

      // Check WebAudio for generated sounds
      const freqMap = {
        correct: [523, 659, 784],
        incorrect: [311, 277],
        click: [800],
        hover: [600],
        complete: [523, 659, 784, 1047],
        star: [1200, 2400]
      };

      const expectedFreqs = freqMap[type];
      if (expectedFreqs) {
        return calls.some(
          c => c.type === 'WebAudio' && expectedFreqs.some(freq =>
            Math.abs((c.frequency || 0) - freq) < 1
          )
        );
      }

      return false;
    },
    soundType,
    { timeout }
  );
}

/**
 * Get the mute state from the AudioManager
 */
export async function isAudioMuted(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const audioManager = (window as any).__AUDIO_MANAGER__;
    if (!audioManager) return true;
    return audioManager.isMuted();
  });
}

/**
 * Get audio settings from the AudioManager
 */
export async function getAudioSettings(page: Page): Promise<{
  musicVolume: number;
  sfxVolume: number;
  musicEnabled: boolean;
  sfxEnabled: boolean;
} | null> {
  return page.evaluate(() => {
    const audioManager = (window as any).__AUDIO_MANAGER__;
    if (!audioManager) return null;

    return {
      musicVolume: audioManager.getMusicVolume(),
      sfxVolume: audioManager.getSfxVolume(),
      musicEnabled: audioManager.isMusicEnabled(),
      sfxEnabled: audioManager.isSfxEnabled()
    };
  });
}

/**
 * Count audio calls by type
 */
export async function countAudioCalls(
  page: Page,
  type?: 'WebAudio' | 'HTMLAudio'
): Promise<number> {
  const calls = await getAudioCalls(page);

  if (type) {
    return calls.filter(c => c.type === type).length;
  }

  return calls.length;
}
