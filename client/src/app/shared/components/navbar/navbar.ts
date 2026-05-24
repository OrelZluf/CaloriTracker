import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ActionSheet, ActionSheetOption } from '../action-sheet/action-sheet';
import { signal } from '@angular/core';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ActionSheet],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  readonly authService = inject(AuthService);
  readonly router = inject(Router);
  readonly user = this.authService.user;

  readonly isActionSheetOpen = signal(false);
  readonly actionOptions: ActionSheetOption[] = [
    { id: 'meal', label: 'הוסף ארוחה', icon: '🍽️', color: '#10b981' },
    { id: 'activity', label: 'הוסף פעילות גופנית', icon: '🏃', color: '#3b82f6' }
  ];

  readonly navLinks = [
    { path: '/dashboard', label: 'דשבורד', icon: '🏠' },
    { action: 'add', label: 'הוספה', icon: '➕' },
    { path: '/history', label: 'היסטוריה', icon: '📋' },
    { path: '/profile', label: 'פרופיל', icon: '👤' },
  ];

  handleNavClick(link: any, event: Event) {
    if (link.action === 'add') {
      event.preventDefault();
      this.isActionSheetOpen.set(true);
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
