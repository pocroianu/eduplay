module.exports = {
  sceneKey: 'SequenceLevel',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('SequenceLevel');
      return !!scene?.orderableItems?.length;
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('SequenceLevel');
      scene.orderableItems.forEach((item) => {
        item.slotIndex = item.correctPosition - 1;
      });
      scene.onSequenceCorrect();
    });
  },
};
