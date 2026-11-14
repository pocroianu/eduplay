import Phaser from 'phaser';
import { coral, primary, blue, gold, purple, pink, surface, ink, type DuoColor } from '../tokens/colors';
import { fontStack, typeScale } from '../tokens/type';
import { radii } from '../tokens/spacing';

/**
 * SubjectPill — Phaser mirror of `kit/SubjectPill.tsx`.
 *
 * Tones include both the abstract palette names (`green`, `gold`, etc.) and
 * the subject-aliased names (`math`, `romana`, `stiinte`, ...) — same set as
 * the React prop union.
 */

export type SubjectPillTone =
  | 'green' | 'blue' | 'coral' | 'gold' | 'purple' | 'pink' | 'neutral'
  | 'math' | 'romana' | 'stiinte' | 'arte' | 'muzica' | 'sport';

interface ToneStyle {
  bg: DuoColor;
  fg: DuoColor;
}

const TONE_STYLES: Record<SubjectPillTone, ToneStyle> = {
  green:   { bg: primary.soft, fg: primary.deep },
  stiinte: { bg: primary.soft, fg: primary.deep },
  blue:    { bg: blue.soft,    fg: blue.deep    },
  math:    { bg: blue.soft,    fg: blue.deep    },
  coral:   { bg: coral.soft,   fg: coral.deep   },
  romana:  { bg: coral.soft,   fg: coral.deep   },
  gold:    { bg: gold.soft,    fg: gold.deep    },
  sport:   { bg: gold.soft,    fg: gold.deep    },
  purple:  { bg: purple.soft,  fg: purple.deep  },
  muzica:  { bg: purple.soft,  fg: purple.deep  },
  pink:    { bg: pink.soft,    fg: pink.deep    },
  arte:    { bg: pink.soft,    fg: pink.deep    },
  neutral: { bg: surface.container, fg: ink.base },
};

export interface SubjectPillConfig {
  x: number;
  y: number;
  label: string;
  tone?: SubjectPillTone;
}

/**
 * Pill / badge in Duo's small uppercase label style.
 */
export class SubjectPill extends Phaser.GameObjects.Container {
  readonly pillWidth: number;
  readonly pillHeight: number;

  constructor(scene: Phaser.Scene, config: SubjectPillConfig) {
    super(scene, config.x, config.y);

    const tone = TONE_STYLES[config.tone ?? 'green'];
    const text = scene.add.text(0, 0, config.label.toUpperCase(), {
      fontFamily: fontStack.display,
      fontSize: typeScale.label.cssSize,
      fontStyle: typeScale.label.weight,
      color: tone.fg.hex,
    }).setOrigin(0.5);

    const paddingX = 12;
    const paddingY = 4;

    this.pillWidth = text.width + paddingX * 2;
    this.pillHeight = text.height + paddingY * 2;

    const bg = scene.add.graphics();
    bg.fillStyle(tone.bg.num, 1);
    const pillRadius = Math.min(radii.pill, this.pillWidth / 2, this.pillHeight / 2);
    bg.fillRoundedRect(-this.pillWidth / 2, -this.pillHeight / 2, this.pillWidth, this.pillHeight, pillRadius);

    this.add([bg, text]);

    scene.add.existing(this);
  }
}
