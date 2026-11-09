import { test, expect } from '@playwright/test';

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
  created_at: '2026-06-01T10:00:00.000Z'
};

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';

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

test.describe('Meal History - List & Calendar Views', () => {
  // Pin clock to Wednesday, June 10, 2026 so Sun-Tue are past, Wed is today, and Thu-Sat are future
  const FIXED_NOW = new Date('2026-06-10T12:00:00');

  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: FIXED_NOW });

    let mealsStore = [
      {
        id: 101,
        title: 'שקשוקה ביתית',
        meal_type: 'breakfast',
        total_calories: 420,
        total_protein: 22,
        total_carbs: 18,
        total_fat: 28,
        created_at: '2026-06-10T08:30:00.000Z',
        ingredients: [
          {
            name: 'שקשוקה',
            category: 'protein',
            estimated_grams: 250,
            calories: 420,
            protein_grams: 22,
            carbs_grams: 18,
            fat_grams: 28
          }
        ]
      },
      {
        id: 102,
        title: 'חזה עוף ואורז',
        meal_type: 'lunch',
        total_calories: 650,
        total_protein: 48,
        total_carbs: 70,
        total_fat: 14,
        created_at: '2026-06-08T13:00:00.000Z',
        ingredients: [
          {
            name: 'חזה עוף ואורז',
            category: 'protein',
            estimated_grams: 350,
            calories: 650,
            protein_grams: 48,
            carbs_grams: 70,
            fat_grams: 14
          }
        ]
      }
    ];

    let activitiesStore = [
      {
        id: 201,
        title: 'ריצת בוקר',
        activity_type: 'ריצה',
        duration_minutes: 30,
        calories_burned: 310,
        created_at: '2026-06-08T07:00:00.000Z'
      }
    ];

    await page.route('**/api/auth/me', route =>
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );

    await page.route(/\/api\/meals/, async route => {
      const url = new URL(route.request().url());
      const method = route.request().method();

      // Match /api/meals/:id/favorite and /api/meals/:id/clone
      const pathParts = url.pathname.split('/').filter(Boolean);
      const lastPart = pathParts[pathParts.length - 1];
      const prevPart = pathParts[pathParts.length - 2];

      if ((lastPart === 'favorite' || lastPart === 'clone') && !Number.isNaN(Number(prevPart))) {
        const mealId = Number(prevPart);
        const existing = mealsStore.find(m => m.id === mealId) as any;
        if (!existing) {
          await route.fulfill({ status: 404, json: { success: false, message: 'Not found' } });
          return;
        }

        if (lastPart === 'favorite' && (method === 'PUT' || method === 'PATCH')) {
          const body = route.request().postDataJSON() || {};
          const nextFav = typeof body.is_favorite === 'boolean' ? body.is_favorite : !existing.is_favorite;
          const updated = { ...existing, is_favorite: nextFav };
          mealsStore = mealsStore.map(m => (m.id === mealId ? updated : m));
          await route.fulfill({ status: 200, json: { success: true, data: updated } });
          return;
        }

        if (lastPart === 'clone' && method === 'POST') {
          const body = route.request().postDataJSON() || {};
          const mult = Number(body.multiplier) || 1;
          const createdDate = body.date ? `${body.date}T12:00:00.000Z` : '2026-06-10T12:00:00.000Z';
          const cloned = {
            ...existing,
            id: 777,
            meal_type: body.meal_type || existing.meal_type,
            total_calories: Math.round(existing.total_calories * mult),
            total_protein: Math.round((existing.total_protein || 0) * mult),
            total_carbs: Math.round((existing.total_carbs || 0) * mult),
            total_fat: Math.round((existing.total_fat || 0) * mult),
            created_at: createdDate
          };
          mealsStore = [cloned, ...mealsStore];
          await route.fulfill({ status: 201, json: { success: true, data: cloned } });
          return;
        }
      }

      const maybeId = Number(lastPart);
      if (!Number.isNaN(maybeId) && prevPart === 'meals') {
        if (method === 'PUT') {
          const body = route.request().postDataJSON();
          const existing = mealsStore.find(m => m.id === maybeId)!;
          const ingredients = body.ingredients || existing.ingredients;
          const totalCalories = ingredients.reduce((s: number, i: any) => s + (i.calories || 0), 0);
          const updated = {
            ...existing,
            title: body.title || existing.title,
            meal_type: body.meal_type || existing.meal_type,
            total_calories: totalCalories || existing.total_calories,
            ingredients
          };
          mealsStore = mealsStore.map(m => (m.id === maybeId ? updated : m));
          await route.fulfill({ status: 200, json: { success: true, data: updated } });
          return;
        }
        if (method === 'DELETE') {
          mealsStore = mealsStore.filter(m => m.id !== maybeId);
          await route.fulfill({ status: 200, json: { success: true, message: 'Deleted' } });
          return;
        }
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            data: {
              meals: mealsStore,
              page: 1,
              totalPages: 1
            }
          }
        });
      } else if (method === 'POST') {
        const body = route.request().postDataJSON();
        const createdDate = body.date ? `${body.date}T12:00:00.000Z` : '2026-06-10T12:00:00.000Z';
        const ingredients = body.ingredients || [];
        const totalCalories = ingredients.reduce((s: number, i: any) => s + (i.calories || 0), 0);
        const newMeal = {
          id: 999,
          title: body.title,
          meal_type: body.meal_type || 'lunch',
          total_calories: totalCalories,
          total_protein: 0,
          total_carbs: 0,
          total_fat: 0,
          created_at: createdDate,
          ingredients
        };
        mealsStore = [newMeal, ...mealsStore];
        await route.fulfill({ status: 201, json: { success: true, data: newMeal } });
      } else {
        await route.fallback();
      }
    });

    await page.route(/\/api\/activities/, async route => {
      await route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            activities: activitiesStore
          }
        }
      });
    });

    await page.goto('/history');
  });

  test('should switch between List view and Calendar view and disable future dates', async ({ page }) => {
    // Initially in List view
    await expect(page.locator('#history-view-list-btn')).toHaveClass(/active/);
    await expect(page.getByText('שקשוקה ביתית')).toBeVisible();
    await expect(page.getByText('חזה עוף ואורז')).toBeVisible();

    // Switch to Calendar view
    await page.locator('#history-view-calendar-btn').click();
    await expect(page.locator('#history-view-calendar-btn')).toHaveClass(/active/);

    // Verify 7 days in the weekly strip
    const dayCells = page.locator('.calendar-day-cell');
    await expect(dayCells).toHaveCount(7);

    // Since clock is Wednesday 2026-06-10:
    // Sunday (07), Monday (08), Tuesday (09), Wednesday (10 = Today) are enabled (4 days)
    // Thursday (11), Friday (12), Saturday (13) are in the future and must be disabled (3 days)
    const futureCells = page.locator('.calendar-day-cell.future');
    await expect(futureCells).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      await expect(futureCells.nth(i)).toBeDisabled();
    }

    // Next week button should be disabled when viewing current week
    await expect(page.locator('#next-week-btn')).toBeDisabled();
  });

  test('should navigate between weeks and allow adding, editing, and deleting historical meals in Calendar view', async ({ page }) => {
    await page.locator('#history-view-calendar-btn').click();

    // Select Monday June 8, 2026 (index 1 in Sunday-Saturday week)
    const mondayCell = page.locator('.calendar-day-cell').nth(1);
    await mondayCell.click();
    await expect(mondayCell).toHaveClass(/selected/);

    // Verify Monday's existing meal and activity are shown
    await expect(page.getByText('חזה עוף ואורז')).toBeVisible();
    await expect(page.getByText('ריצת בוקר')).toBeVisible();

    // Navigate to previous week and back
    await page.locator('#prev-week-btn').click();
    await expect(page.locator('#next-week-btn')).toBeEnabled();
    await page.locator('#next-week-btn').click();
    await expect(page.locator('#next-week-btn')).toBeDisabled();

    // Select Tuesday June 9, 2026 (index 2) which has no meals yet
    const tuesdayCell = page.locator('.calendar-day-cell').nth(2);
    await tuesdayCell.click();
    await expect(page.getByText('לא נרשמו ארוחות או אימונים ביום זה')).toBeVisible();

    // AI analyze option should only appear after clicking "הוסף ארוחה"
    await expect(page.locator('#calendar-ai-add-meal-link')).toHaveCount(0);

    // Add a historical meal for Tuesday June 9 via Quick Add Modal
    await page.locator('#calendar-quick-add-meal-btn').click();
    await expect(page.locator('#calendar-ai-add-meal-link')).toBeVisible();
    await page.locator('#quick-meal-title-input').fill('סלט יווני וטונה');
    await page.locator('#quick-meal-calories-input').fill('380');
    await page.locator('#quick-meal-save-btn').click();

    // Verify newly added meal appears on Tuesday June 9
    await expect(page.getByText('סלט יווני וטונה')).toBeVisible();
    await expect(tuesdayCell).toContainText('380 קל׳');

    // Edit the meal on Tuesday June 9
    await page.locator('.selected-day-panel .edit-btn').first().click();
    const editModalInput = page.locator('app-edit-meal-modal input[type="text"]').first();
    await editModalInput.fill('סלט יווני משודרג');
    await page.locator('app-edit-meal-modal button.save-btn').click();
    await expect(page.getByText('סלט יווני משודרג')).toBeVisible();

    // Delete the meal on Tuesday June 9
    await page.locator('.selected-day-panel .delete-btn').first().click();
    await page.locator('app-confirm-modal button.confirm-btn').click();
    await expect(page.getByText('סלט יווני משודרג')).toHaveCount(0);
  });

  test('should allow starring a meal as favorite, filtering favorites, and 1-tap re-logging with a portion multiplier', async ({ page }) => {
    // Star the first meal ('שקשוקה ביתית' - 420 calories)
    const firstFavBtn = page.locator('.history-list .fav-btn').first();
    await firstFavBtn.click();
    await expect(firstFavBtn).toHaveClass(/active/);

    // Filter by Favorites only
    await page.locator('#filter-favorite-meals-btn').click();
    await expect(page.getByText('שקשוקה ביתית')).toBeVisible();
    await expect(page.getByText('חזה עוף ואורז')).toHaveCount(0);

    // Switch back to All
    await page.locator('#filter-all-meals-btn').click();
    await expect(page.getByText('חזה עוף ואורז')).toBeVisible();

    // Click 1-Tap Re-log button on 'שקשוקה ביתית' (420 cal)
    await page.locator('.history-list .relog-btn').first().click();
    await expect(page.locator('#relog-meal-modal')).toBeVisible();
    await expect(page.locator('#relog-preview-calories')).toHaveText('420');

    // Select 1.5x multiplier -> 420 * 1.5 = 630 calories
    await page.locator('#relog-meal-modal button[data-mult="1.5"]').click();
    await expect(page.locator('#relog-preview-calories')).toHaveText('630');

    // Confirm re-log
    await page.locator('#confirm-relog-btn').click();
    await expect(page.locator('#relog-toast-banner')).toContainText('נוספה בהצלחה');
    await expect(page.locator('.history-list .cal-value').first()).toHaveText('630');
  });
});
