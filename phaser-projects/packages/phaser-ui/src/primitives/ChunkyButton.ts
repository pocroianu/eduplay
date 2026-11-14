import Phaser from 'phaser';
import { ink, tone, type ToneName, type DuoColor } from '../tokens/colors';
import { duration, easing } from '../tokens/motion';
import { fontStack, typeScale } from '../tokens/type';

/**
 * ChunkyButton — Phaser mirror of `kit/ChunkyButton.tsx`.
 *
 * Variants follow the React component's tone naming. The chunky 3D shadow
 * (`0 Npx 0 0 <dim>`) is faked with a second rounded rectangle drawn beneath
 * the face. Press state slides the face down by `depth` and collapses the
 * shadow — same affordance as the web button.
 */

export type ChunkyButtonVariant = ToneName | 'ghost' | 'ink';
export type ChunkyButtonSize = 'sm' | 'md' | 'lg';

export interface ChunkyButtonConfig {
  x: number;
  y: number;
  label: string;
  variant?: ChunkyButtonVariant;
  size?: ChunkyButtonSize;
  width?: number;
  /** Centered icon glyph drawn to the left of the label. */
  iconLeft?: Phaser.GameObjects.GameObject;
  /** Centered icon glyph drawn to the right of the label. */
  iconRight?: Phaser.GameObjects.GameObject;
  disabled?: boolean;
  onPress?: () => void;
}

interface SizeSpec {
  paddingX: number;
  paddingY: number;
  depth: number;
  radius: number;
  borderWidth: number;
  fontSize: number;
}

const SIZE_SPECS: Record<ChunkyButtonSize, SizeSpec> = {
  sm: { paddingX: 16, paddingY: 8,  depth: 3, radius: 12, borderWidth: 2, fontSize: 13 },
  md: { paddingX: 22, paddingY: 12, depth: 4, radius: 14, borderWidth: 2, fontSize: 15 },
  lg: { paddingX: 30, paddingY: 16, depth: 5, radius: 16, borderWidth: 3, fontSize: 18 },
};

interface VariantStyle {
  bg: DuoColor;
  shadow: DuoColor;
  text: string;
}

function variantStyle(variant: ChunkyButtonVariant): VariantStyle {
  if (variant === 'ghost') {
    return { bg: { hex: '#FFFFFF', num: 0xFFFFFF }, shadow: ink.outlineSoft, text: ink.base.hex };
  }
  if (variant === 'ink') {
    return { bg: ink.base, shadow: ink.shadow, text: '#FFFFFF' };
  }
  const t = tone[variant];
  return { bg: t.base, shadow: t.dim, text: t.on.hex };
}

/**
 * Phaser equivalent of `<ChunkyButton>` from the Duo kit. Press affordance
 * matches the React component (translateY(depth) + collapse shadow on press).
 */
export class ChunkyButton extends Phaser.GameObjects.Container {
  private readonly spec: SizeSpec;
  private readonly style: VariantStyle;
  private readonly faceGfx: Phaser.GameObjects.Graphics;
  private readonly shadowGfx: Phaser.GameObjects.Graphics;
  private readonly hitZone: Phaser.GameObjects.Zone;
  private readonly labelText: Phaser.GameObjects.Text;
  private readonly buttonWidth: number;
  private readonly buttonHeight: number;
  private isPressed = false;
  private isDisabled: boolean;
  private readonly onPress?: () => void;

  constructor(scene: Phaser.Scene, config: ChunkyButtonConfig) {
    super(scene, config.x, config.y);

    this.spec = SIZE_SPECS[config.size ?? 'md'];
    this.style = variantStyle(config.variant ?? 'green');
    this.isDisabled = config.disabled === true;
    this.onPress = config.onPress;

    this.labelText = scene.add.text(0, 0, config.label, {
      fontFamily: fontStack.display,
      fontSize: `${this.spec.fontSize}px`,
      fontStyle: '800',
      color: this.style.text,
      align: 'center',
    }).setOrigin(0.5);

    const measuredWidth = this.labelText.width
      + (config.iconLeft ? typeScale.body.size + 8 : 0)
      + (config.iconRight ? typeScale.body.size + 8 : 0);

    this.buttonWidth = config.width
      ?? Math.max(64, measuredWidth + this.spec.paddingX * 2);
    this.buttonHeight = this.labelText.height + this.spec.paddingY * 2;

    this.shadowGfx = scene.add.graphics();
    this.faceGfx = scene.add.graphics();

    this.add([this.shadowGfx, this.faceGfx, this.labelText]);
    if (config.iconLeft) {
      const iconLeftX = -this.buttonWidth / 2 + this.spec.paddingX;
      (config.iconLeft as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject).setPosition?.(iconLeftX, 0);
      this.add(config.iconLeft);
      this.labelText.x = (iconLeftX + this.buttonWidth / 2 - this.spec.paddingX) / 2;
    }
    if (config.iconRight) {
      const iconRightX = this.buttonWidth / 2 - this.spec.paddingX;
      (config.iconRight as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject).setPosition?.(iconRightX, 0);
      this.add(config.iconRight);
    }

    this.draw(false);

    this.hitZone = scene.add.zone(0, 0, this.buttonWidth, this.buttonHeight + this.spec.depth);
    this.hitZone.setOrigin(0.5, 0.5);
    this.add(this.hitZone);

    if (!this.isDisabled) {
      this.hitZone.setInteractive({ useHandCursor: true });
      this.hitZone.on('pointerdown', this.handlePointerDown, this);
      this.hitZone.on('pointerup', this.handlePointerUp, this);
      this.hitZone.on('pointerout', this.handlePointerOut, this);
    } else {
      this.setAlpha(0.5);
    }

    scene.add.existing(this);
  }

  private draw(pressed: boolean): void {
    const { depth, radius, borderWidth } = this.spec;
    const halfW = this.buttonWidth / 2;
    const halfH = this.buttonHeight / 2;

    this.shadowGfx.clear();
    this.faceGfx.clear();

    if (!pressed) {
      this.shadowGfx.fillStyle(this.style.shadow.num, 1);
      this.shadowGfx.fillRoundedRect(-halfW, -halfH + depth, this.buttonWidth, this.buttonHeight, radius);
    }

    const faceY = pressed ? depth : 0;
    this.faceGfx.fillStyle(this.style.bg.num, 1);
    this.faceGfx.fillRoundedRect(-halfW, -halfH + faceY, this.buttonWidth, this.buttonHeight, radius);
    this.faceGfx.lineStyle(borderWidth, ink.base.num, 1);
    this.faceGfx.strokeRoundedRect(-halfW, -halfH + faceY, this.buttonWidth, this.buttonHeight, radius);

    this.labelText.y = faceY;
  }

  private handlePointerDown(): void {
    if (this.isDisabled) return;
    this.isPressed = true;
    this.draw(true);
  }

  private handlePointerUp(): void {
    if (this.isDisabled) return;
    const wasPressed = this.isPressed;
    this.isPressed = false;
    this.draw(false);
    if (wasPressed && this.onPress) {
      this.onPress();
    }
  }

  private handlePointerOut(): void {
    if (this.isPressed) {
      this.isPressed = false;
      this.draw(false);
    }
  }

  setDisabled(disabled: boolean): this {
    this.isDisabled = disabled;
    this.setAlpha(disabled ? 0.5 : 1);
    if (disabled) {
      this.hitZone.disableInteractive();
    } else {
      this.hitZone.setInteractive({ useHandCursor: true });
    }
    return this;
  }

  setLabel(label: string): this {
    this.labelText.setText(label);
    return this;
  }

  /**
   * Bounce the face slightly (used after a successful action) — uses Duo
   * `--ease-spring` and `--t-press` motion tokens.
   */
  pulse(): this {
    this.scene.tweens.add({
      targets: this.faceGfx,
      scaleX: 0.96,
      scaleY: 0.96,
      duration: duration.press,
      yoyo: true,
      ease: easing.spring.phaser,
    });
    return this;
  }
}
