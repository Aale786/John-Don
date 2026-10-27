import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/wallet`;

  getBalance(): Observable<{ balance: number }> {
    return this.http.get<{ balance: number }>(this.base);
  }

  addFunds(amount: number): Observable<{ balance: number }> {
    return this.http.post<{ balance: number }>(`${this.base}/add-funds`, { amount });
  }
}
