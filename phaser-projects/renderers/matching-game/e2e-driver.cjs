module.exports = {
  sceneKey: 'MatchLevel',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('MatchLevel');
      return !!scene?.matchCards?.length && !!scene?.wordCards?.length;
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('MatchLevel');
      const matchCard = scene.matchCards[0];
      const wordCard = scene.wordCards.find((candidate) => candidate.pairId === matchCard.pairId);
      scene.onMatchCardSelected(matchCard);
      scene.onWordCardSelected(wordCard);
    });
  },
};
