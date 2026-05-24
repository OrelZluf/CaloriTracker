import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-pro-upgrade-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pro-upgrade-modal.html',
  styleUrl: './pro-upgrade-modal.css'
})
export class ProUpgradeModal {
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();

  onClose() {
    this.close.emit();
  }

  onUpgrade() {
    alert('בקרוב! התשלום עוד לא מחובר.');
    this.close.emit();
  }
}
