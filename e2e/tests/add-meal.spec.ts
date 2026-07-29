import { test, expect } from '@playwright/test';

const mockUser = {
  id: 1,
  name: 'Playwright Tester',
  email: 'tester@playwright.com',
  daily_calorie_goal: 2000,
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

test.describe('Add Meal Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user profile
    await page.route('**/api/auth/me', route => 
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );

    // Mock meal list (empty initially)
    await page.route('**/api/meals?*', route => 
      route.fulfill({ status: 200, json: { success: true, data: { meals: [], pagination: {} } } })
    );
  });

  test('should navigate to add meal and submit successfully', async ({ page }) => {
    // Go directly to the add meal page
    await page.goto('https://calori-tracker-sigma.vercel.app/add-meal');

    // Wait for form to load (look for the "שם הארוחה" input)
    // We assume there's a text input for title, since it's an add meal form
    const titleInput = page.getByRole('textbox').first();
    await titleInput.waitFor();
    await titleInput.fill('ארוחת בוקר פיקטיבית');

    // Mock the POST request for adding a meal
    await page.route('**/api/meals', route => {
      expect(route.request().method()).toBe('POST');
      route.fulfill({
        status: 201,
        json: {
          success: true,
          message: 'הארוחה נשמרה בהצלחה!',
          data: { id: 'mock-meal-1', title: 'ארוחת בוקר פיקטיבית', total_calories: 500 }
        }
      });
    });

    // Submit the form (find the save button)
    const submitBtn = page.getByRole('button', { name: /שמור|הוסף/ });
    await submitBtn.click();

    // Verify redirection to dashboard or success state
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
});
