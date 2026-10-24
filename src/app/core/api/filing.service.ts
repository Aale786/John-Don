import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FilerFiling } from '../../views/taxseer/pages/filer-details/filer-details.data';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class FilingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/filings`;

  getByFiler(filerId: number, taxYear?: number, status?: string): Observable<FilerFiling[]> {
    let params = new HttpParams().set('filerId', filerId);
    if (taxYear != null) params = params.set('taxYear', taxYear);
    if (status != null) params = params.set('status', status);
    return this.http.get<FilerFiling[]>(this.base, { params });
  }

  getById(id: number): Observable<FilerFiling> {
    return this.http.get<FilerFiling>(`${this.base}/${id}`);
  }

  create(f: FilerFiling): Observable<FilerFiling> {
    return this.http.post<FilerFiling>(this.base, f);
  }

  update(id: number, f: FilerFiling): Observable<FilerFiling> {
    return this.http.put<FilerFiling>(`${this.base}/${id}`, f);
  }

  updateStatus(id: number, status: string): Observable<FilerFiling> {
    return this.http.patch<FilerFiling>(`${this.base}/${id}/status`, { status });
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
