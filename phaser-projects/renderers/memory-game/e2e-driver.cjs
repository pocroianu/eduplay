module.exports = {
  sceneKey: 'MemoryLevel',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('MemoryLevel');
      return !!scene?.cards?.length;
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(async () => {
      const scene = window.__PHASER_GAME__.scene.getScene('MemoryLevel');
      const first = scene.cards[0];
      const second = scene.cards.find((candidate) => candidate !== first && candidate.getPairId() === first.getPairId());
      await scene.onCardClicked(first);
      await scene.onCardClicked(second);
    });
  },
};
