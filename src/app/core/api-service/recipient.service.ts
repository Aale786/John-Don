import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FilerRecipient } from '../../views/taxseer/pages/filer-details/filer-details.data';
import { API_BASE } from './api.config';

/** Raw shape returned by the Java backend. */
type ApiRecipient = {
  id: number;
  filerId: number;
  type: 'SSN' | 'EIN';
  tin: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  econsent: boolean;
  /** Backend field name for W-9 status */
  w9Status: string;
  w9SentAt?: string;
  w9GotAt?: string;
  w9Reminders?: number;
  /** May be present if filerName is returned for convenience */
  filerName?: string;
};

function mapApiRecipient(r: ApiRecipient): FilerRecipient {
  // Map w9Status → w9 (normalise to the three frontend values)
  let w9: FilerRecipient['w9'] = 'Not requested';
  const raw = r.w9Status ?? '';
  if (raw === 'Submitted') w9 = 'Submitted';
  else if (raw === 'Requested') w9 = 'Requested';

  return {
    id: String(r.id),
    filerId: r.filerId,
    type: r.type ?? 'SSN',
    tin: r.tin ?? '',
    name: r.name ?? '',
    address: r.address ?? '',
    city: r.city ?? '',
    state: r.state ?? '',
    zip: r.zip ?? '',
    email: r.email ?? '',
    econsent: r.econsent ?? false,
    w9,
    // Pass through extra fields some callers need (recipients.ts uses filerName)
    ...(r.filerName ? { filerName: r.filerName } : {}),
  } as FilerRecipient & { filerName?: string };
}

@Injectable({ providedIn: 'root' })
export class RecipientService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/recipients`;

  /** Fetch all recipients across all filers (for the Recipients/W-9 page). */
  getAll(): Observable<FilerRecipient[]> {
    return this.http.get<ApiRecipient[]>(this.base).pipe(map(list => list.map(mapApiRecipient)));
  }

  getByFiler(filerId: number): Observable<FilerRecipient[]> {
    return this.http.get<ApiRecipient[]>(this.base, { params: { filerId } }).pipe(map(list => list.map(mapApiRecipient)));
  }

  search(filerId: number, q: string): Observable<FilerRecipient[]> {
    return this.http.get<ApiRecipient[]>(this.base, { params: { filerId, q } }).pipe(map(list => list.map(mapApiRecipient)));
  }

  getById(id: number): Observable<FilerRecipient> {
    return this.http.get<ApiRecipient>(`${this.base}/${id}`).pipe(map(mapApiRecipient));
  }

  create(r: any): Observable<FilerRecipient> {
    return this.http.post<ApiRecipient>(this.base, r).pipe(map(mapApiRecipient));
  }

  update(id: number, r: any): Observable<FilerRecipient> {
    return this.http.put<ApiRecipient>(`${this.base}/${id}`, r).pipe(map(mapApiRecipient));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

function toApiRecipient(r: FilerRecipient): Partial<ApiRecipient> {
  return {
    id: Number(r.id),
    filerId: r.filerId,
    type: r.type,
    tin: r.tin,
    name: r.name,
    address: r.address,
    city: r.city,
    state: r.state,
    zip: r.zip,
    email: r.email,
    w9Status: r.w9,
    econsent: r.econsent,
  };
}
