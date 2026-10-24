import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TaxseerFiler } from '../../views/taxseer/data/taxseer-filers.data';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class FilerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/filers`;

  getAll(): Observable<TaxseerFiler[]> {
    return this.http.get<TaxseerFiler[]>(this.base);
  }

  search(q: string): Observable<TaxseerFiler[]> {
    return this.http.get<TaxseerFiler[]>(this.base, { params: { q } });
  }

  getById(id: number): Observable<TaxseerFiler> {
    return this.http.get<TaxseerFiler>(`${this.base}/${id}`);
  }

  create(f: TaxseerFiler): Observable<TaxseerFiler> {
    return this.http.post<TaxseerFiler>(this.base, f);
  }

  update(id: number, f: TaxseerFiler): Observable<TaxseerFiler> {
    return this.http.put<TaxseerFiler>(`${this.base}/${id}`, f);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
