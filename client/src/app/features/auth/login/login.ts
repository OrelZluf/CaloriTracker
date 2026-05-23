import {
  Component,
  OnInit,
  AfterViewInit,
  OnDestroy,
  signal,
  inject,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

declare const google: any;

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private ngZone = inject(NgZone);
  private platformId = inject(PLATFORM_ID);

  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  isVisible = signal(false);
  logoLoaded = signal(false);
  readonly currentYear = new Date().getFullYear();

  private gsiScriptElement: HTMLScriptElement | null = null;

  // Google Client ID
  private readonly GOOGLE_CLIENT_ID = '697650365176-c0iutn5qdjia4qvokbaja4pidfa7v20v.apps.googleusercontent.com';

  ngOnInit(): void {
    // If already authenticated, redirect to dashboard
    if (this.authService.isAuthenticated()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    // Trigger entrance animations
    setTimeout(() => this.isVisible.set(true), 100);
    setTimeout(() => this.logoLoaded.set(true), 300);
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadGoogleScript();
    }
  }

  ngOnDestroy(): void {
    if (this.gsiScriptElement) {
      this.gsiScriptElement.remove();
      this.gsiScriptElement = null;
    }
  }

  private loadGoogleScript(): void {
    // Check if already loaded
    if (typeof google !== 'undefined' && google.accounts) {
      this.initializeGoogle();
      return;
    }

    this.gsiScriptElement = document.createElement('script');
    this.gsiScriptElement.src = 'https://accounts.google.com/gsi/client';
    this.gsiScriptElement.async = true;
    this.gsiScriptElement.defer = true;
    this.gsiScriptElement.onload = () => this.initializeGoogle();
    this.gsiScriptElement.onerror = () => {
      this.errorMessage.set('שגיאה בטעינת שירות Google');
    };
    document.head.appendChild(this.gsiScriptElement);
  }

  private initializeGoogle(): void {
    google.accounts.id.initialize({
      client_id: this.GOOGLE_CLIENT_ID,
      callback: (response: any) => this.handleCredentialResponse(response),
      auto_select: false,
      cancel_on_tap_outside: true,
    });

    const btnContainer = document.getElementById('google-signin-btn');
    if (btnContainer) {
      google.accounts.id.renderButton(btnContainer, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        shape: 'pill',
        text: 'signin_with',
        logo_alignment: 'center',
        width: 320,
        locale: 'he',
      });
    }
  }

  private handleCredentialResponse(response: any): void {
    this.ngZone.run(() => {
      this.isLoading.set(true);
      this.errorMessage.set(null);
      this.authService.loginWithGoogle(response.credential);
    });
  }


}
