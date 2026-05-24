import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivityService } from '../../../core/services/activity.service';
import { Activity, COMMON_ACTIVITIES } from '../../models/activity.model';

@Component({
  selector: 'app-edit-activity-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-activity-modal.html',
  styleUrl: './edit-activity-modal.css'
})
export class EditActivityModal implements OnChanges {
  private readonly activityService = inject(ActivityService);

  @Input() activity: Activity | null = null;
  @Input() isOpen = false;
  
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<Activity>();

  readonly duration = signal<number>(0);
  readonly selectedType = signal<string>('');
  readonly isSaving = signal(false);
  readonly error = signal<string | null>(null);

  readonly commonActivities = COMMON_ACTIVITIES;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activity'] && this.activity) {
      this.duration.set(this.activity.duration_minutes || 0);
      
      // Try to match activity type to common activities
      const type = this.activity.activity_type || 'other';
      this.selectedType.set(type);
    }
  }

  onClose(): void {
    if (!this.isSaving()) {
      this.close.emit();
    }
  }

  async onSave(): Promise<void> {
    if (!this.activity || !this.duration() || this.duration() <= 0) {
      this.error.set('אנא הזן משך זמן תקין');
      return;
    }

    this.error.set(null);
    this.isSaving.set(true);

    const type = this.selectedType();
    const actData = this.commonActivities.find(a => a.name === type);
    const title = actData ? `פעילות מותאמת: ${actData.name}` : this.activity.title;
    const met = actData ? actData.met : this.activity.met_value;

    const payload = {
      duration_minutes: this.duration(),
      activity_type: type,
      title,
      met_value: met
    };

    this.activityService.updateActivity(this.activity.id!, payload).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.saved.emit(res.data);
          this.close.emit();
        } else {
          this.error.set(res.message || 'שגיאה בעדכון הפעילות');
        }
        this.isSaving.set(false);
      },
      error: () => {
        this.error.set('שגיאה בתקשורת עם השרת');
        this.isSaving.set(false);
      }
    });
  }
}
