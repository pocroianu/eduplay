import Phaser from 'phaser';
import AudioManager from '../managers/AudioManager';

export interface AudioControlsConfig {
    x: number;
    y: number;
    scale?: number;
    /** Optional AudioManager instance (falls back to getInstance() if not provided) */
    audioManager?: AudioManager;
}

/**
 * AudioControls - Simple mute/unmute button for audio
 */
export default class AudioControls extends Phaser.GameObjects.Container {
    private audioManager: AudioManager;
    private button!: Phaser.GameObjects.Container;
    private icon!: Phaser.GameObjects.Text;
    private background!: Phaser.GameObjects.Arc;

    private isMuted: boolean = false;
    private buttonSize: number = 40;

    constructor(scene: Phaser.Scene, config: AudioControlsConfig) {
        super(scene, config.x, config.y);

        // Use injected AudioManager or fall back to getInstance() for backward compatibility
        this.audioManager = config.audioManager ?? AudioManager.getInstance();
        this.isMuted = this.audioManager.isMuted();

        if (config.scale) {
            this.buttonSize *= config.scale;
        }

        this.createButton();
        scene.add.existing(this);
    }

    private createButton(): void {
        this.button = this.scene.add.container(0, 0);

        // Background circle
        this.background = this.scene.add.circle(0, 0, this.buttonSize / 2, 0x374151);
        this.background.setStrokeStyle(2, 0x6B7280);
        this.button.add(this.background);

        // Icon
        this.icon = this.scene.add.text(0, 0, this.getIcon(), {
            fontFamily: 'Arial, sans-serif',
            fontSize: `${this.buttonSize * 0.5}px`,
            color: '#FFFFFF'
        });
        this.icon.setOrigin(0.5);
        this.button.add(this.icon);

        this.add(this.button);

        // Make interactive
        this.button.setSize(this.buttonSize, this.buttonSize);
        this.button.setInteractive({ useHandCursor: true });

        this.button.on('pointerover', this.onHover, this);
        this.button.on('pointerout', this.onOut, this);
        this.button.on('pointerdown', this.onClick, this);
    }

    private getIcon(): string {
        return this.isMuted ? 'OFF' : 'ON';
    }

    private onHover(): void {
        this.scene.tweens.add({
            targets: this.button,
            scaleX: 1.1,
            scaleY: 1.1,
            duration: 100,
            ease: 'Back.out'
        });
        this.background.setFillStyle(0x4B5563);
    }

    private onOut(): void {
        this.scene.tweens.add({
            targets: this.button,
            scaleX: 1,
            scaleY: 1,
            duration: 100,
            ease: 'Back.out'
        });
        this.background.setFillStyle(0x374151);
    }

    private onClick(): void {
        this.isMuted = !this.audioManager.toggleMute();
        this.icon.setText(this.getIcon());

        // Play click sound if unmuting
        if (!this.isMuted) {
            this.audioManager.playSfx('click');
        }

        // Visual feedback
        this.scene.tweens.add({
            targets: this.button,
            scaleX: 0.9,
            scaleY: 0.9,
            duration: 50,
            yoyo: true,
            ease: 'Quad.out'
        });
    }

    /**
     * Update the icon state (call if audio state changes externally)
     */
    refresh(): void {
        this.isMuted = this.audioManager.isMuted();
        this.icon.setText(this.getIcon());
    }
}
