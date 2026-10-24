import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FilerDownload } from '../../views/taxseer/pages/filer-details/filer-details.data';
import { API_BASE } from './api.config';

/** Raw shape returned by the Java backend. */
type ApiDownload = {
  id: number;
  filerId: number;
  /** Backend field name */
  byUser: string;
  /** Backend field name */
  downloadDate: string;
  /** Backend field name */
  downloadType: string;
  /** Backend field name */
  formsCount: number;
  status: string;
};

function mapApiDownload(d: ApiDownload): FilerDownload {
  return {
    id: String(d.id),
    filerId: d.filerId,
    by: d.byUser ?? '',
    date: d.downloadDate ?? '',
    type: d.downloadType ?? '',
    forms: d.formsCount ?? 0,
    status: (d.status as FilerDownload['status']) ?? 'Ready',
  };
}

@Injectable({ providedIn: 'root' })
export class DownloadService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/downloads`;

  getByFiler(filerId: number): Observable<FilerDownload[]> {
    return this.http.get<ApiDownload[]>(this.base, { params: { filerId } }).pipe(map(list => list.map(mapApiDownload)));
  }

  create(download: Partial<FilerDownload>): Observable<FilerDownload> {
    // Convert frontend shape back to API shape for POST
    const body: Partial<ApiDownload> = {
      filerId: download.filerId,
      byUser: download.by,
      downloadDate: download.date,
      downloadType: download.type,
      formsCount: download.forms,
      status: download.status,
    };
    return this.http.post<ApiDownload>(this.base, body).pipe(map(mapApiDownload));
  }
}
