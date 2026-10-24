import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FilerRecipient } from '../../views/taxseer/pages/filer-details/filer-details.data';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class RecipientService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/recipients`;

  getByFiler(filerId: number): Observable<FilerRecipient[]> {
    return this.http.get<FilerRecipient[]>(this.base, { params: { filerId } });
  }

  search(filerId: number, q: string): Observable<FilerRecipient[]> {
    return this.http.get<FilerRecipient[]>(this.base, { params: { filerId, q } });
  }

  getById(id: number): Observable<FilerRecipient> {
    return this.http.get<FilerRecipient>(`${this.base}/${id}`);
  }

  create(r: FilerRecipient): Observable<FilerRecipient> {
    return this.http.post<FilerRecipient>(this.base, r);
  }

  update(id: number, r: FilerRecipient): Observable<FilerRecipient> {
    return this.http.put<FilerRecipient>(`${this.base}/${id}`, r);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}
