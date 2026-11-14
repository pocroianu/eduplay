module.exports = {
  sceneKey: 'CategorizeLevel',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('CategorizeLevel');
      const item = scene?.draggableItems?.[0];
      return !!item && !!scene?.dropZones?.some?.((zone) => zone?.categoryId === item.categoryId);
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('CategorizeLevel');
      const item = scene.draggableItems[0];
      const zone = scene.dropZones.find((candidate) => candidate.categoryId === item.categoryId);
      scene.onCorrectDrop(item, zone);
    });
  },
};
