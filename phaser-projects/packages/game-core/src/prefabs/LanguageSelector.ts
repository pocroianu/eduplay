import Phaser from 'phaser';
import i18n, { Language } from '../i18n';
import { ThemeConfig } from '../types/GameConfig';

const DEFAULT_THEME: ThemeConfig = {
	primary: 0x4F46E5,
	secondary: 0x10B981,
	background: 0x1F2937,
	cardBg: 0x374151,
	textColor: '#FFFFFF'
};

export interface LanguageSelectorConfig {
	x: number;
	y: number;
	theme?: ThemeConfig;
}

/**
 * LanguageSelector - Compact language switcher button
 * Shows current language flag, click to toggle between languages
 */
export default class LanguageSelector extends Phaser.GameObjects.Container {
	private theme: ThemeConfig;
	private flagText!: Phaser.GameObjects.Text;
	private background!: Phaser.GameObjects.Rectangle;
	private languageChangeCallback?: () => void;

	static readonly EVENTS = {
		LANGUAGE_CHANGED: 'language-changed'
	};

	constructor(scene: Phaser.Scene, config: LanguageSelectorConfig) {
		super(scene, config.x, config.y);

		this.theme = config.theme ?? DEFAULT_THEME;

		this.createButton();
		this.setupInteractivity();

		scene.add.existing(this);
		this.setDepth(200);
	}

	private createButton(): void {
		// Background
		this.background = this.scene.add.rectangle(0, 0, 50, 36, this.theme.cardBg);
		this.background.setStrokeStyle(2, this.theme.primary);
		this.add(this.background);

		// Flag emoji
		const meta = i18n.getMeta();
		this.flagText = this.scene.add.text(0, 0, meta.flag, {
			fontSize: '24px'
		});
		this.flagText.setOrigin(0.5);
		this.add(this.flagText);
	}

	private setupInteractivity(): void {
		this.background.setInteractive({ useHandCursor: true });

		this.background.on('pointerover', () => {
			this.scene.tweens.add({
				targets: this,
				scaleX: 1.1,
				scaleY: 1.1,
				duration: 100
			});
		});

		this.background.on('pointerout', () => {
			this.scene.tweens.add({
				targets: this,
				scaleX: 1,
				scaleY: 1,
				duration: 100
			});
		});

		this.background.on('pointerdown', () => {
			this.toggleLanguage();
		});
	}

	private toggleLanguage(): void {
		const current = i18n.getLanguage();
		const newLang: Language = current === 'en' ? 'ro' : 'en';
		
		i18n.setLanguage(newLang);
		this.updateDisplay();
		
		// Emit event for scene to handle
		this.emit(LanguageSelector.EVENTS.LANGUAGE_CHANGED, newLang);
	}

	private updateDisplay(): void {
		const meta = i18n.getMeta();
		this.flagText.setText(meta.flag);

		// Pop animation
		this.scene.tweens.add({
			targets: this.flagText,
			scaleX: 1.3,
			scaleY: 1.3,
			duration: 100,
			yoyo: true,
			ease: 'Back.easeOut'
		});
	}

	onLanguageChange(callback: () => void): void {
		this.languageChangeCallback = callback;
		i18n.onLanguageChange(callback);
	}

	destroy(): void {
		if (this.languageChangeCallback) {
			// Note: ideally we'd remove the listener, but for simplicity we'll let it be garbage collected
		}
		super.destroy();
	}
}
