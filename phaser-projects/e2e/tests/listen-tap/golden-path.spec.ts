import { test, expect, type Frame, type Page } from '@playwright/test';
import { buildActivityLaunchUrl } from '../../utils/activity-url';

/**
 * Listen-and-Tap — golden-path spec (EDU-74 Phase 1)
 *
 * The student UI is audio-first and has no text, so this spec drives the
 * game through its internal event bus rather than through screen-reader
 * selectors. For each round we:
 *   1. wait for ListenTapLevel.currentTray to exist (after the
 *      prompt-to-choice delay)
 *   2. locate the tile flagged `correct` on the tray
 *   3. emit ChoiceTile.EVENTS.TAPPED ('choice-tile-tapped') on it so the
 *      tray arbitrates a correct answer without any real pointer math
 *
 * That mirrors what a child's successful first-tap would do, minus the
 * pointer hit-testing Phaser would otherwise need a real cursor for.
 */

type GamePage = Page | Frame;

async function waitForTray(page: GamePage) {
    await page.waitForFunction(
        () => {
            const game = (window as any).__PHASER_GAME__;
            const level = game?.scene?.getScene('ListenTapLevel');
            return !!level?.currentTray && level.currentTray.getTiles?.().length > 0;
        },
        { timeout: 15000 }
    );
}

async function tapCorrectTile(page: GamePage): Promise<void> {
    await page.evaluate(() => {
        const game = (window as any).__PHASER_GAME__;
        const level = game?.scene?.getScene('ListenTapLevel');
        const tiles = level?.currentTray?.getTiles?.() ?? [];
        const correct = tiles.find((t: any) => t.correct);
        if (correct) correct.emit('choice-tile-tapped', correct);
    });
}

async function getRuntimeTotalSteps(page: GamePage): Promise<number> {
    return page.evaluate(() => (window as any).__GAME_MANAGER__?.getTotalSteps?.() ?? 0);
}

async function completeAllListenTapRounds(page: GamePage): Promise<void> {
    const totalSteps = await getRuntimeTotalSteps(page);
    for (let i = 0; i < totalSteps; i++) {
        await page.waitForFunction(
            (expected) => {
                const game = (window as any).__PHASER_GAME__;
                const level = game?.scene?.getScene('ListenTapLevel');
                if (!level) return false;
                if (level.roundIndex !== expected) return false;
                const tray = level.currentTray;
                if (!tray) return false;
                const tiles = tray.getTiles?.() ?? [];
                if (tiles.length === 0) return false;
                // currentTray.solved is set true after a correct tap;
                // wait for the fresh tray where no tile has been chosen.
                return !tray.solved;
            },
            i,
            { timeout: 15000 }
        );

        await tapCorrectTile(page);
    }
}

test.describe('Listen-and-Tap — phonics-ro-01 golden path', () => {
    test.beforeEach(async ({ page }) => {
        page.on('pageerror', (err) => console.error('[pageerror]', err));
        page.on('console', (msg) => {
            if (msg.type() === 'error') console.error('[console.error]', msg.text());
        });

        await page.goto(buildActivityLaunchUrl({ templateId: 'listen-tap', activityId: 'phonics-ro-01', lang: 'ro' }));
        await page.waitForSelector('canvas', { timeout: 15000 });

        await page.waitForFunction(
            () => {
                const game = (window as any).__PHASER_GAME__;
                const scenes = game?.scene?.getScenes(true).map((s: any) => s.scene.key) ?? [];
                return scenes.includes('ListenTapLevel');
            },
            { timeout: 15000 }
        );
    });

    test('loads the expected 5 rounds from config', async ({ page }) => {
        await waitForTray(page);
        const roundCount = await page.evaluate(() => {
            const game = (window as any).__PHASER_GAME__;
            const level = game?.scene?.getScene('ListenTapLevel');
            return level?.rounds?.length ?? 0;
        });
        expect(roundCount).toBe(5);
    });

    test('first round spawns a tray with at least 2 tiles, exactly one correct', async ({ page }) => {
        await waitForTray(page);
        const info = await page.evaluate(() => {
            const game = (window as any).__PHASER_GAME__;
            const level = game?.scene?.getScene('ListenTapLevel');
            const tiles = level?.currentTray?.getTiles?.() ?? [];
            return {
                count: tiles.length,
                correctCount: tiles.filter((t: any) => t.correct).length
            };
        });
        expect(info.count).toBeGreaterThanOrEqual(2);
        expect(info.correctCount).toBe(1);
    });

    test('score starts at 0 and a correct tap adds pointsPerRound', async ({ page }) => {
        await waitForTray(page);

        const scoreBefore = await page.evaluate(
            () => (window as any).__GAME_MANAGER__?.getScore() ?? -1
        );
        expect(scoreBefore).toBe(0);

        await tapCorrectTile(page);

        await page.waitForFunction(
            () => ((window as any).__GAME_MANAGER__?.getScore() ?? 0) > 0,
            { timeout: 5000 }
        );

        const scoreAfter = await page.evaluate(
            () => (window as any).__GAME_MANAGER__?.getScore() ?? -1
        );
        expect(scoreAfter).toBe(10);
    });

    test('completing all 5 rounds with correct taps navigates to Results with full score and 3 stars', async ({ page }) => {
        // Play 5 rounds in sequence. Between rounds there is a
        // prompt-to-choice delay of 700ms plus a post-correct roundDelay
        // (default 900ms) plus the feedback overlay animation — during that
        // window the previous tray is still attached while roundIndex hasn't
        // advanced yet. Wait for BOTH roundIndex and a *live* (unsolved) tray
        // so we never tap a stale tile from the previous round.
        await completeAllListenTapRounds(page);

        await page.waitForFunction(
            () => {
                const game = (window as any).__PHASER_GAME__;
                const scenes = game?.scene?.getScenes(true).map((s: any) => s.scene.key) ?? [];
                return scenes.includes('Results');
            },
            { timeout: 15000 }
        );

        const finalState = await page.evaluate(() => {
            const manager = (window as any).__GAME_MANAGER__;
            return {
                score: manager?.getScore() ?? -1,
                totalSteps: manager?.getTotalSteps?.() ?? -1,
                completedSteps: manager?.getCompletedSteps?.() ?? -1,
                maxScore: manager?.getMaxScore?.() ?? -1,
                scorePercent: manager?.getScorePercent?.() ?? -1,
                isComplete: manager?.isGameComplete() ?? false
            };
        });
        expect(finalState).toEqual({
            score: 50,
            totalSteps: 5,
            completedSteps: 5,
            maxScore: 50,
            scorePercent: 100,
            isComplete: true
        });

        const resultsData = await page.evaluate(() => {
            const game = (window as any).__PHASER_GAME__;
            const results = game?.scene?.getScene('Results');
            const data = results?.sys?.settings?.data;
            return data ? {
                starRating: data.starRating,
                rawScore: data.rawScore,
                maxScore: data.maxScore,
                scorePercent: data.scorePercent,
                totalSteps: data.totalSteps,
                completedSteps: data.completedSteps
            } : null;
        });
        expect(resultsData).toEqual({
            starRating: 3,
            rawScore: 50,
            maxScore: 50,
            scorePercent: 100,
            totalSteps: 5,
            completedSteps: 5
        });
    });

    test('replay button reemits the prompt-started event for the current round', async ({ page }) => {
        await waitForTray(page);

        const eventFired = await page.evaluate(async () => {
            const game = (window as any).__PHASER_GAME__;
            const level = game?.scene?.getScene('ListenTapLevel');
            if (!level) return false;

            return await new Promise<boolean>((resolve) => {
                const timeout = setTimeout(() => resolve(false), 3000);
                level.events.once('listen-tap-prompt-started', () => {
                    clearTimeout(timeout);
                    resolve(true);
                });
                level.promptButton?.emit('audio-prompt-pressed');
            });
        });

        expect(eventFired).toBe(true);
    });
});

test.describe('Listen-and-Tap parent bridge messages', () => {
    test('posts ready, progress, and completion messages from iframe activity play', async ({ page }) => {
        page.on('pageerror', (err) => console.error('[pageerror]', err));
        page.on('console', (msg) => {
            if (msg.type() === 'error') console.error('[console.error]', msg.text());
        });

        // First navigate to the template origin so the parent page has the
        // same origin that the iframe bridge is allowed to target.
        await page.goto('/');
        const parentOrigin = new URL(page.url()).origin;
        const iframeSrc = buildActivityLaunchUrl({
            templateId: 'listen-tap',
            activityId: 'phonics-ro-01',
            lang: 'ro',
            params: { origin: parentOrigin }
        });

        await page.setContent(`
            <!doctype html>
            <html>
                <body style="margin:0">
                    <script>
                        window.__activityMessages = [];
                        window.addEventListener('message', (event) => {
                            window.__activityMessages.push(event.data);
                        });
                    </script>
                    <iframe id="activity-frame" src="${iframeSrc}" style="width:1280px;height:720px;border:0" allowfullscreen></iframe>
                </body>
            </html>
        `);

        const frameElement = await page.waitForSelector('#activity-frame', { timeout: 15000 });
        const frame = await frameElement.contentFrame();
        expect(frame).not.toBeNull();
        if (!frame) return;

        await page.waitForFunction(
            () => (window as any).__activityMessages?.some((message: any) => message.type === 'ACTIVITY_READY'),
            { timeout: 15000 }
        );
        await frame.waitForSelector('canvas', { timeout: 15000 });
        await frame.waitForFunction(
            () => {
                const game = (window as any).__PHASER_GAME__;
                const scenes = game?.scene?.getScenes(true).map((s: any) => s.scene.key) ?? [];
                return scenes.includes('ListenTapLevel');
            },
            { timeout: 15000 }
        );

        const expectedTotalSteps = await getRuntimeTotalSteps(frame);
        await completeAllListenTapRounds(frame);

        await page.waitForFunction(
            () => (window as any).__activityMessages?.some((message: any) => message.type === 'GAME_COMPLETE'),
            { timeout: 15000 }
        );

        const messages = await page.evaluate(() => (window as any).__activityMessages);
        const progressMessages = messages.filter((message: any) => message.type === 'PROGRESS_UPDATE');
        const completeMessage = messages.find((message: any) => message.type === 'GAME_COMPLETE');

        expect(messages.some((message: any) => message.type === 'ACTIVITY_READY')).toBe(true);
        expect(progressMessages.length).toBeGreaterThan(0);
        expect(progressMessages.at(-1)).toEqual({
            type: 'PROGRESS_UPDATE',
            currentSet: expectedTotalSteps,
            totalSets: expectedTotalSteps,
            progress: 1
        });
        expect(completeMessage).toEqual(expect.objectContaining({
            type: 'GAME_COMPLETE',
            score: 100,
            totalSets: expectedTotalSteps,
            starRating: 3,
            reason: 'completed'
        }));
    });
});
