import { describe, expect, it } from 'vitest';
import { TemplateTextProvider } from '../TemplateTextProvider';

describe('TemplateTextProvider', () => {
  it('generates deterministic identification questions without an external service', async () => {
    const provider = new TemplateTextProvider();
    await provider.init();

    const result = await provider.generate({
      prompt: 'Generate a simple question for children aged 3-8 to identify a fruit. Use the format: "Which one is [the/a] fruit?" Keep it under 10 words.'
    });

    expect(result.data.text).toBe('Which one is the fruit?');
    expect(result.provider).toBe('template-text');
  });

  it('generates deterministic feedback text', async () => {
    const provider = new TemplateTextProvider();
    await provider.init();

    await expect(provider.generate({
      prompt: 'Write specific positive feedback acknowledging the child found the correct apple. Be warm and encouraging. 6-10 words.'
    })).resolves.toMatchObject({
      data: { text: 'Great job finding the apple!' }
    });

    await expect(provider.generate({
      prompt: 'Generate gentle, encouraging feedback for an incorrect answer. Be supportive, suggest trying again.'
    })).resolves.toMatchObject({
      data: { text: 'Not quite, try again!' }
    });
  });
});
