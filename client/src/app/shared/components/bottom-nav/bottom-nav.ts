import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { ActionSheet, ActionSheetOption } from '../action-sheet/action-sheet';

@Component({
  selector: 'app-bottom-nav',
  imports: [CommonModule, RouterLink, RouterLinkActive, ActionSheet],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  private readonly router = inject(Router);

  readonly navItems = [
    { path: '/dashboard', label: 'דשבורד', icon: '🏠' },
    { action: 'openActionSheet', label: 'הוסף', icon: '➕', isAdd: true },
    { path: '/history', label: 'היסטוריה', icon: '📋' },
    { path: '/profile', label: 'פרופיל', icon: '👤' },
  ];

  readonly isActionSheetOpen = signal(false);
  readonly actionOptions: ActionSheetOption[] = [
    { id: 'meal', label: 'הוסף ארוחה', icon: '🍽️', color: '#10b981' },
    { id: 'activity', label: 'הוסף פעילות גופנית', icon: '🏃', color: '#3b82f6' }
  ];

  handleNavClick(item: any, event: Event) {
    if (item.action === 'openActionSheet') {
      event.preventDefault();
      this.isActionSheetOpen.set(true);
    } else if (item.path) {
      this.router.navigate([item.path]);
    }
  }

  handleActionSelect(actionId: string): void {
    this.isActionSheetOpen.set(false);
    if (actionId === 'meal') {
      this.router.navigate(['/add-meal']);
    } else if (actionId === 'activity') {
      this.router.navigate(['/add-activity']);
    }
  }
}
