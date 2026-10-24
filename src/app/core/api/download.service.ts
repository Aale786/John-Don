import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FilerDownload } from '../../views/taxseer/pages/filer-details/filer-details.data';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class DownloadService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/downloads`;

  getByFiler(filerId: number): Observable<FilerDownload[]> {
    return this.http.get<FilerDownload[]>(this.base, { params: { filerId } });
  }

  create(download: Partial<FilerDownload>): Observable<FilerDownload> {
    return this.http.post<FilerDownload>(this.base, download);
  }
}
