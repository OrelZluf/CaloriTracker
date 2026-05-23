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

  // Calculate BMI: weight (kg) / (height (m))^2
  readonly bmi = computed(() => {
    const h = this.user()?.height_cm;
    const w = this.user()?.weight_kg;
    if (!h || !w) return null;
    const heightM = h / 100;
    return +(w / (heightM * heightM)).toFixed(1);
  });

  // Calculate BMR using Mifflin-St Jeor Equation
  readonly bmr = computed(() => {
    const u = this.user();
    if (!u?.weight_kg || !u?.height_cm || !u?.age || !u?.gender) return null;
    
    // BMR = 10 * weight(kg) + 6.25 * height(cm) - 5 * age(y) + s (s = +5 for males, -161 for females)
    let bmr = (10 * u.weight_kg) + (6.25 * u.height_cm) - (5 * u.age);
    bmr += (u.gender === 'male') ? 5 : -161;
    
    // Multiply by a sedentary activity factor of 1.2 for a baseline recommendation
    return Math.round(bmr * 1.2);
  });

  applyRecommendation(): void {
    const rec = this.bmr();
    if (rec) {
      this.formGoal.set(rec);
    }
  }

  saveProfile(): void {
    this.authService.updateProfile({
      daily_calorie_goal: this.formGoal(),
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
