import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '@/app/core/auth-interceptors/auth.service';

@Component({
  selector: 'taxseer-sign-in',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './sign-in.html',
  styleUrl: './sign-in.scss',
})
export class SignInComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  email = '';
  password = '';
  submitting = false;
  errorMessage = '';

  submit(): void {
    this.errorMessage = '';
    const email = this.email.trim();
    const password = this.password;

    if (!email || !password) {
      this.errorMessage = 'Enter your email and password.';
      return;
    }

    this.submitting = true;
    this.auth.login(email, password).subscribe({
      next: () => {
        const raw = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/taxseer';
        const target = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/taxseer';
        void this.router.navigateByUrl(target);
      },
      error: (err) => {
        this.submitting = false;
        this.errorMessage =
          err?.error?.friendlyMessage ??
          err?.error?.message ??
          'Could not sign in. Check your email and password.';
      },
    });
  }
}
