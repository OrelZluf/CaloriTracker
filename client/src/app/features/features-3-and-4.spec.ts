import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { MealsService } from '../core/services/meals.service';
import { WeightService } from '../core/services/weight.service';
import { MealHistory } from './meal-history/meal-history';
import { Profile } from './profile/profile';

describe('Feature 3 (Favorites & 1-Tap Re-logging) & Feature 4 (Weight Trend & Dynamic TDEE Coach)', () => {
  let httpMock: HttpTestingController;
  let mealsService: MealsService;
  let weightService: WeightService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MealHistory, Profile],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    mealsService = TestBed.inject(MealsService);
    weightService = TestBed.inject(WeightService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should toggle meal favorite status and clone meal with multiplier via MealsService', () => {
    let favResult: any;
    mealsService.toggleFavorite(101, true).subscribe(res => (favResult = res));

    const favReq = httpMock.expectOne(req => req.url.endsWith('/meals/101/favorite') && req.method === 'PUT');
    expect(favReq.request.body).toEqual({ is_favorite: true });
    favReq.flush({
      success: true,
      data: { id: 101, title: 'שקשוקה', is_favorite: true, total_calories: 400 }
    });
    expect(favResult.data.is_favorite).toBe(true);

    let cloneResult: any;
    mealsService.cloneMeal(101, { multiplier: 1.5, meal_type: 'dinner' }).subscribe(res => (cloneResult = res));

    const cloneReq = httpMock.expectOne(req => req.url.endsWith('/meals/101/clone') && req.method === 'POST');
    expect(cloneReq.request.body).toEqual({ multiplier: 1.5, meal_type: 'dinner' });
    cloneReq.flush({
      success: true,
      data: { id: 202, title: 'שקשוקה', meal_type: 'dinner', total_calories: 600 }
    });
    expect(cloneResult.data.total_calories).toBe(600);
  });

  it('should filter favorite meals and compute scaled re-log preview in MealHistory component', () => {
    const fixture = TestBed.createComponent(MealHistory);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    // Flush initial forkJoin requests (meals + activities)
    const mealsReq = httpMock.expectOne(req => req.url.includes('/meals'));
    const actsReq = httpMock.expectOne(req => req.url.includes('/activities'));

    mealsReq.flush({
      success: true,
      data: {
        meals: [
          {
            id: 1,
            title: 'שייק חלבון',
            meal_type: 'snack',
            total_calories: 300,
            total_protein: 30,
            total_carbs: 25,
            total_fat: 6,
            input_method: 'text',
            is_favorite: true,
            created_at: '2026-06-10T09:00:00.000Z'
          },
          {
            id: 2,
            title: 'פסטה ברוטב עגבניות',
            meal_type: 'lunch',
            total_calories: 550,
            total_protein: 16,
            total_carbs: 90,
            total_fat: 12,
            input_method: 'text',
            is_favorite: false,
            created_at: '2026-06-10T13:00:00.000Z'
          }
        ],
        page: 1,
        totalPages: 1
      }
    });
    actsReq.flush({ success: true, data: { activities: [] } });

    expect(component.favoriteMealsCount()).toBe(1);
    expect(component.filteredMealGroups()[0].items.length).toBe(2);

    // Filter by favorites only
    component.toggleFavoritesFilter(true);
    expect(component.filteredMealGroups()[0].items.length).toBe(1);
    expect(component.filteredMealGroups()[0].items[0].title).toBe('שייק חלבון');

    // Open Re-log modal and change multiplier to 1.5x
    component.openRelogModal(component.meals()[0]);
    expect(component.relogScaledPreview()?.calories).toBe(300);

    component.relogMultiplier.set(1.5);
    expect(component.relogScaledPreview()?.calories).toBe(450);
    expect(component.relogScaledPreview()?.protein).toBe(45);
  });

  it('should fetch weight history, calculate SVG chart points, and log new weight in Profile component', () => {
    const fixture = TestBed.createComponent(Profile);
    const component = fixture.componentInstance;
    fixture.detectChanges();

    const weightGetReq = httpMock.expectOne(req => req.url.includes('/weight') && req.method === 'GET');
    weightGetReq.flush({
      success: true,
      data: {
        logs: [
          { id: 'w1', weight_kg: 76.0, date: '2026-06-01' },
          { id: 'w2', weight_kg: 75.0, date: '2026-06-08' }
        ],
        coach: {
          is_calibrated: true,
          start_weight: 76.0,
          current_weight: 75.0,
          weight_change_kg: -1.0,
          span_days: 7,
          avg_daily_calories: 1900,
          estimated_tdee: 2450,
          recommended_goal: 2050,
          current_goal: 2000,
          target_mode: 'lose',
          message: 'ירדת 1 ק"ג ב-7 ימים'
        }
      }
    });

    const chart = component.weightChartData();
    expect(chart).toBeTruthy();
    expect(chart!.minW).toBe(75.0);
    expect(chart!.maxW).toBe(76.0);
    expect(chart!.points.length).toBe(2);

    // Log a new weight entry
    component.newWeightKg.set(74.5);
    component.newWeightDate.set('2026-06-10');
    component.newWeightNote.set('שקילת בוקר');
    component.submitWeightLog();

    const postReq = httpMock.expectOne(req => req.url.includes('/weight') && req.method === 'POST');
    expect(postReq.request.body).toEqual({
      weight_kg: 74.5,
      date: '2026-06-10',
      note: 'שקילת בוקר'
    });
    postReq.flush({
      success: true,
      data: {
        log: { id: 'w3', weight_kg: 74.5, date: '2026-06-10', note: 'שקילת בוקר' },
        coach: {
          is_calibrated: true,
          start_weight: 76.0,
          current_weight: 74.5,
          weight_change_kg: -1.5,
          span_days: 9,
          avg_daily_calories: 1900,
          estimated_tdee: 2500,
          recommended_goal: 2100,
          current_goal: 2000,
          target_mode: 'lose',
          message: 'ירדת 1.5 ק"ג'
        }
      }
    });

    // fetchProfile is triggered after logging weight
    const meReq = httpMock.match(req => req.url.includes('/auth/me'));
    meReq.forEach(r => r.flush({ success: true, data: {} }));

    expect(component.weightLogs().length).toBe(3);
    expect(component.weightCoach()?.current_weight).toBe(74.5);
    expect(component.weightCoach()?.recommended_goal).toBe(2100);
  });
});
