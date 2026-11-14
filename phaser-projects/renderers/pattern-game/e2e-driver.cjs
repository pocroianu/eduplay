module.exports = {
  sceneKey: 'PatternLevel',
  lang: 'ro',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('PatternLevel');
      const gap = scene?.gaps?.[0];
      return !!gap && !!scene?.trayTiles?.some?.((tile) => tile?.tileKey === gap.expectedTileKey);
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('PatternLevel');
      const gap = scene.gaps[0];
      const tile = scene.trayTiles.find((candidate) => candidate.tileKey === gap.expectedTileKey);
      scene.onCorrectDrop(tile, gap);
    });
  },
};
