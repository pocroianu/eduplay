module.exports = {
  sceneKey: 'TracingLevel',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('TracingLevel');
      return !!scene?.activeStroke || !!scene?.itemDisplay;
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('TracingLevel');
      scene.onItemComplete();
    });
  },
};
