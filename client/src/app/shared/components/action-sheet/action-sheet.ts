import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ActionSheetOption {
  id: string;
  label: string;
  icon: string;
  color?: string;
}

@Component({
  selector: 'app-action-sheet',
  imports: [CommonModule],
  templateUrl: './action-sheet.html',
  styleUrl: './action-sheet.css',
})
export class ActionSheet {
  @Input() isOpen = false;
  @Input() title = 'בחר פעולה';
  @Input() options: ActionSheetOption[] = [];
  
  @Output() close = new EventEmitter<void>();
  @Output() selectOption = new EventEmitter<string>();

  onClose() {
    this.close.emit();
  }

  onSelect(id: string) {
    this.selectOption.emit(id);
  }
}
