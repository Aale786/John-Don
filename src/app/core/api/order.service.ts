import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaxseerOrder } from '../../views/taxseer/pages/orders/orders.data';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/orders`;

  getAll(params?: { status?: string; q?: string; filerId?: number }): Observable<TaxseerOrder[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.filerId != null) httpParams = httpParams.set('filerId', params.filerId);
    return this.http.get<TaxseerOrder[]>(this.base, { params: httpParams });
  }

  getById(id: string): Observable<TaxseerOrder> {
    return this.http.get<TaxseerOrder>(`${this.base}/${id}`);
  }
}
