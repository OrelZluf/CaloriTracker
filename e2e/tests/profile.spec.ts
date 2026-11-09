import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4200';

const mockUser = {
  id: 1,
  name: 'Playwright Tester',
  email: 'tester@playwright.com',
  daily_calorie_goal: 2000,
  height_cm: 180,
  weight_kg: 75,
  age: 30,
  gender: 'male',
  created_at: new Date().toISOString()
};

test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [
          { name: 'ct_token', value: 'fake-jwt-token' },
          { name: 'ct_user', value: JSON.stringify(mockUser) }
        ]
      }
    ]
  }
});

test.describe('Profile Update & Weight Trend / TDEE Auto-Coach Feature', () => {
  test.beforeEach(async ({ page }) => {
    let weightLogs = [
      { id: 1, weight_kg: 76.2, date: '2026-06-01', note: 'תחילת חודש' },
      { id: 2, weight_kg: 75.4, date: '2026-06-08', note: 'שבוע שני' }
    ];

    await page.route('**/api/auth/me', route => 
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );

    await page.route(/\/api\/weight/, async route => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            data: {
              logs: weightLogs,
              coach: {
                is_calibrated: true,
                start_weight: 76.2,
                current_weight: weightLogs[weightLogs.length - 1].weight_kg,
                weight_change_kg: -0.8,
                span_days: 7,
                avg_daily_calories: 1950,
                estimated_tdee: 2350,
                recommended_goal: 1950,
                current_goal: 2000,
                target_mode: 'maintain',
                message: 'במהלך 7 ימים אחרונים ירדת 0.8 ק"ג. קצב חילוף החומרים המוערך שלך (TDEE) הוא כ-2350 קל׳ ליום.'
              }
            }
          }
        });
      } else if (method === 'POST') {
        const body = route.request().postDataJSON();
        const newLog = {
          id: 3,
          weight_kg: Number(body.weight_kg),
          date: body.date || '2026-06-10',
          note: body.note || null
        };
        weightLogs = [...weightLogs, newLog];
        await route.fulfill({
          status: 201,
          json: {
            success: true,
            data: {
              log: newLog,
              coach: {
                is_calibrated: true,
                start_weight: 76.2,
                current_weight: newLog.weight_kg,
                weight_change_kg: +(newLog.weight_kg - 76.2).toFixed(1),
                span_days: 9,
                avg_daily_calories: 1950,
                estimated_tdee: 2400,
                recommended_goal: 1900,
                current_goal: 2000,
                target_mode: 'lose',
                message: 'במהלך 9 ימים אחרונים ירדת 1.4 ק"ג. מומלץ יעד של 1900 קל׳ ליום.'
              }
            }
          }
        });
      } else {
        await route.fallback();
      }
    });
  });

  test('should update profile successfully', async ({ page }) => {
    await page.goto('/profile');

    // Open edit mode first
    await page.getByRole('button', { name: 'ערוך פרופיל' }).click();

    // Mock the PUT request for profile update
    await page.route('**/api/auth/profile', route => {
      expect(route.request().method()).toBe('PUT');
      route.fulfill({
        status: 200,
        json: {
          success: true,
          message: 'הפרופיל עודכן בהצלחה',
          data: { ...mockUser, weight_kg: 80, height_cm: 180, daily_calorie_goal: 2500 }
        }
      });
    });

    const weightInput = page.locator('input[type="number"]').nth(1);
    await weightInput.waitFor();
    await weightInput.fill('80');

    // Submit
    const submitBtn = page.getByRole('button', { name: /שמור שינויים/ });
    await submitBtn.click();

    await expect(page.getByText('נשמר בהצלחה')).toBeVisible();
  });

  test('should display weight trend chart, log a new weigh-in, and apply TDEE auto-coach goal', async ({ page }) => {
    await page.goto('/profile');

    // Verify weight trend section and chart are visible
    await expect(page.locator('#weight-coach-section')).toBeVisible();
    await expect(page.locator('#weight-trend-chart')).toBeVisible();
    await expect(page.locator('#tdee-coach-card')).toContainText('2350');

    // Log a new weight check-in
    await page.locator('#weight-log-kg-input').fill('74.8');
    await page.locator('#weight-log-note-input').fill('שקילת בוקר');
    await page.locator('#weight-log-submit-btn').click();

    await expect(page.locator('#weight-saved-toast')).toContainText('השקילה נשמרה בהצלחה');
    await expect(page.getByText('74.8 ק"ג').first()).toBeVisible();

    // Apply the TDEE Coach recommended calorie goal (1900)
    await page.route('**/api/auth/profile', route => {
      const body = route.request().postDataJSON();
      expect(body.daily_calorie_goal).toBe(1900);
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: { ...mockUser, daily_calorie_goal: 1900 }
        }
      });
    });

    await page.locator('#apply-coach-goal-btn').click();
    await expect(page.locator('#weight-saved-toast')).toContainText('1900');
  });
});
