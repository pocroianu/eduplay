import { test, expect, type Page } from '@playwright/test';
import { buildActivityLaunchUrl } from '../../utils/activity-url';

type ScreenCard = {
  index: number;
  pairId: string;
  screenX: number;
  screenY: number;
};

type CardSelection = {
  first: ScreenCard;
  second: ScreenCard;
};

type MatchingPair = CardSelection & {
  pairId: string;
};

type MemoryRuntimeState = {
  selectedStates: string[];
  score: number;
  totalSteps: number;
  completedSteps: number;
  maxScore: number;
  scorePercent: number;
  isComplete: boolean;
  activeSceneKeys: string[];
};

async function launchRomanianMemoryActivity(page: Page): Promise<void> {
  await page.goto(buildActivityLaunchUrl({ templateId: 'memory-game', activityId: 'animals-memory-01', lang: 'ro' }));
  await waitForMemoryLevel(page);
}

async function waitForMemoryLevel(page: Page): Promise<void> {
  await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 });
  await page.waitForFunction(
    () => {
      const game = (window as any).__PHASER_GAME__;
      const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];
      return activeSceneKeys.includes('MemoryLevel');
    },
    { timeout: 15000 }
  );
}

async function discoverReadyScreenCards(page: Page): Promise<ScreenCard[]> {
  return page.evaluate(() => {
    const game = (window as any).__PHASER_GAME__;
    const level = game?.scene?.getScene('MemoryLevel');
    const canvas = game?.canvas as HTMLCanvasElement | undefined;
    const cards: any[] = level?.cards ?? [];
    if (!game || !level || !canvas || cards.length < 2) return [];

    const gameWidth = Number(game.config.width) || level.scale.width;
    const gameHeight = Number(game.config.height) || level.scale.height;
    const rect = canvas.getBoundingClientRect();

    return cards.flatMap((card, index) => {
      const pairId = card?.getPairId?.() ?? card?.pairId;
      const matrix = card?.getWorldTransformMatrix?.();
      const gameX = Number.isFinite(matrix?.tx) ? matrix.tx : card?.x;
      const gameY = Number.isFinite(matrix?.ty) ? matrix.ty : card?.y;
      const isReady = card?.getCardState?.() === 'faceDown'
        && card?.input?.enabled
        && card?.visible !== false
        && (card?.alpha ?? 1) > 0.95
        && (card?.scaleX ?? 1) > 0.95
        && (card?.scaleY ?? 1) > 0.95;

      if (!pairId || !Number.isFinite(gameX) || !Number.isFinite(gameY) || !isReady) return [];

      return [{
        index,
        pairId,
        screenX: rect.left + gameX * (rect.width / gameWidth),
        screenY: rect.top + gameY * (rect.height / gameHeight),
      }];
    });
  });
}

async function discoverFirstMatchingPair(page: Page): Promise<MatchingPair | null> {
  const cardsByPair = new Map<string, ScreenCard[]>();

  for (const card of await discoverReadyScreenCards(page)) {
    cardsByPair.set(card.pairId, [...(cardsByPair.get(card.pairId) ?? []), card]);
  }

  for (const [pairId, pairCards] of cardsByPair) {
    if (pairCards.length >= 2) {
      return { pairId, first: pairCards[0], second: pairCards[1] };
    }
  }

  return null;
}

async function discoverFirstMismatchedPair(page: Page): Promise<CardSelection | null> {
  const readyCards = await discoverReadyScreenCards(page);
  const first = readyCards[0];
  const second = readyCards.find((card) => card.pairId !== first?.pairId);
  return first && second ? { first, second } : null;
}

async function clickCard(page: Page, card: ScreenCard): Promise<void> {
  await page.mouse.click(card.screenX, card.screenY);
}

async function waitForCardState(page: Page, card: ScreenCard, state: string): Promise<void> {
  await page.waitForFunction(
    ({ index, expectedState }) => {
      const game = (window as any).__PHASER_GAME__;
      const level = game?.scene?.getScene('MemoryLevel');
      return level?.cards?.[index]?.getCardState?.() === expectedState;
    },
    { index: card.index, expectedState: state },
    { timeout: 5000 }
  );
}

async function waitForSelectedCardsMatched(page: Page, pair: MatchingPair): Promise<void> {
  await page.waitForFunction(
    ({ firstIndex, secondIndex }) => {
      const gm = (window as any).__GAME_MANAGER__;
      const game = (window as any).__PHASER_GAME__;
      const level = game?.scene?.getScene('MemoryLevel');
      const cards = level?.cards ?? [];
      return cards[firstIndex]?.getCardState?.() === 'matched'
        && cards[secondIndex]?.getCardState?.() === 'matched'
        && gm?.getScore?.() === 10
        && gm?.getTotalSteps?.() === 6
        && gm?.getCompletedSteps?.() === 1
        && gm?.getMaxScore?.() === 60
        && gm?.getScorePercent?.() === 17
        && gm?.isGameComplete?.() === false;
    },
    { firstIndex: pair.first.index, secondIndex: pair.second.index },
    { timeout: 10000 }
  );
}

async function waitForSelectedCardsFaceDown(page: Page, pair: CardSelection): Promise<void> {
  await page.waitForFunction(
    ({ firstIndex, secondIndex }) => {
      const game = (window as any).__PHASER_GAME__;
      const level = game?.scene?.getScene('MemoryLevel');
      const cards = level?.cards ?? [];
      return cards[firstIndex]?.getCardState?.() === 'faceDown'
        && cards[secondIndex]?.getCardState?.() === 'faceDown';
    },
    { firstIndex: pair.first.index, secondIndex: pair.second.index },
    { timeout: 10000 }
  );
}

async function getMemoryRuntimeState(page: Page, pair: CardSelection): Promise<MemoryRuntimeState> {
  return page.evaluate(({ firstIndex, secondIndex }) => {
    const gm = (window as any).__GAME_MANAGER__;
    const game = (window as any).__PHASER_GAME__;
    const level = game?.scene?.getScene('MemoryLevel');
    const cards = level?.cards ?? [];
    const activeSceneKeys = game?.scene?.getScenes(true).map((scene: any) => scene.scene.key) ?? [];

    return {
      selectedStates: [cards[firstIndex]?.getCardState?.(), cards[secondIndex]?.getCardState?.()],
      score: gm?.getScore?.() ?? -1,
      totalSteps: gm?.getTotalSteps?.() ?? -1,
      completedSteps: gm?.getCompletedSteps?.() ?? -1,
      maxScore: gm?.getMaxScore?.() ?? -1,
      scorePercent: gm?.getScorePercent?.() ?? -1,
      isComplete: gm?.isGameComplete?.() ?? true,
      activeSceneKeys,
    };
  }, { firstIndex: pair.first.index, secondIndex: pair.second.index });
}

test.describe('Memory Game — animals-memory-01 card interactions', () => {
  test('matching the first discovered pair adds points without completing the game', async ({ page }) => {
    await launchRomanianMemoryActivity(page);

    await expect.poll(() => discoverFirstMatchingPair(page), { timeout: 5000 }).not.toBeNull();
    const pair = await discoverFirstMatchingPair(page);
    if (!pair) {
      throw new Error('Could not discover a matching memory-card pair');
    }

    await clickCard(page, pair.first);
    await waitForCardState(page, pair.first, 'faceUp');
    await clickCard(page, pair.second);
    await waitForSelectedCardsMatched(page, pair);

    const afterMatch = await getMemoryRuntimeState(page, pair);
    expect(afterMatch.selectedStates).toEqual(['matched', 'matched']);
    expect(afterMatch.score).toBe(10);
    expect(afterMatch.totalSteps).toBe(6);
    expect(afterMatch.completedSteps).toBe(1);
    expect(afterMatch.maxScore).toBe(60);
    expect(afterMatch.scorePercent).toBe(17);
    expect(afterMatch.isComplete).toBe(false);
    expect(afterMatch.activeSceneKeys).toContain('MemoryLevel');
    expect(afterMatch.activeSceneKeys).not.toContain('Results');
  });

  test('mismatching the first discovered different pair flips both cards back without scoring', async ({ page }) => {
    await launchRomanianMemoryActivity(page);

    await expect.poll(() => discoverFirstMismatchedPair(page), { timeout: 5000 }).not.toBeNull();
    const pair = await discoverFirstMismatchedPair(page);
    if (!pair) {
      throw new Error('Could not discover two different memory-card pairs');
    }

    await clickCard(page, pair.first);
    await waitForCardState(page, pair.first, 'faceUp');
    await clickCard(page, pair.second);
    await waitForSelectedCardsFaceDown(page, pair);

    const afterMismatch = await getMemoryRuntimeState(page, pair);
    expect(afterMismatch.selectedStates).toEqual(['faceDown', 'faceDown']);
    expect(afterMismatch.score).toBe(0);
    expect(afterMismatch.totalSteps).toBe(6);
    expect(afterMismatch.completedSteps).toBe(0);
    expect(afterMismatch.maxScore).toBe(60);
    expect(afterMismatch.scorePercent).toBe(0);
    expect(afterMismatch.isComplete).toBe(false);
    expect(afterMismatch.activeSceneKeys).toContain('MemoryLevel');
    expect(afterMismatch.activeSceneKeys).not.toContain('Results');
  });
});
