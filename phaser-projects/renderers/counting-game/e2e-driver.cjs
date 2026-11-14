module.exports = {
  sceneKey: 'CountingLevel',
  lang: 'ro',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('CountingLevel');
      return !!scene?.rounds?.[scene.roundIndex];
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('CountingLevel');
      scene.onCorrectNumeral(scene.rounds[scene.roundIndex].count);
    });
  },
};
