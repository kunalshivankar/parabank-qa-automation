import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect, test as base, type Page } from '@playwright/test';
import { renderReport } from '../../reporters/template';
import { buildSampleReportData } from '../support/sampleReportData';

const ACCENT_RGB = 'rgb(244, 128, 49)';

const test = base.extend<{ pageProblems: string[] }>({
  pageProblems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') problems.push(`console: ${message.text()}`);
      });
      await use(problems);
      expect(problems, 'the report must load without script or console errors').toEqual([]);
    },
    { auto: true },
  ],
});

function parseRgb(color: string): { r: number; g: number; b: number; a: number } {
  const match = /rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/.exec(color);
  if (!match) {
    throw new Error(`Unrecognised colour: ${color}`);
  }
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]), a: match[4] === undefined ? 1 : Number(match[4]) };
}

function luminance(color: string): number {
  const { r, g, b } = parseRgb(color);
  const channel = (value: number): number => {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : ((scaled + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(foreground: string, background: string): number {
  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a) as [number, number];
  return (lighter + 0.05) / (darker + 0.05);
}

async function openSampleReport(page: Page, outputDir: string, hash = ''): Promise<void> {
  await mkdir(outputDir, { recursive: true });
  const file = path.join(outputDir, 'sample-report.html');
  await writeFile(file, renderReport(buildSampleReportData()), 'utf8');
  await page.goto(`${pathToFileURL(file).href}${hash}`);
}

test.describe('custom report styling (computed styles in a real browser)', () => {
  test('summary cards are translucent, blurred and layered over the backdrop', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));
    const cards = page.locator('#panel-summary .card.glass');
    await expect(cards).not.toHaveCount(0);

    const styles = await cards.evaluateAll((elements) =>
      elements.map((element) => {
        const style = getComputedStyle(element);
        return {
          label: element.getAttribute('data-card'),
          backdropFilter: style.backdropFilter || style.getPropertyValue('-webkit-backdrop-filter'),
          backgroundColor: style.backgroundColor,
          borderTopWidth: style.borderTopWidth,
          borderTopColor: style.borderTopColor,
          boxShadow: style.boxShadow,
          borderRadius: style.borderTopLeftRadius,
        };
      }),
    );

    for (const card of styles) {
      expect(card.backdropFilter, `${card.label}: background blur`).toContain('blur(18px)');
      const background = parseRgb(card.backgroundColor);
      expect(background.a, `${card.label}: translucent fill`).toBeGreaterThan(0);
      expect(background.a, `${card.label}: translucent fill`).toBeLessThan(0.3);
      expect(parseRgb(card.borderTopColor).a, `${card.label}: translucent edge`).toBeLessThan(0.5);
      expect(card.borderTopWidth, `${card.label}: edge`).toBe('1px');
      expect(card.boxShadow, `${card.label}: depth`).not.toBe('none');
      expect(parseFloat(card.borderRadius), `${card.label}: rounded`).toBeGreaterThanOrEqual(16);
    }

    const layering = await page.evaluate(() => {
      const backdrop = document.querySelector('.backdrop') as HTMLElement;
      const app = document.querySelector('.app') as HTMLElement;
      const orbs = [...document.querySelectorAll('.orb')] as HTMLElement[];
      const cardRects = [...document.querySelectorAll('#panel-summary .card.glass')].map((card) => card.getBoundingClientRect());
      const overlapping = orbs.filter((orb) => {
        const orbRect = orb.getBoundingClientRect();
        return cardRects.some(
          (rect) => rect.left < orbRect.right && rect.right > orbRect.left && rect.top < orbRect.bottom && rect.bottom > orbRect.top,
        );
      });
      return {
        backdropZ: Number(getComputedStyle(backdrop).zIndex),
        appZ: Number(getComputedStyle(app).zIndex),
        orbCount: orbs.length,
        orbsBehindCards: overlapping.length,
        orbFilter: getComputedStyle(orbs[0] as HTMLElement).filter,
      };
    });
    expect(layering.appZ, 'content layer sits above the backdrop layer').toBeGreaterThan(layering.backdropZ);
    expect(layering.orbCount).toBeGreaterThanOrEqual(3);
    expect(layering.orbsBehindCards, 'glass cards overlap decorative shapes so the blur has something to blur').toBeGreaterThanOrEqual(2);
    expect(layering.orbFilter).toContain('blur');
  });

  test('the backdrop blur changes what is rendered behind a card', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));
    const card = page.locator('#panel-summary [data-card="pass rate"]');
    const withBlur = await card.screenshot();

    await page.addStyleTag({
      content: '.glass, .glass-inset { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; }',
    });
    const withoutBlur = await card.screenshot();

    expect(withBlur.equals(withoutBlur), 'disabling backdrop-filter must alter the rendered card').toBe(false);
  });

  test('accent colour is applied to headings, the active tab and passing indicators', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));

    await expect(page.locator('h1')).toHaveCSS('color', ACCENT_RGB);
    const cardHeadings = page.locator('#panel-summary .card h3');
    await expect(cardHeadings).not.toHaveCount(0);
    for (const heading of await cardHeadings.all()) {
      await expect(heading).toHaveCSS('color', ACCENT_RGB);
    }

    const activeTab = page.getByRole('tab', { selected: true });
    await expect(activeTab).toHaveText('Summary');
    await expect(activeTab).toHaveCSS('background-color', ACCENT_RGB);

    await expect(page.locator('#panel-summary .stat-value[data-status="passed"]')).toHaveCSS('color', ACCENT_RGB);
    await expect(page.locator('#panel-summary .bar .seg[data-status="passed"]')).toHaveCSS('background-color', ACCENT_RGB);

    await page.getByRole('tab', { name: /^Tests/ }).click();
    const passedRow = page.locator('#panel-tests .test[data-status="passed"]').first();
    await expect(passedRow.locator('.dot')).toHaveCSS('background-color', ACCENT_RGB);
    await expect(passedRow.locator('.status')).toHaveCSS('color', ACCENT_RGB);
  });

  test('the active tab follows the selection', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));
    const summary = page.getByRole('tab', { name: 'Summary' });
    const tests = page.getByRole('tab', { name: /^Tests/ });

    await tests.click();
    await expect(tests).toHaveAttribute('aria-selected', 'true');
    await expect(tests).toHaveCSS('background-color', ACCENT_RGB);
    await expect(summary).toHaveAttribute('aria-selected', 'false');
    await expect(summary).not.toHaveCSS('background-color', ACCENT_RGB);
    await expect(page.locator('#panel-tests')).toBeVisible();
    await expect(page.locator('#panel-summary')).toBeHidden();
  });

  test('accent colour is used only for headings, the active tab and passing indicators', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));

    const offenders = await page.evaluate((accent) => {
      const properties = ['color', 'backgroundColor', 'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor', 'outlineColor'] as const;
      const found: string[] = [];
      for (const element of document.querySelectorAll('body, body *')) {
        const style = getComputedStyle(element);
        const usesAccent = properties.some((property) => style[property] === accent);
        if (!usesAccent) continue;

        const isHeading = /^H[1-3]$/.test(element.tagName);
        const isActiveTab = element.matches('[role="tab"][aria-selected="true"]');
        const isPassIndicator = element.matches('[data-status="passed"]') || element.closest('[data-status="passed"]') !== null;
        if (!isHeading && !isActiveTab && !isPassIndicator) {
          found.push(`${element.tagName.toLowerCase()}.${element.className} (${element.textContent?.trim().slice(0, 30)})`);
        }
      }
      return found;
    }, ACCENT_RGB);

    expect(offenders, 'elements using the accent outside the three permitted roles').toEqual([]);
  });

  test('failing, flaky and skipped states never use the accent colour', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));
    for (const status of ['failed', 'flaky', 'skipped']) {
      const dots = page.locator(`.dot[data-status="${status}"]`);
      await expect(dots.first()).not.toHaveCSS('background-color', ACCENT_RGB);
      const label = page.locator(`.status[data-status="${status}"]`).first();
      await expect(label).not.toHaveCSS('color', ACCENT_RGB);
    }
  });

  test('text on the accent-filled tab is readable', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));
    const activeTab = page.getByRole('tab', { selected: true });
    const colors = await activeTab.evaluate((element) => {
      const style = getComputedStyle(element);
      return { color: style.color, backgroundColor: style.backgroundColor };
    });
    expect(contrastRatio(colors.color, colors.backgroundColor)).toBeGreaterThanOrEqual(4.5);
  });

  test('status filter, search and failures tab behave correctly', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'));
    await page.getByRole('tab', { name: /^Tests/ }).click();

    const visibleRows = page.locator('#panel-tests .test:visible');
    await expect(visibleRows).toHaveCount(5);

    await page.getByRole('button', { name: /^Failed/ }).click();
    await expect(visibleRows).toHaveCount(1);
    await expect(visibleRows.first()).toContainText('loan request is approved');

    await page.getByRole('button', { name: /^All/ }).click();
    await page.getByRole('searchbox', { name: 'Search tests' }).fill('dropdown');
    await expect(visibleRows).toHaveCount(1);
    await expect(visibleRows.first()).toContainText('dropdown lists the new account');

    await page.getByRole('searchbox', { name: 'Search tests' }).fill('no such test');
    await expect(visibleRows).toHaveCount(0);
    await expect(page.locator('#tests-empty')).toBeVisible();

    await page.getByRole('tab', { name: /^Failures/ }).click();
    const failureRows = page.locator('#panel-failures .test');
    await expect(failureRows).toHaveCount(2);
    await expect(failureRows.first().locator('img')).toBeVisible();
    await expect(failureRows.first()).toContainText('Expected: "Approved"');
  });

  test('tabs support keyboard navigation and deep links', async ({ page }, testInfo) => {
    await openSampleReport(page, testInfo.outputPath('report'), '#failures');
    await expect(page.getByRole('tab', { name: /^Failures/ })).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#panel-failures')).toBeVisible();

    await page.getByRole('tab', { name: /^Failures/ }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: /^Tests/ })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: 'Summary' })).toHaveAttribute('aria-selected', 'true');
  });

  test('the layout fits a phone-width viewport without horizontal scrolling', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSampleReport(page, testInfo.outputPath('report'));
    for (const tab of ['Summary', 'Tests', 'Failures']) {
      await page.getByRole('tab', { name: new RegExp(`^${tab}`) }).click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `${tab} tab overflows horizontally by ${overflow}px`).toBeLessThanOrEqual(0);
    }
  });

  test('captures screenshots of each tab for visual review', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openSampleReport(page, testInfo.outputPath('report'));
    for (const tab of ['Summary', 'Tests', 'Failures']) {
      const tabButton = page.getByRole('tab', { name: new RegExp(`^${tab}`) });
      await tabButton.click();
      await expect(tabButton).toHaveAttribute('aria-selected', 'true');
      await expect(tabButton).toHaveCSS('background-color', ACCENT_RGB);
      await testInfo.attach(`report-${tab.toLowerCase()}`, {
        body: await page.screenshot({ fullPage: true, animations: 'disabled' }),
        contentType: 'image/png',
      });
    }
  });
});
