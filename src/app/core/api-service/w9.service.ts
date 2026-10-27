import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class W9Service {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/w9`;

  getByFiler(filerId: number): Observable<any[]> {
    return this.http.get<any[]>(this.base, { params: { filerId } });
  }

  sendRequest(recipientId: number, filerId: number): Observable<any> {
    return this.http.post<any>(`${this.base}/send`, { recipientId, filerId });
  }

  remind(id: number): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/remind`, {});
  }

  markReceived(id: number): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/received`, {});
  }
}
