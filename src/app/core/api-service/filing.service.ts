import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FilerFiling, FilingStatus } from '../../views/taxseer/pages/filer-details/filer-details.data';
import { API_BASE } from './api.config';

/** Raw shape returned by the Java backend. */
type ApiFiling = {
  id: number;
  filerId: number;
  recipientId?: number;
  taxYear: number;
  form: string;
  /** Backend field name */
  recipientName: string;
  tin: string;
  amount: number | null;
  status: string;
  issue?: string;
  /** Backend field name */
  orderId?: string;
  /** Backend field name — ISO datetime string */
  editedAt?: string;
  createdAt?: string;
};

function mapApiFiling(f: ApiFiling): FilerFiling {
  // Format editedAt ISO datetime to short date string e.g. "Jan 13, 2026"
  let edited = '';
  if (f.editedAt) {
    try {
      edited = new Date(f.editedAt).toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric'
      });
    } catch {
      edited = f.editedAt;
    }
  }

  return {
    id: String(f.id),
    filerId: f.filerId,
    taxYear: f.taxYear,
    form: f.form ?? '',
    recipient: f.recipientName ?? '',
    tin: f.tin ?? '',
    amount: f.amount != null ? Number(f.amount) : null,
    status: (f.status ?? 'Pending') as FilingStatus,
    issue: f.issue ?? undefined,
    order: f.orderId ?? undefined,
    edited,
  };
}

@Injectable({ providedIn: 'root' })
export class FilingService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/filings`;

  getByFiler(filerId: number, taxYear?: number, status?: string): Observable<FilerFiling[]> {
    let params = new HttpParams().set('filerId', filerId);
    if (taxYear != null) params = params.set('taxYear', taxYear);
    if (status != null) params = params.set('status', status);
    return this.http.get<ApiFiling[]>(this.base, { params }).pipe(map(list => list.map(mapApiFiling)));
  }

  getById(id: number): Observable<FilerFiling> {
    return this.http.get<ApiFiling>(`${this.base}/${id}`).pipe(map(mapApiFiling));
  }

  create(f: FilerFiling): Observable<FilerFiling> {
    return this.http.post<ApiFiling>(this.base, toApiFiling(f)).pipe(map(mapApiFiling));
  }

  update(id: number, f: FilerFiling): Observable<FilerFiling> {
    return this.http.put<ApiFiling>(`${this.base}/${id}`, toApiFiling(f)).pipe(map(mapApiFiling));
  }

  updateStatus(id: number, status: string): Observable<FilerFiling> {
    return this.http.patch<ApiFiling>(`${this.base}/${id}/status`, { status }).pipe(map(mapApiFiling));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

function toApiFiling(f: FilerFiling): Partial<ApiFiling> {
  return {
    id: Number(f.id),
    filerId: f.filerId,
    taxYear: f.taxYear,
    form: f.form,
    recipientName: f.recipient,
    tin: f.tin,
    amount: f.amount,
    status: f.status,
    issue: f.issue,
    orderId: f.order,
  };
}
