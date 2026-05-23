import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
})
export class Profile {
  readonly authService = inject(AuthService);

  readonly user = this.authService.user;
  readonly isEditing = signal(false);
  
  // Form fields
  readonly formGoal = signal(2000);
  readonly formHeight = signal<number | null>(null);
  readonly formWeight = signal<number | null>(null);
  readonly formAge = signal<number | null>(null);
  readonly formGender = signal<'male' | 'female'>('male');
  
  readonly saved = signal(false);

  startEditing(): void {
    const u = this.user();
    if (u) {
      this.formGoal.set(u.daily_calorie_goal ?? 2000);
      this.formHeight.set(u.height_cm ?? null);
      this.formWeight.set(u.weight_kg ?? null);
      this.formAge.set(u.age ?? null);
      this.formGender.set(u.gender ?? 'male');
    }
    this.isEditing.set(true);
  }

  readonly bmi = computed(() => {
    const h = this.user()?.height_cm;
    const w = this.user()?.weight_kg;
    if (!h || !w) return null;
    const heightM = h / 100;
    return +(w / (heightM * heightM)).toFixed(1);
  });

  readonly bmiPercentage = computed(() => {
    const b = this.bmi();
    if (!b) return 0;
    // Scale: 15 to 40 is a range of 25. 
    // b=15 -> 0%, b=40 -> 100%
    let pct = ((b - 15) / 25) * 100;
    return Math.min(Math.max(pct, 0), 100);
  });

  readonly idealWeightRange = computed(() => {
    const h = this.user()?.height_cm;
    if (!h) return null;
    const heightM = h / 100;
    const minWeight = 18.5 * (heightM * heightM);
    const maxWeight = 24.9 * (heightM * heightM);
    return { min: Math.round(minWeight), max: Math.round(maxWeight) };
  });

  // Calculate BMR using Mifflin-St Jeor Equation based on the saved user
  readonly bmr = computed(() => {
    const u = this.user();
    if (!u?.weight_kg || !u?.height_cm || !u?.age || !u?.gender) return null;
    let bmr = (10 * u.weight_kg) + (6.25 * u.height_cm) - (5 * u.age);
    bmr += (u.gender === 'male') ? 5 : -161;
    return Math.round(bmr * 1.2);
  });

  // Calculate live BMR for the edit form
  readonly formBmr = computed(() => {
    const w = this.formWeight();
    const h = this.formHeight();
    const a = this.formAge();
    const g = this.formGender();
    if (!w || !h || !a || !g) return null;
    let bmr = (10 * w) + (6.25 * h) - (5 * a);
    bmr += (g === 'male') ? 5 : -161;
    return Math.round(bmr * 1.2);
  });

  applyRecommendation(): void {
    const rec = this.formBmr() || this.bmr();
    if (rec) {
      this.formGoal.set(rec);
    }
  }

  saveProfile(): void {
    // Auto-apply recommendation if goal is still the default 2000
    let finalGoal = this.formGoal();
    const liveBmr = this.formBmr();
    if (finalGoal === 2000 && liveBmr) {
      finalGoal = liveBmr;
      this.formGoal.set(liveBmr);
    }

    this.authService.updateProfile({
      daily_calorie_goal: finalGoal,
      height_cm: this.formHeight(),
      weight_kg: this.formWeight(),
      age: this.formAge(),
      gender: this.formGender()
    });
    this.isEditing.set(false);
    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2000);
  }



  cancelEdit(): void {
    this.isEditing.set(false);
  }

  logout(): void {
    this.authService.logout();
  }
}
