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

test.describe('Profile Update Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', route => 
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );
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
});
