import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyInsight } from '../../models/insight.model';

@Component({
  selector: 'app-daily-insight-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './daily-insight-modal.html',
  styleUrl: './daily-insight-modal.css'
})
export class DailyInsightModal {
  @Input() isOpen = false;
  @Input() insight: DailyInsight | null = null;
  /** Human label of the summarized day (e.g. 'אתמול'). */
  @Input() dateLabel = 'אתמול';
  @Output() close = new EventEmitter<void>();
}
