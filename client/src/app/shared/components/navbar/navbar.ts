import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  readonly authService = inject(AuthService);
  readonly user = this.authService.user;

  readonly navLinks = [
    { path: '/dashboard', label: 'דשבורד', icon: '🏠' },
    { path: '/add-meal', label: 'הוסף ארוחה', icon: '➕' },
    { path: '/history', label: 'היסטוריה', icon: '📋' },
    { path: '/profile', label: 'פרופיל', icon: '👤' },
  ];
}
