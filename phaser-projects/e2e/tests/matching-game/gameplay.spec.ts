import { test, expect } from '@playwright/test';
import { buildActivityLaunchUrl } from '../../utils/activity-url';

test.describe('Matching Game — animals-match-01', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto(buildActivityLaunchUrl({ templateId: 'matching-game', activityId: 'animals-match-01' }));
        // Wait for Phaser canvas
        await page.waitForSelector('canvas', { timeout: 15000 });
        // Wait for game to be ready (GameManager config loaded by MatchLevel)
        await page.waitForFunction(
            () => !!(window as any).__GAME_MANAGER__?.getConfig(),
            { timeout: 15000 }
        );
    });

    test('renders 4 image cards and 4 word cards', async ({ page }) => {
        const pairCount = await page.evaluate(() => {
            const gm = (window as any).__GAME_MANAGER__;
            const config = gm?.getConfig();
            return config?.pairs?.length ?? 0;
        });
        expect(pairCount).toBe(4);
    });

    test('score starts at 0', async ({ page }) => {
        const score = await page.evaluate(() => {
            return (window as any).__GAME_MANAGER__?.getScore() ?? -1;
        });
        expect(score).toBe(0);
    });

    test('correct match increases score by pointsPerPair', async ({ page }) => {
        const firstPairId = await page.evaluate(() => {
            const config = (window as any).__GAME_MANAGER__?.getConfig();
            return config?.pairs?.[0]?.id ?? null;
        });
        expect(firstPairId).not.toBeNull();

        await page.evaluate((pairId) => {
            const game = (window as any).__PHASER_GAME__;
            const matchLevel = game?.scene?.getScene('MatchLevel');
            if (matchLevel) {
                const mc = matchLevel.matchCards?.find((c: any) => c.pairId === pairId);
                const wc = matchLevel.wordCards?.find((c: any) => c.pairId === pairId);
                if (mc && wc) {
                    mc.emit('matchcard-selected', mc);
                    wc.emit('wordcard-selected', wc);
                }
            }
        }, firstPairId);

        await page.waitForTimeout(200);

        const state = await page.evaluate(() => {
            const manager = (window as any).__GAME_MANAGER__;
            return {
                score: manager?.getScore() ?? -1,
                totalSteps: manager?.getTotalSteps?.() ?? -1,
                completedSteps: manager?.getCompletedSteps?.() ?? -1,
                maxScore: manager?.getMaxScore?.() ?? -1,
                scorePercent: manager?.getScorePercent?.() ?? -1
            };
        });
        expect(state).toEqual({
            score: 10,
            totalSteps: 4,
            completedSteps: 1,
            maxScore: 40,
            scorePercent: 25
        });
    });

    test('wrong match does not change score', async ({ page }) => {
        const pairs = await page.evaluate(() => {
            return (window as any).__GAME_MANAGER__?.getConfig()?.pairs ?? [];
        });

        const p1 = pairs[0]?.id;
        const p2 = pairs[1]?.id;

        await page.evaluate(([matchId, wordId]) => {
            const game = (window as any).__PHASER_GAME__;
            const matchLevel = game?.scene?.getScene('MatchLevel');
            if (matchLevel) {
                const mc = matchLevel.matchCards?.find((c: any) => c.pairId === matchId);
                const wc = matchLevel.wordCards?.find((c: any) => c.pairId === wordId);
                if (mc && wc) {
                    mc.emit('matchcard-selected', mc);
                    wc.emit('wordcard-selected', wc);
                }
            }
        }, [p1, p2]);

        await page.waitForTimeout(400);

        const score = await page.evaluate(() => {
            return (window as any).__GAME_MANAGER__?.getScore() ?? -1;
        });
        expect(score).toBe(0);
    });

    test('completing all pairs triggers game complete and navigates to Results', async ({ page }) => {
        await page.evaluate(() => {
            const game = (window as any).__PHASER_GAME__;
            const matchLevel = game?.scene?.getScene('MatchLevel');
            const config = (window as any).__GAME_MANAGER__?.getConfig();
            if (!matchLevel || !config) return;

            config.pairs.forEach((pair: any) => {
                const mc = matchLevel.matchCards?.find((c: any) => c.pairId === pair.id);
                const wc = matchLevel.wordCards?.find((c: any) => c.pairId === pair.id);
                if (mc && wc) {
                    mc.emit('matchcard-selected', mc);
                    wc.emit('wordcard-selected', wc);
                }
            });
        });

        await page.waitForFunction(
            () => {
                const game = (window as any).__PHASER_GAME__;
                const scenes = game?.scene?.getScenes(true).map((s: any) => s.scene.key) ?? [];
                return scenes.includes('Results');
            },
            { timeout: 10000 }
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
            score: 40,
            totalSteps: 4,
            completedSteps: 4,
            maxScore: 40,
            scorePercent: 100,
            isComplete: true
        });
    });

    test('final score equals totalPairs * pointsPerPair when no wrong attempts', async ({ page }) => {
        await page.evaluate(() => {
            const game = (window as any).__PHASER_GAME__;
            const matchLevel = game?.scene?.getScene('MatchLevel');
            const config = (window as any).__GAME_MANAGER__?.getConfig();
            if (!matchLevel || !config) return;

            config.pairs.forEach((pair: any) => {
                const mc = matchLevel.matchCards?.find((c: any) => c.pairId === pair.id);
                const wc = matchLevel.wordCards?.find((c: any) => c.pairId === pair.id);
                if (mc && wc) {
                    mc.emit('matchcard-selected', mc);
                    wc.emit('wordcard-selected', wc);
                }
            });
        });

        await page.waitForFunction(
            () => {
                const game = (window as any).__PHASER_GAME__;
                const scenes = game?.scene?.getScenes(true).map((s: any) => s.scene.key) ?? [];
                return (window as any).__GAME_MANAGER__?.isGameComplete() === true && scenes.includes('Results');
            },
            { timeout: 10000 }
        );

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
            rawScore: 40,
            maxScore: 40,
            scorePercent: 100,
            totalSteps: 4,
            completedSteps: 4
        });
    });
});
