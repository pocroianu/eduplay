module.exports = {
  sceneKey: 'SequenceLevel',
  lang: 'ro',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('SequenceLevel');
      return !!scene?.padsById?.size && Array.isArray(scene?.currentSequence) && scene.phase === 'awaiting-input';
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('SequenceLevel');
      for (const padId of scene.currentSequence) {
        scene.onPadPressed(scene.padsById.get(padId));
      }
    });
  },
};
