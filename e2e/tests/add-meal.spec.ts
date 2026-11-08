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

test.describe('Add Meal Feature', () => {
  test.beforeEach(async ({ page }) => {
    // Mock user profile
    await page.route('**/api/auth/me', route => 
      route.fulfill({ status: 200, json: { success: true, data: mockUser } })
    );

    await page.route('**/api/dashboard/daily*', route => 
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            date: new Date().toISOString().split('T')[0],
            total_calories: 500,
            total_protein: 30,
            total_carbs: 50,
            total_fat: 15,
            calorie_goal: 2000,
            meals: []
          }
        }
      })
    );

    await page.route('**/api/insights/yesterday*', route => 
      route.fulfill({ status: 200, json: { status: 'success', data: { insight: null } } })
    );
  });

  test('should navigate to add meal and submit successfully', async ({ page }) => {
    // Go directly to the add meal page
    await page.goto('/add-meal');

    // Switch to text input mode
    await page.getByRole('button', { name: /טקסט/ }).click();

    const textInput = page.locator('textarea.text-input');
    await textInput.waitFor();
    await textInput.fill('ארוחת בוקר פיקטיבית');

    // Mock AI text analysis response
    await page.route('**/api/meals/analyze-text', route =>
      route.fulfill({
        status: 200,
        json: {
          success: true,
          data: {
            analysis: {
              title: 'ארוחת בוקר פיקטיבית',
              ingredients: [
                {
                  name: 'חביתה',
                  category: 'protein',
                  estimated_grams: 120,
                  calories: 250,
                  protein_grams: 18,
                  carbs_grams: 2,
                  fat_grams: 18
                }
              ]
            }
          }
        }
      })
    );

    await page.getByRole('button', { name: /נתח ארוחה/ }).click();
    await expect(page.getByText('ארוחת בוקר פיקטיבית')).toBeVisible();

    // Mock the POST request for saving a meal
    await page.route('**/api/meals', route => {
      expect(route.request().method()).toBe('POST');
      route.fulfill({
        status: 201,
        json: {
          success: true,
          message: 'הארוחה נשמרה בהצלחה!',
          data: { id: 1, title: 'ארוחת בוקר פיקטיבית', total_calories: 250 }
        }
      });
    });

    // Submit the form (save button)
    const submitBtn = page.getByRole('button', { name: /שמור ארוחה/ });
    await submitBtn.click();

    // Verify redirection to dashboard
    await expect(page).toHaveURL(/.*\/dashboard/);
  });
});
