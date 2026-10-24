import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TaxseerOrder } from '../../views/taxseer/pages/orders/orders.data';
import { API_BASE } from './api.config';

/** Raw shape returned by the Java backend (totalForms instead of forms). */
type ApiOrder = Omit<TaxseerOrder, 'forms' | 'detail'> & {
  /** Backend field name */
  totalForms: number;
  submissionId?: string;
  submittedAt?: string;
  recipients?: number;
  acceptedRecipients?: number;
  rejectedRecipients?: number;
  notes?: string;
};

function mapApiOrder(o: ApiOrder): TaxseerOrder {
  return {
    id: o.id,
    filerName: o.filerName ?? '',
    formSummary: o.formSummary ?? '',
    placedDate: o.placedDate ?? '',
    taxYear: o.taxYear,
    forms: o.totalForms ?? 0,
    amount: o.amount ?? 0,
    status: (o.status as TaxseerOrder['status']) ?? 'accepted',
    rejectedForms: o.rejectedForms ?? 0,
    acceptedForms: o.acceptedForms ?? 0,
    recipientCopies: o.recipientCopies ?? '',
    downloadable: o.downloadable ?? false,
    detail: o.submissionId ? {
      filingType: o.formSummary ?? '',
      submissionId: o.submissionId ?? '',
      submittedAt: o.submittedAt ?? '',
      recipients: o.recipients ?? 0,
      acceptedRecipients: o.acceptedRecipients ?? 0,
      rejectedRecipients: o.rejectedRecipients ?? 0,
      notes: o.notes ?? '',
    } : undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/orders`;

  getAll(params?: { status?: string; q?: string; filerId?: number }): Observable<TaxseerOrder[]> {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.q) httpParams = httpParams.set('q', params.q);
    if (params?.filerId != null) httpParams = httpParams.set('filerId', params.filerId);
    return this.http.get<ApiOrder[]>(this.base, { params: httpParams }).pipe(map(list => list.map(mapApiOrder)));
  }

  getById(id: string): Observable<TaxseerOrder> {
    return this.http.get<ApiOrder>(`${this.base}/${id}`).pipe(map(mapApiOrder));
  }
}
