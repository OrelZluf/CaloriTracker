import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-profile-setup-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-setup-modal.html',
  styleUrl: './profile-setup-modal.css'
})
export class ProfileSetupModal {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  weight = signal<number | null>(null);
  height = signal<number | null>(null);
  age = signal<number | null>(null);
  gender = signal<'male' | 'female' | null>(null);
  
  isSaving = signal(false);
  errorMessage = signal<string | null>(null);

  constructor(private authService: AuthService) {
    const user = this.authService.user();
    if (user) {
      this.weight.set(user.weight_kg ?? null);
      this.height.set(user.height_cm ?? null);
      this.age.set(user.age ?? null);
      this.gender.set(user.gender ?? null);
    }
  }

  onSkip() {
    this.close.emit();
  }

  saveProfile() {
    const w = Number(this.weight());
    const h = Number(this.height());
    const a = Number(this.age());
    const g = this.gender();

    if (!w || !h || !a || !g) {
      this.errorMessage.set('אנא מלא את כל השדות כדי לקבל המלצות מדויקות.');
      return;
    }

    this.isSaving.set(true);
    this.errorMessage.set(null);

    // Default basic BMR calculation for calorie goal
    let bmr = 0;
    if (g === 'male') {
      bmr = 10 * w + 6.25 * h - 5 * a + 5;
    } else {
      bmr = 10 * w + 6.25 * h - 5 * a - 161;
    }
    // Multiply by 1.2 for sedentary lifestyle default
    const defaultCalorieGoal = Math.round(bmr * 1.2);

    this.authService.updateProfile({
      weight_kg: w,
      height_cm: h,
      age: a,
      gender: g,
      daily_calorie_goal: defaultCalorieGoal
    }).subscribe({
      next: (res) => {
        if (res.success) {
          this.authService.fetchProfile();
        }
        this.isSaving.set(false);
        this.saved.emit();
        this.close.emit();
      },
      error: (err: any) => {
        this.isSaving.set(false);
        this.errorMessage.set(err.error?.message || 'שגיאה בשמירת הנתונים.');
      }
    });
  }
}
