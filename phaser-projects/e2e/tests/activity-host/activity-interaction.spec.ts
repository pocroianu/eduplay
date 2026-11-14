import { test, expect, type Page } from '@playwright/test';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

interface RendererInteractionDriver {
  rendererId: string;
  activityId: string;
  sceneKey: string;
  lang?: string;
  waitUntilReady(page: Page): Promise<void>;
  completeOneInteraction(page: Page): Promise<void>;
}

interface RendererMetadata {
  rendererId: string;
  defaultGameId: string;
}

const requireDriver = createRequire(__filename);
const RENDERERS_DIR = join(process.cwd(), 'renderers');
const DRIVER_FILENAME = 'e2e-driver.cjs';
const SCRIPTED_INTERACTIONS = discoverRendererInteractionDrivers();

test.describe('single-host Activity renderer interactions', () => {
  for (const interaction of SCRIPTED_INTERACTIONS) {
    test(`${interaction.rendererId} can complete one learner interaction through /activities`, async ({ page }) => {
      await loadActivity(page, interaction);

      const before = await readRuntimeState(page);
      expect(before.completedSteps).toBe(0);
      expect(before.score).toBe(0);

      await interaction.completeOneInteraction(page);

      await page.waitForFunction(
        () => {
          const gm = (window as any).__GAME_MANAGER__;
          return (gm?.getCompletedSteps?.() ?? 0) > 0 || (gm?.getScore?.() ?? 0) > 0;
        },
        { timeout: 20000 }
      );

      const after = await readRuntimeState(page);
      expect(after.completedSteps > before.completedSteps || after.score > before.score).toBe(true);
    });
  }
});

function discoverRendererInteractionDrivers(): RendererInteractionDriver[] {
  return readdirSync(RENDERERS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => {
      const rendererDir = join(RENDERERS_DIR, entry.name);
      const metadataPath = join(rendererDir, 'renderer.json');
      const driverPath = join(rendererDir, DRIVER_FILENAME);

      if (!existsSync(metadataPath)) {
        return [];
      }

      if (!existsSync(driverPath)) {
        throw new Error(`${entry.name} has renderer.json but no ${DRIVER_FILENAME}`);
      }

      const metadata = JSON.parse(readFileSync(metadataPath, 'utf8')) as RendererMetadata;
      const driverModule = requireDriver(driverPath);
      const driver = driverModule.default ?? driverModule;

      assertRendererDriver(metadata, driver, driverPath);

      return [{
        ...driver,
        rendererId: metadata.rendererId,
        activityId: driver.activityId ?? metadata.defaultGameId,
      }];
    })
    .sort((a, b) => a.rendererId.localeCompare(b.rendererId));
}

function assertRendererDriver(
  metadata: RendererMetadata,
  driver: Partial<RendererInteractionDriver>,
  driverPath: string
): asserts driver is Omit<RendererInteractionDriver, 'rendererId' | 'activityId'> & { activityId?: string } {
  if (!metadata.rendererId || !metadata.defaultGameId) {
    throw new Error(`${driverPath} has invalid renderer metadata`);
  }

  if (!driver.sceneKey) {
    throw new Error(`${driverPath} must export sceneKey`);
  }

  if (typeof driver.waitUntilReady !== 'function') {
    throw new Error(`${driverPath} must export waitUntilReady(page)`);
  }

  if (typeof driver.completeOneInteraction !== 'function') {
    throw new Error(`${driverPath} must export completeOneInteraction(page)`);
  }
}

async function loadActivity(page: Page, interaction: RendererInteractionDriver): Promise<void> {
  const searchParams = new URLSearchParams();
  if (interaction.lang) {
    searchParams.set('lang', interaction.lang);
  }

  const query = searchParams.toString();
  await page.goto(`/activities/${interaction.activityId}${query ? `?${query}` : ''}`);
  await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
  await page.waitForFunction(
    (sceneKey) => {
      const game = (window as any).__PHASER_GAME__;
      const gm = (window as any).__GAME_MANAGER__;
      return !!gm?.getConfig?.() && !!game?.scene?.getScene(sceneKey);
    },
    interaction.sceneKey,
    { timeout: 20000 }
  );
  await interaction.waitUntilReady(page);
}

async function readRuntimeState(page: Page): Promise<{ score: number; completedSteps: number }> {
  return page.evaluate(() => {
    const gm = (window as any).__GAME_MANAGER__;
    return {
      score: gm?.getScore?.() ?? 0,
      completedSteps: gm?.getCompletedSteps?.() ?? 0,
    };
  });
}
