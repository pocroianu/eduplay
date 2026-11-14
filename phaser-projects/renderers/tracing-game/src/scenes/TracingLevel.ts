import Phaser from 'phaser';
import {
    GameManager,
    AudioManager,
    AccessibilityManager,
    AnimatedBackground,
    FeedbackOverlay,
    ProgressIndicator,
    ThemeConfig,
    getPreviewRuntimeSettings,
    ConfigLoader,
    i18n
} from '@edu-play/game-core';
import { parseSvgPath, generateCheckpoints, transformStroke, Checkpoint } from '../utils/svgPathParser';
import GuidePath from '../prefabs/GuidePath';
import TraceTrail from '../prefabs/TraceTrail';
import TracingParticles from '../prefabs/TracingParticles';
import ItemDisplay from '../prefabs/ItemDisplay';

interface RawStroke {
    path: string;
    checkpoints: number;
}

interface RawItem {
    id: string;
    labelKey: string;
    strokes: RawStroke[];
}

interface RawTracingConfig {
    meta: {
        gameId: string;
        version?: string;
        gameType?: string;
        themeName?: string;
        supportedLanguages?: string[];
    };
    settings: {
        toleranceRadius: number;
        checkpointSpacing: number;
        pointsPerItem?: number;
        showGuideLabels: boolean;
        autoAdvanceDelay: number;
    };
    items: RawItem[];
}

interface HydratedItem {
    id: string;
    label: string;
    strokes: RawStroke[];
}

interface ActiveStroke {
    guidePath: GuidePath;
    traceTrail: TraceTrail;
    checkpoints: Checkpoint[];
    nextCheckpointIndex: number;
}

export default class TracingLevel extends Phaser.Scene {
    private gameManager!: GameManager;
    private audioManager!: AudioManager;
    private a11yManager!: AccessibilityManager;
    private theme!: ThemeConfig;

    private items: HydratedItem[] = [];
    private currentItemIndex = 0;
    private pointsPerItem = 10;

    private settings = {
        toleranceRadius: 40,
        checkpointSpacing: 30,
        showGuideLabels: true,
        autoAdvanceDelay: 1500
    };

    // Current item state
    private itemDisplay: ItemDisplay | null = null;
    private activeStroke: ActiveStroke | null = null;
    private completedStrokes: (GuidePath | TraceTrail)[] = [];
    private currentStrokeIndex = 0;
    private particles!: TracingParticles;
    private isTracing = false;
    private isPaused = false;

    // Scale transform for local→screen coords
    private pathScale = 1;
    private pathOffsetX = 0;
    private pathOffsetY = 0;

    // UI
    private feedbackOverlay!: FeedbackOverlay;
    private progressIndicator!: ProgressIndicator;
    private instructionText = 'Trace the shape!';

    // Keyboard cursor
    private keyboardCursorIndex = 0;
    private keyboardCursor: Phaser.GameObjects.Arc | null = null;

    // Smooth tracing: pre-sampled path points for fast nearest-point lookup
    private pathSamplePoints: Phaser.Math.Vector2[] = [];
    private static readonly PATH_SAMPLES = 200;

    // Finger cursor: a glowing circle that follows the pointer projected onto the path
    private fingerCursor: Phaser.GameObjects.Arc | null = null;
    private fingerCursorGlow: Phaser.GameObjects.Arc | null = null;

    // The t-value at which the last checkpoint was claimed (floor for trail progress)
    private lastClaimedT = 0;

    constructor() {
        super('TracingLevel');
    }

    async create(): Promise<void> {
        this.gameManager = GameManager.getInstance();
        this.audioManager = AudioManager.getInstance();
        this.a11yManager = AccessibilityManager.getInstance();

        // Reset state
        this.currentItemIndex = 0;
        this.currentStrokeIndex = 0;
        this.completedStrokes = [];
        this.isTracing = false;
        this.isPaused = false;

        try {
            await this.loadTracingConfig();
        } catch (err) {
            console.error('[TracingLevel] Failed to load config:', err);
            this.showError(String(err));
            return;
        }

        if (!this.items.length) {
            console.error('[TracingLevel] No items in config');
            this.showError('No items found in config');
            return;
        }

        const themeOverride = getPreviewRuntimeSettings().theme;
        if (themeOverride) {
            this.gameManager.setThemeName(themeOverride);
        }
        this.theme = this.gameManager.getTheme();

        // Background
        new AnimatedBackground(this, {
            width: this.scale.width,
            height: this.scale.height,
            theme: this.theme
        });

        // Instruction text
        this.add.text(this.scale.width / 2, 40, this.instructionText, {
            fontSize: '26px',
            color: '#ffffff',
            fontFamily: "'Nunito', Arial, sans-serif",
            fontStyle: 'bold',
            align: 'center'
        }).setOrigin(0.5);

        // Particles manager
        this.particles = new TracingParticles(this, { theme: this.theme });

        // Feedback overlay
        this.feedbackOverlay = new FeedbackOverlay(this, { theme: this.theme });
        this.gameManager.on(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.on(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.events.once('shutdown', this.shutdown, this);

        // Progress indicator
        this.progressIndicator = new ProgressIndicator(this, {
            x: this.scale.width / 2,
            y: 80,
            totalSteps: this.items.length,
            theme: this.theme
        });

        // Bottom navbar

        // Setup pointer events
        this.setupPointerEvents();

        // Setup keyboard
        this.setupKeyboardAccessibility();

        // Start first item
        this.showItem(0);
    }

    private async loadTracingConfig(): Promise<void> {
        const preview = getPreviewRuntimeSettings();
        const gameId = preview.gameId
            || ConfigLoader.getGameIdFromUrl()
            || 'uppercase-a-to-f';

        const urlLang = preview.language
            || ConfigLoader.getLanguageFromUrl()
            || 'en';

        i18n.setLanguage(urlLang);

        const bundle = await ConfigLoader.getInstance().loadTemplateConfig({
            gameId,
            language: urlLang
        });
        const raw = bundle.config as unknown as RawTracingConfig;
        const strings = bundle.strings as {
            meta?: any;
            instruction?: string;
            items?: Record<string, string>;
        };

        this.pointsPerItem = raw.settings.pointsPerItem ?? 10;
        this.settings = { ...this.settings, ...raw.settings };

        if (strings.instruction) {
            this.instructionText = strings.instruction;
        }

        const itemStrings = strings.items ?? {};
        this.items = raw.items.map(i => ({
            id: i.id,
            label: itemStrings[i.labelKey] ?? i.labelKey,
            strokes: i.strokes
        }));

        this.gameManager.loadSyntheticActivityConfig({
            gameId: raw.meta.gameId,
            title: strings.meta?.title ?? raw.meta.gameId,
            totalSteps: this.items.length,
            maxScore: this.items.length * this.pointsPerItem,
            theme: this.gameManager.getTheme(),
            meta: { pointsPerItem: this.pointsPerItem }
        });
    }

    /**
     * Compute transform that centers the current item's actual bounding box
     * on screen, rather than centering the full 0-200 coordinate space.
     */
    private computePathTransform(strokes: RawStroke[]): void {
        // Find bounding box across all strokes for this item
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const strokeDef of strokes) {
            const path = parseSvgPath(strokeDef.path);
            const points = path.getPoints(64);
            for (const p of points) {
                if (p.x < minX) minX = p.x;
                if (p.y < minY) minY = p.y;
                if (p.x > maxX) maxX = p.x;
                if (p.y > maxY) maxY = p.y;
            }
        }

        const contentW = maxX - minX || 1;
        const contentH = maxY - minY || 1;

        const margin = 140;
        const availableW = this.scale.width - 200;
        const availableH = this.scale.height - margin * 2;

        this.pathScale = Math.min(availableW / contentW, availableH / contentH);

        // Center the content bounding box on screen
        const scaledW = contentW * this.pathScale;
        const scaledH = contentH * this.pathScale;
        this.pathOffsetX = (this.scale.width - scaledW) / 2 - minX * this.pathScale;
        this.pathOffsetY = margin + (availableH - scaledH) / 2 - minY * this.pathScale;
    }

    private showItem(index: number): void {
        this.currentItemIndex = index;
        this.currentStrokeIndex = 0;
        this.gameManager.startStep(index);

        this.clearCurrentItem();

        const item = this.items[index];

        // Compute transform centered on this item's bounding box
        this.computePathTransform(item.strokes);

        if (this.settings.showGuideLabels) {
            this.itemDisplay = new ItemDisplay(this, {
                x: this.scale.width / 2,
                y: this.scale.height / 2,
                label: item.label,
                theme: this.theme
            });
            this.itemDisplay.animateIn();
        }

        const totalStrokes = item.strokes.length;
        this.a11yManager.announce(
            `Trace ${item.label}. Stroke 1 of ${totalStrokes}.`
        );

        this.progressIndicator.setStep(index);

        this.showStroke(0);
    }

    private showStroke(strokeIndex: number): void {
        this.currentStrokeIndex = strokeIndex;
        const item = this.items[this.currentItemIndex];
        const strokeDef = item.strokes[strokeIndex];

        const localPath = parseSvgPath(strokeDef.path);
        const localCheckpoints = generateCheckpoints(
            localPath,
            strokeDef.checkpoints,
            this.settings.checkpointSpacing
        );

        const { path: screenPath, checkpoints: screenCheckpoints } = transformStroke(
            localPath,
            localCheckpoints,
            this.pathScale,
            this.pathOffsetX,
            this.pathOffsetY
        );

        const guidePath = new GuidePath(this, {
            path: screenPath,
            checkpoints: screenCheckpoints,
            theme: this.theme
        });
        guidePath.animateIn();

        const traceTrail = new TraceTrail(this, {
            path: screenPath,
            checkpoints: screenCheckpoints,
            theme: this.theme
        });
        traceTrail.animateIn(100);

        this.activeStroke = {
            guidePath,
            traceTrail,
            checkpoints: screenCheckpoints,
            nextCheckpointIndex: 0
        };

        // Pre-sample the path for fast nearest-point projection during drag
        this.pathSamplePoints = [];
        for (let i = 0; i <= TracingLevel.PATH_SAMPLES; i++) {
            const t = i / TracingLevel.PATH_SAMPLES;
            this.pathSamplePoints.push(screenPath.getPoint(t));
        }

        this.lastClaimedT = 0;
        this.createFingerCursor();

        this.keyboardCursorIndex = 0;
        this.updateKeyboardCursor();
    }

    private setupPointerEvents(): void {
        this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
            if (this.isPaused || !this.activeStroke) return;
            this.tryStartTracing(pointer.x, pointer.y);
        });

        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (this.isPaused || !this.activeStroke) return;
            if (!this.isTracing || !pointer.isDown) {
                if (this.isTracing) {
                    this.isTracing = false;
                    this.particles.stopTrail();
                    this.hideFingerCursor();
                }
                return;
            }
            this.handleTraceMove(pointer.x, pointer.y);
        });

        this.input.on('pointerup', () => {
            this.isTracing = false;
            this.particles.stopTrail();
            this.hideFingerCursor();
        });
    }

    private tryStartTracing(x: number, y: number): void {
        if (!this.activeStroke) return;

        const nextCp = this.activeStroke.checkpoints[this.activeStroke.nextCheckpointIndex];
        if (!nextCp) return;

        const dist = Phaser.Math.Distance.Between(x, y, nextCp.x, nextCp.y);
        const tolerance = this.settings.toleranceRadius;

        if (dist <= tolerance) {
            this.isTracing = true;
            this.showFingerCursor();
            this.particles.startTrail(nextCp.x, nextCp.y);
            this.claimCheckpoint();
            return;
        }

        // Allow starting from anywhere near the unclaimed portion of the path
        const { distSq } = this.findNearestPathSample(x, y);
        if (Math.sqrt(distSq) <= tolerance) {
            this.isTracing = true;
            this.showFingerCursor();
            const nearestPoint = this.pathSamplePoints[this.findNearestPathSample(x, y).index];
            this.particles.startTrail(nearestPoint.x, nearestPoint.y);
        }
    }

    /**
     * Core smooth-tracing handler called on every pointer move while dragging.
     *
     * 1. Projects the pointer position onto the nearest point on the path
     * 2. Computes the t-value of that projected point
     * 3. Clamps it so the trail can only advance up to the next unclaimed checkpoint
     * 4. Draws the trail smoothly to that t-value
     * 5. Moves the finger cursor and particle trail to the projected position
     * 6. Checks if the next checkpoint should be claimed
     */
    private handleTraceMove(x: number, y: number): void {
        if (!this.activeStroke) return;

        const nextCp = this.activeStroke.checkpoints[this.activeStroke.nextCheckpointIndex];
        if (!nextCp) return;

        // Find the nearest point on the path to the pointer
        const { index: nearestIndex, distSq } = this.findNearestPathSample(x, y);
        const nearestT = nearestIndex / TracingLevel.PATH_SAMPLES;
        const nearestPoint = this.pathSamplePoints[nearestIndex];
        const distToPath = Math.sqrt(distSq);
        const tolerance = this.settings.toleranceRadius;

        // If the pointer has strayed too far from the path, show hint
        if (distToPath > tolerance * 2) {
            this.activeStroke.guidePath.showHintPulse();
            return;
        }

        // Compute the t-value ceiling: the trail cannot advance past the
        // next unclaimed checkpoint's position on the path
        const total = this.activeStroke.checkpoints.length;
        const nextCpT = total > 1
            ? this.activeStroke.nextCheckpointIndex / (total - 1)
            : 1;

        // Clamp the trail progress: can go up to the next checkpoint t-value
        // (but not past it, since it hasn't been claimed yet)
        const clampedT = Math.min(nearestT, nextCpT);

        // Only advance forward, never backward (prevents trail shrinking)
        if (clampedT > this.lastClaimedT) {
            this.activeStroke.traceTrail.drawToProgress(clampedT);
        }

        // Move the finger cursor to the projected path point (smooth feel)
        const displayPoint = clampedT <= nearestT ? this.pathSamplePoints[Math.round(clampedT * TracingLevel.PATH_SAMPLES)] : nearestPoint;
        if (displayPoint) {
            this.updateFingerCursorPosition(displayPoint.x, displayPoint.y);
            this.particles.updateTrailPosition(displayPoint.x, displayPoint.y);
        }

        // Check if the pointer is close enough to claim the next checkpoint
        const distToNextCp = Phaser.Math.Distance.Between(x, y, nextCp.x, nextCp.y);
        if (distToNextCp <= tolerance) {
            this.claimCheckpoint();
        }
    }

    /**
     * Find the index of the nearest pre-sampled path point to a given position.
     * Uses squared distances to avoid sqrt in the hot loop.
     * Only searches forward from the last claimed position to prevent backtracking.
     */
    private findNearestPathSample(x: number, y: number): { index: number; distSq: number } {
        let bestIndex = 0;
        let bestDistSq = Infinity;

        // Start search from the sample corresponding to lastClaimedT
        const startIndex = Math.floor(this.lastClaimedT * TracingLevel.PATH_SAMPLES);

        for (let i = startIndex; i < this.pathSamplePoints.length; i++) {
            const p = this.pathSamplePoints[i];
            const dx = p.x - x;
            const dy = p.y - y;
            const dSq = dx * dx + dy * dy;
            if (dSq < bestDistSq) {
                bestDistSq = dSq;
                bestIndex = i;
            }
        }

        return { index: bestIndex, distSq: bestDistSq };
    }

    private claimCheckpoint(): void {
        if (!this.activeStroke) return;

        const cpIndex = this.activeStroke.nextCheckpointIndex;
        const cp = this.activeStroke.checkpoints[cpIndex];
        const total = this.activeStroke.checkpoints.length;

        // Update the claimed t-value so the trail and search window advance
        this.lastClaimedT = total > 1 ? cpIndex / (total - 1) : 1;

        this.activeStroke.traceTrail.claimCheckpoint(cpIndex);

        this.particles.burstAtCheckpoint(cp.x, cp.y);

        this.audioManager.playSfx('click');

        this.activeStroke.nextCheckpointIndex++;

        // Show pulsing indicator at the next checkpoint so user knows where to go
        const nextCp = this.activeStroke.checkpoints[this.activeStroke.nextCheckpointIndex];
        if (nextCp) {
            this.activeStroke.guidePath.showIndicatorAt(nextCp.x, nextCp.y);
        } else {
            this.activeStroke.guidePath.hideStartIndicator();
        }

        if (this.activeStroke.nextCheckpointIndex >= this.activeStroke.checkpoints.length) {
            this.onStrokeComplete();
        }
    }

    private onStrokeComplete(): void {
        if (!this.activeStroke) return;

        const item = this.items[this.currentItemIndex];
        const lastCp = this.activeStroke.checkpoints[this.activeStroke.checkpoints.length - 1];

        this.particles.burstAtStrokeComplete(lastCp.x, lastCp.y);
        this.particles.stopTrail();
        this.particles.destroyTrail();
        this.hideFingerCursor();
        this.audioManager.playSfx('click');

        this.completedStrokes.push(this.activeStroke.guidePath, this.activeStroke.traceTrail);
        this.activeStroke = null;
        this.isTracing = false;
        this.lastClaimedT = 0;
        this.pathSamplePoints = [];

        const nextStrokeIndex = this.currentStrokeIndex + 1;

        if (nextStrokeIndex < item.strokes.length) {
            this.a11yManager.announce(
                `Stroke ${this.currentStrokeIndex + 1} complete. Starting stroke ${nextStrokeIndex + 1}.`
            );

            this.time.delayedCall(400, () => {
                this.showStroke(nextStrokeIndex);
            });
        } else {
            this.onItemComplete();
        }
    }

    private onItemComplete(): void {
        const item = this.items[this.currentItemIndex];

        this.particles.burstAtItemComplete(this.scale.width / 2, this.scale.height / 2);

        this.gameManager.completeStep(this.currentItemIndex, {
            scoreDelta: this.pointsPerItem,
            correct: true
        });
        this.progressIndicator.completeStep(this.currentItemIndex, true);

        this.a11yManager.announceUrgent(`${item.label} complete! Great job!`);

        this.removeKeyboardCursor();

        // Animate out the item display before advancing
        if (this.itemDisplay) {
            this.itemDisplay.animateOut();
        }

        const nextItemIndex = this.currentItemIndex + 1;

        if (nextItemIndex < this.items.length) {
            this.feedbackOverlay.showCorrect().then(() => {
                this.time.delayedCall(this.settings.autoAdvanceDelay, () => {
                    this.showItem(nextItemIndex);
                });
            });
        } else {
            this.feedbackOverlay.showCorrect().then(() => {
                this.gameManager.completeActivity();
                this.scene.start('Results', this.gameManager.createResultsData({
                    restartScene: 'TracingLevel'
                }));
            });
        }
    }

    private clearCurrentItem(): void {
        for (const obj of this.completedStrokes) {
            obj.destroy();
        }
        this.completedStrokes = [];

        if (this.activeStroke) {
            this.activeStroke.guidePath.destroy();
            this.activeStroke.traceTrail.destroy();
            this.activeStroke = null;
        }

        if (this.itemDisplay) {
            this.itemDisplay.destroy();
            this.itemDisplay = null;
        }

        this.isTracing = false;
        this.lastClaimedT = 0;
        this.pathSamplePoints = [];
        this.particles.stopTrail();
        this.particles.destroyTrail();
        this.destroyFingerCursor();
        this.removeKeyboardCursor();
    }

    // --- Finger cursor: glowing circle that follows the pointer on the path ---

    private createFingerCursor(): void {
        this.destroyFingerCursor();

        // Outer glow
        this.fingerCursorGlow = this.add.circle(0, 0, 24, this.theme.primary, 0.25);
        this.fingerCursorGlow.setVisible(false);
        this.fingerCursorGlow.setDepth(10);

        // Inner solid dot
        this.fingerCursor = this.add.circle(0, 0, 12, this.theme.primary, 0.85);
        this.fingerCursor.setStrokeStyle(3, 0xffffff, 0.9);
        this.fingerCursor.setVisible(false);
        this.fingerCursor.setDepth(11);

        // Subtle breathing animation on the glow
        this.tweens.add({
            targets: this.fingerCursorGlow,
            scaleX: 1.4,
            scaleY: 1.4,
            alpha: 0.1,
            duration: 500,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
        });
    }

    private showFingerCursor(): void {
        if (this.fingerCursor) this.fingerCursor.setVisible(true);
        if (this.fingerCursorGlow) this.fingerCursorGlow.setVisible(true);
    }

    private hideFingerCursor(): void {
        if (this.fingerCursor) this.fingerCursor.setVisible(false);
        if (this.fingerCursorGlow) this.fingerCursorGlow.setVisible(false);
    }

    private updateFingerCursorPosition(x: number, y: number): void {
        if (this.fingerCursor) this.fingerCursor.setPosition(x, y);
        if (this.fingerCursorGlow) this.fingerCursorGlow.setPosition(x, y);
    }

    private destroyFingerCursor(): void {
        if (this.fingerCursor) {
            this.fingerCursor.destroy();
            this.fingerCursor = null;
        }
        if (this.fingerCursorGlow) {
            this.fingerCursorGlow.destroy();
            this.fingerCursorGlow = null;
        }
    }

    private setupKeyboardAccessibility(): void {
        this.input.keyboard?.on('keydown-RIGHT', () => {
            if (this.isPaused || !this.activeStroke) return;
            this.advanceKeyboardCursor(1);
        });

        this.input.keyboard?.on('keydown-LEFT', () => {
            if (this.isPaused || !this.activeStroke) return;
            this.advanceKeyboardCursor(-1);
        });

        this.input.keyboard?.on('keydown-SPACE', () => {
            if (this.isPaused || !this.activeStroke) return;
            this.keyboardClaimAttempt();
        });

        this.input.keyboard?.on('keydown-ENTER', () => {
            if (this.isPaused || !this.activeStroke) return;
            this.keyboardClaimAttempt();
        });
    }

    private advanceKeyboardCursor(direction: number): void {
        if (!this.activeStroke) return;
        const cps = this.activeStroke.checkpoints;
        this.keyboardCursorIndex = Phaser.Math.Clamp(
            this.keyboardCursorIndex + direction,
            0,
            cps.length - 1
        );
        this.updateKeyboardCursor();

        const cp = cps[this.keyboardCursorIndex];
        this.a11yManager.announce(`Cursor at position ${this.keyboardCursorIndex + 1} of ${cps.length}.`);
    }

    private keyboardClaimAttempt(): void {
        if (!this.activeStroke) return;

        if (this.keyboardCursorIndex === this.activeStroke.nextCheckpointIndex) {
            this.claimCheckpoint();
            this.keyboardCursorIndex = this.activeStroke.nextCheckpointIndex;
            this.updateKeyboardCursor();
        } else {
            this.a11yManager.announce('Move cursor to the next checkpoint first.');
        }
    }

    private updateKeyboardCursor(): void {
        if (!this.activeStroke) return;

        const cp = this.activeStroke.checkpoints[this.keyboardCursorIndex];
        if (!cp) return;

        if (!this.keyboardCursor) {
            this.keyboardCursor = this.add.circle(cp.x, cp.y, 10, 0xffffff, 0.7);
            this.keyboardCursor.setStrokeStyle(2, 0x000000, 0.5);
        } else {
            this.keyboardCursor.setPosition(cp.x, cp.y);
        }
    }

    private removeKeyboardCursor(): void {
        if (this.keyboardCursor) {
            this.keyboardCursor.destroy();
            this.keyboardCursor = null;
        }
    }

    private onPauseGame(): void {
        this.isPaused = true;
        this.isTracing = false;
    }

    private onResumeGame(): void {
        this.isPaused = false;
    }

    private showError(message: string): void {
        const { width, height } = this.cameras.main;
        this.add.text(width / 2, height / 2, `Error: ${message}`, {
            fontSize: '24px',
            color: '#E87D7D',
            align: 'center',
            wordWrap: { width: width - 100 }
        }).setOrigin(0.5);
    }

    shutdown(): void {
        this.gameManager.off(GameManager.EVENTS.CONTROL_PAUSE, this.onPauseGame, this);
        this.gameManager.off(GameManager.EVENTS.CONTROL_RESUME, this.onResumeGame, this);
        this.clearCurrentItem();
    }
}
