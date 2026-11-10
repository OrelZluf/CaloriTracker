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
  });
});
