module.exports = {
  sceneKey: 'Level',

  async waitUntilReady(page) {
    await page.waitForFunction(() => {
      const scene = window.__PHASER_GAME__?.scene?.getScene('Level');
      return !!scene?.choiceCards?.some?.((card) => card?.choice);
    }, { timeout: 20000 });
  },

  async completeOneInteraction(page) {
    await page.evaluate(() => {
      const scene = window.__PHASER_GAME__.scene.getScene('Level');
      const card = scene.choiceCards.find((candidate) => candidate.isCorrect?.() || candidate.choice?.isCorrect);
      scene.onChoiceSelected({
        card,
        choice: card.choice,
        index: card.cardIndex,
        isCorrect: true,
      });
    });
  },
};
