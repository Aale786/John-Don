import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/cart`;

  getCart(userId: number): Observable<any[]> {
    return this.http.get<any[]>(this.base, { params: { userId } });
  }

  addToCart(filingId: number, userId: number): Observable<any> {
    return this.http.post<any>(this.base, { filingId, userId });
  }

  removeFromCart(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  checkout(userId: number): Observable<any> {
    return this.http.post<any>(`${this.base}/checkout`, { userId });
  }
}
