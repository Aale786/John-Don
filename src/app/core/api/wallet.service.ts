import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/wallet`;

  getBalance(userId: number): Observable<{ balance: number }> {
    return this.http.get<{ balance: number }>(this.base, { params: { userId } });
  }

  addFunds(userId: number, amount: number): Observable<{ balance: number }> {
    return this.http.post<{ balance: number }>(`${this.base}/add-funds`, { userId, amount });
  }
}
