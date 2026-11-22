import { test, expect } from '@playwright/test';

// Mock user data
const mockUser = {
  id: 1,
  name: 'Playwright Tester',
  email: 'tester@playwright.com',
  daily_calorie_goal: 2000,
  height_cm: 180,
  weight_kg: 75,
  gender: 'male',
  age: 30,
  macro_protein_g: 150,
  macro_carbs_g: 200,
  macro_fat_g: 65,
  created_at: new Date().toISOString()
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';

// Mock daily summary data
const mockDailySummary = {
  success: true,
  data: {
    date: new Date().toISOString().split('T')[0],
    total_calories: 450,
    total_protein: 30,
    total_carbs: 40,
    total_fat: 15,
    calorie_goal: 2000,
    meals: [
      {
        id: 1,
        title: 'ארוחת בוקר וירטואלית',
        meal_type: 'breakfast',
        total_calories: 450,
        total_protein: 30,
        total_carbs: 40,
        total_fat: 15,
        created_at: new Date().toISOString()
      }
    ],
    activities: []
  }
};

test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [
          { name: 'ct_token', value: 'fake-jwt-token-for-testing' },
          { name: 'ct_user', value: JSON.stringify(mockUser) }
        ]
      }
    ]
  }
});

test.describe('Dashboard Features (Mocked Auth)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock API responses so the frontend doesn't get a 401 Unauthorized from the real backend
    await page.route('**/api/auth/me', route => 
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );

    await page.route('**/api/dashboard/daily*', route => 
      route.fulfill({ status: 200, json: mockDailySummary })
    );

    await page.route('**/api/insights/yesterday*', route => 
      route.fulfill({ status: 200, json: { status: 'success', data: { insight: null } } })
    );

    await page.route('**/api/insights/day*', route =>
      route.fulfill({ status: 200, json: { status: 'success', data: { insight: null } } })
    );

    // Navigate to dashboard
    await page.goto('/dashboard');
  });

  test('should display user name and dashboard elements', async ({ page }) => {
    // Wait for the UI to load
    await expect(page.getByText('Playwright Tester').first()).toBeVisible();
    
    // Check if the mock meal title is displayed
    await expect(page.getByText('ארוחת בוקר וירטואלית').first()).toBeVisible();
  });

  test('should support Bento Hero stats, Meal Slot filter pills, and Light/Dark theme toggle', async ({ page }) => {
    await expect(page.locator('.bento-hero')).toBeVisible();
    await expect(page.locator('.meal-slot-pills')).toBeVisible();

    // Filter by lunch (should hide breakfast meal)
    await page.locator('.slot-pill', { hasText: 'צהריים' }).click();
    await expect(page.getByText('ארוחת בוקר וירטואלית')).toHaveCount(0);

    // Filter back to all
    await page.locator('.slot-pill', { hasText: 'הכל' }).click();
    await expect(page.getByText('ארוחת בוקר וירטואלית').first()).toBeVisible();

    // Toggle theme to light mode via navbar toggle
    const themeToggle = page.locator('#navbar-theme-toggle');
    if (await themeToggle.isVisible()) {
      await themeToggle.click();
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    }

    // Verify Date Switcher moves 1 day back ("אתמול") and 1 day forward ("היום")
    await expect(page.locator('#today-day-btn')).toHaveText('היום');
    await expect(page.locator('#next-day-btn')).toBeDisabled();

    await page.locator('#prev-day-btn').click();
    await expect(page.locator('#today-day-btn')).toHaveText('אתמול');
    await expect(page.locator('#next-day-btn')).toBeEnabled();

    await page.locator('#next-day-btn').click();
    await expect(page.locator('#today-day-btn')).toHaveText('היום');
    await expect(page.locator('#next-day-btn')).toBeDisabled();

    // Verify Hydration Tracker Card (+250ml and +500ml)
    await expect(page.locator('#hydration-tracker-card')).toBeVisible();
    await expect(page.locator('#hydration-total-ml')).toHaveText('0');
    await page.locator('#water-add-250-btn').click();
    await expect(page.locator('#hydration-total-ml')).toHaveText('250');
    await page.locator('#water-add-500-btn').click();
    await expect(page.locator('#hydration-total-ml')).toHaveText('750');

    // Verify PWA manifest link is present
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    expect(manifestHref).toContain('manifest.webmanifest');
  });

  test('should show Add-to-Home-Screen recommendation and allow customizing glass & bottle sizes', async ({ page }) => {
    // PWA banner: show instructions, then dismiss (persisted)
    await expect(page.locator('#pwa-install-banner')).toBeVisible();
    await page.locator('#pwa-install-action-btn').click();
    await expect(page.locator('#pwa-install-instructions')).toBeVisible();
    await page.locator('#pwa-install-dismiss-btn').click();
    await expect(page.locator('#pwa-install-banner')).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#hydration-tracker-card')).toBeVisible();
    await expect(page.locator('#pwa-install-banner')).toHaveCount(0);

    // Customize glass (330ml) and bottle (1000ml)
    await page.locator('#water-customize-toggle-btn').click();
    await expect(page.locator('#water-settings-drawer')).toBeVisible();
    await page.locator('#water-custom-glass-input').fill('330');
    await page.locator('.hydration-preset-chip', { hasText: '1000' }).click();
    await page.locator('#water-save-settings-btn').click();
    await expect(page.locator('#water-settings-drawer')).toHaveCount(0);

    await expect(page.locator('#water-add-250-btn')).toContainText('330');
    await expect(page.locator('#water-add-500-btn')).toContainText('1000');

    await page.locator('#water-add-250-btn').click();
    await expect(page.locator('#hydration-total-ml')).toHaveText('330');
    await page.locator('#water-add-500-btn').click();
    await expect(page.locator('#hydration-total-ml')).toHaveText('1330');

    // Sizes persist after reload
    await page.reload();
    await expect(page.locator('#water-add-250-btn')).toContainText('330');
    await expect(page.locator('#water-add-500-btn')).toContainText('1000');
  });

  test('should be fully responsive with zero horizontal overflow across iPhone SE, iPhone Pro Max, Tablet, and Desktop', async ({ page }) => {
    await page.route('**/api/meals/history*', route =>
      route.fulfill({ status: 200, json: { success: true, data: mockDailySummary.data.meals } })
    );
    await page.route('**/api/meals/favorites*', route =>
      route.fulfill({ status: 200, json: { success: true, data: mockDailySummary.data.meals } })
    );
    await page.route('**/api/weight*', route =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            logs: [],
            coach: {
              status: 'insufficient_data',
              currentWeight: 75,
              weightDeltaKg: 0,
              daysTracked: 0,
              avgDailyIntake: 2000,
              estimatedTdee: null,
              recommendedGoal: null,
              currentGoal: 2000,
              message: 'רישום משקל יומי'
            }
          }
        }
      })
    );
    await page.route('**/api/water*', route =>
      route.fulfill({ status: 200, json: { success: true, data: { date: '2026-04-20', total_ml: 500, cups: 2, goal_ml: 2000, logs: [] } } })
    );

    const viewports = [
      { name: 'iPhone SE', width: 375, height: 667 },
      { name: 'iPhone 16 Pro Max', width: 430, height: 932 },
      { name: 'iPad Tablet', width: 768, height: 1024 },
      { name: 'Desktop', width: 1280, height: 800 }
    ];

    const routes = ['/dashboard', '/add-meal', '/history', '/profile', '/add-activity'];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of routes) {
        await page.goto(route);
        await page.waitForTimeout(150);

        const dimensions = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
          bodyScrollWidth: document.body.scrollWidth
        }));

        expect(
          dimensions.scrollWidth,
          `Horizontal overflow on ${vp.name} (${vp.width}px) at ${route}: scrollWidth=${dimensions.scrollWidth}, clientWidth=${dimensions.clientWidth}`
        ).toBeLessThanOrEqual(dimensions.clientWidth);
      }
    }
  });
});

function localDateStr(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

test.describe('Viewed-day logging, more activities & per-day insights', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );
    await page.route('**/api/dashboard/daily*', route =>
      route.fulfill({ status: 200, json: mockDailySummary })
    );
    await page.route('**/api/meals/favorites*', route =>
      route.fulfill({ status: 200, json: { success: true, data: [] } })
    );
    await page.route('**/api/meals/history*', route =>
      route.fulfill({ status: 200, json: { success: true, data: { meals: [], pagination: { page: 1, limit: 20, total: 0, pages: 0 } } } })
    );
    await page.route('**/api/water*', route =>
      route.fulfill({ status: 200, json: { success: true, data: { date: localDateStr(), total_ml: 0, goal_ml: 2500, glass_ml: 250, bottle_ml: 500, glasses_count: 0, goal_glasses: 10, percentage: 0 } } })
    );
  });

  test('adding a meal/activity while viewing yesterday targets yesterday and returns to that day', async ({ page }) => {
    await page.route('**/api/insights/day*', route =>
      route.fulfill({ status: 200, json: { status: 'success', data: { insight: null } } })
    );
    const yesterday = localDateStr(-1);
    await page.goto('/dashboard');
    await page.locator('#prev-day-btn').click();
    await expect(page.locator('#today-day-btn')).toHaveText('אתמול');

    // Dashboard "new meal" pill carries the viewed date
    await page.locator('#quick-add-meal-link').click();
    await expect(page).toHaveURL(new RegExp(`/add-meal\\?.*date=${yesterday}`));
    await expect(page.getByText(`עבור ${yesterday}`)).toBeVisible();

    // Back to the dashboard on the same day via ?date=
    await page.goto(`/dashboard?date=${yesterday}`);
    await expect(page.locator('#today-day-btn')).toHaveText('אתמול');

    // Activity logger: back link returns to the viewed dashboard day; new sport categories exist
    await page.goto(`/add-activity?date=${yesterday}&from=dashboard`);
    await page.locator('.mode-tab').nth(1).click();
    for (const name of ['יוגה', 'פילאטיס', 'קפיצה בחבל']) {
      await expect(page.getByText(name, { exact: true }).first()).toBeVisible();
    }
    await page.locator('.back-btn').click();
    await expect(page).toHaveURL(new RegExp(`/dashboard\\?date=${yesterday}`));
    await expect(page.locator('#today-day-btn')).toHaveText('אתמול');
  });

  test('day summary button only for past days and opens that day insight', async ({ page }) => {
    let requestedDate = '';
    await page.route('**/api/insights/day*', route => {
      requestedDate = new URL(route.request().url()).searchParams.get('date') || '';
      const isTwoDaysAgo = requestedDate === localDateStr(-2);
      route.fulfill({
        status: 200,
        json: {
          status: 'success',
          data: { insight: isTwoDaysAgo ? { date: requestedDate, preserve_text: 'שמירה על חלבון', improve_text: 'יותר ירקות' } : null }
        }
      });
    });
    await page.goto('/dashboard');
    await expect(page.locator('#today-day-btn')).toHaveText('היום');
    await expect(page.locator('#day-insight-btn')).toHaveCount(0);

    await page.locator('#prev-day-btn').click();
    await page.locator('#prev-day-btn').click();
    await expect(page.locator('#day-insight-btn')).toBeVisible();
    await page.locator('#day-insight-btn').click();
    await expect(page.locator('.modal-title')).toContainText('סיכום');
    await expect(page.getByText('שמירה על חלבון')).toBeVisible();
    expect(requestedDate).toBe(localDateStr(-2));
  });

  test('yesterday insights pop up automatically on first open of the day only', async ({ page }) => {
    await page.route('**/api/insights/day*', route =>
      route.fulfill({
        status: 200,
        json: { status: 'success', data: { insight: { date: localDateStr(-1), preserve_text: 'כל הכבוד על ההליכה', improve_text: 'שתה יותר' } } }
      })
    );
    await page.goto('/dashboard');
    await expect(page.locator('.modal-title')).toHaveText('💡 סיכום אתמול');
    await expect(page.getByText('כל הכבוד על ההליכה')).toBeVisible();
    await page.locator('.close-btn').click();
    await expect(page.locator('.modal-title')).toHaveCount(0);

    await page.reload();
    await expect(page.locator('#today-day-btn')).toHaveText('היום');
    await page.waitForTimeout(500);
    await expect(page.locator('.modal-title')).toHaveCount(0);
  });
});
