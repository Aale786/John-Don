import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';

export type CartItem = {
  id: number;
  filingId: number;
  userId?: number;
  recipientName?: string;
  tin?: string;
  taxYear?: number;
  form?: string;
  amount?: number | null;
  status?: string;
  addedAt?: string;
};

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/cart`;

  getCart(): Observable<CartItem[]> {
    return this.http.get<CartItem[]>(this.base);
  }

  addToCart(filingId: number): Observable<CartItem> {
    return this.http.post<CartItem>(this.base, { filingId });
  }

  removeFromCart(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  checkout(): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/checkout`, {});
  }
}
