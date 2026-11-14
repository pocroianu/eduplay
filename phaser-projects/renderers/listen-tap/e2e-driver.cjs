module.exports = {
  sceneKey: 'ListenTapLevel',
  lang: 'ro',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('ListenTapLevel');
      return !!scene?.rounds?.[scene.roundIndex] && !!scene?.currentTray?.getTiles?.().length;
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('ListenTapLevel');
      const correct = scene.currentTray.getTiles().find((tile) => tile.correct);
      correct.emit('choice-tile-tapped', correct);
    });
  },
};
