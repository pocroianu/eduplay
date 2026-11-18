import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Automated accessibility scan of public (no-auth) pages. Fails on serious or
 * critical WCAG 2.x A/AA violations; minor/moderate ones are logged only.
 */
const PUBLIC_PAGES = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
];

for (const { name, path } of PUBLIC_PAGES) {
  test(`${name} page has no serious or critical axe violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();

    const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    const summary = blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s) - ${v.help}`);
    expect(blocking, summary.join('\n')).toEqual([]);
  });
}
