import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { map } from 'rxjs/operators';
import { TaxseerFiler } from '../../views/taxseer/data/taxseer-filers.data';
import { API_BASE } from './api.config';

/** Raw shape returned by the Java backend (snake_case → camelCase via R2DBC). */
type ApiFiler = Omit<TaxseerFiler, 'pending' | 'ready' | 'filed' | 'formsUsed'> & {
  pendingCount: number;
  readyCount: number;
  filedCount: number;
  /** Stored as a comma-separated string in the DB (e.g. "1099-NEC,1099-MISC"). */
  formsUsed: string | string[] | null;
};

function mapApiFiler(f: ApiFiler): TaxseerFiler {
  const rawForms = f.formsUsed;
  const formsUsed: string[] =
    Array.isArray(rawForms)
      ? rawForms
      : typeof rawForms === 'string' && rawForms.trim()
        ? rawForms.split(',').map(s => s.trim()).filter(Boolean)
        : [];

  return {
    id: f.id,
    name: f.name,
    ein: f.ein,
    address: f.address ?? '',
    address2: f.address2 ?? '',
    city: f.city ?? '',
    state: f.state ?? '',
    zip: f.zip ?? '',
    email: f.email ?? '',
    phone: f.phone ?? '',
    stateId: f.stateId ?? '',
    name2: f.name2 ?? '',
    mask: f.mask ?? false,
    formsUsed,
    
    pending: f.pendingCount ?? 0,
    ready: f.readyCount ?? 0,
    filed: f.filedCount ?? 0,
    w9Total: f.w9Total ?? 0,
    w9Required: f.w9Required ?? 0,
    w9Received: f.w9Received ?? 0,
    warning: f.warning,
  };
}

@Injectable({ providedIn: 'root' })
export class FilerService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/filers`;

  /**
   * In-memory cache of the last loaded filer list.
   * Lives in the service (singleton) so it survives navigation.
   * Components read this signal immediately — no blank flash on re-visit.
   */
  readonly cachedFilers = signal<TaxseerFiler[]>([]);

  getAll(): Observable<TaxseerFiler[]> {
    return this.http.get<ApiFiler[]>(this.base).pipe(
      map(list => list.map(mapApiFiler)),
      tap(filers => this.cachedFilers.set(filers))
    );
  }

  search(q: string): Observable<TaxseerFiler[]> {
    return this.http.get<ApiFiler[]>(this.base, { params: { q } }).pipe(
      map(list => list.map(mapApiFiler)),
      tap(filers => this.cachedFilers.set(filers))
    );
  }

  getById(id: number): Observable<TaxseerFiler> {
    return this.http.get<ApiFiler>(`${this.base}/${id}`).pipe(map(mapApiFiler));
  }

  create(f: any): Observable<TaxseerFiler> {
    return this.http.post<ApiFiler>(this.base, f).pipe(map(mapApiFiler));
  }

  update(id: number, f: any): Observable<TaxseerFiler> {
    return this.http.put<ApiFiler>(`${this.base}/${id}`, f).pipe(map(mapApiFiler));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }
}

/** Converts a frontend TaxseerFiler to the API request body (comma-separated formsUsed). */
function toApiFiler(f: TaxseerFiler): ApiFiler {
  return {
    id: f.id,
    name: f.name,
    ein: f.ein,
    address: f.address,
    address2: f.address2,
    city: f.city,
    state: f.state,
    zip: f.zip,
    email: f.email,
    phone: f.phone,
    stateId: f.stateId,
    name2: f.name2,
    mask: f.mask,
    formsUsed: f.formsUsed.join(','),
    pendingCount: f.pending,
    readyCount: f.ready,
    filedCount: f.filed,
    w9Total: f.w9Total,
    w9Required: f.w9Required,
    w9Received: f.w9Received,
    warning: f.warning,
  };
}
