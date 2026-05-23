import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-bottom-nav',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './bottom-nav.html',
  styleUrl: './bottom-nav.css',
})
export class BottomNav {
  readonly navItems = [
    { path: '/dashboard', label: 'דשבורד', icon: '🏠' },
    { path: '/add-meal', label: 'הוסף', icon: '➕', isAdd: true },
    { path: '/history', label: 'היסטוריה', icon: '📋' },
    { path: '/profile', label: 'פרופיל', icon: '👤' },
  ];
}
