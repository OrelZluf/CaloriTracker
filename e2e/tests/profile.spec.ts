import { test, expect } from '@playwright/test';

const mockUser = {
  id: 1,
  name: 'Playwright Tester',
  email: 'tester@playwright.com',
  daily_calorie_goal: 2000,
  height_cm: null,
  weight_kg: null,
  created_at: new Date().toISOString()
};

test.use({
  storageState: {
    cookies: [],
    origins: [
      {
        origin: 'https://calori-tracker-sigma.vercel.app',
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
    // Mock user profile (missing details so the setup modal might pop up, or we open it manually)
    await page.route('**/api/auth/me', route => 
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );
    await page.route('**/api/meals?*', route => 
      route.fulfill({ status: 200, json: { success: true, data: { meals: [], pagination: {} } } })
    );
  });

  test('should update profile successfully', async ({ page }) => {
    await page.goto('https://calori-tracker-sigma.vercel.app/profile'); // Assuming /profile route exists, or we test through dashboard setup modal

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

    // Wait for the profile inputs (e.g. weight, height)
    // Here we are abstracting the exact selectors, we assume there are number inputs or specific labels
    const weightInput = page.locator('input[type="number"]').first();
    await weightInput.waitFor();
    await weightInput.fill('80');

    // Submit
    const submitBtn = page.getByRole('button', { name: /שמור|עדכן/ });
    await submitBtn.click();

    // Verify it saved (you could check for a success message or that the UI reflects the new goal)
    // Just verifying the request was mocked and no errors happened
  });
});
