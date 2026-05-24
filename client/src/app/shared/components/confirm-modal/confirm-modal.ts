import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-confirm-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-modal.html',
  styleUrl: './confirm-modal.css'
})
export class ConfirmModal {
  @Input() isOpen = false;
  @Input() title = 'אישור פעולה';
  @Input() message = 'האם אתה בטוח?';
  @Input() confirmText = 'אשר';
  @Input() cancelText = 'בטל';
  @Input() confirmColor: 'danger' | 'primary' = 'danger';
  @Input() isLoading = false;

  @Output() confirm = new EventEmitter<void>();
  @Output() cancel = new EventEmitter<void>();

  onConfirm(event: Event) {
    event.stopPropagation();
    this.confirm.emit();
  }

  onCancel(event: Event) {
    event.stopPropagation();
    this.cancel.emit();
  }
}
