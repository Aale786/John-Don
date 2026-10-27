import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/users`;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.base);
  }

  getById(id: number): Observable<any> {
    return this.http.get<any>(`${this.base}/${id}`);
  }

  create(u: any): Observable<any> {
    return this.http.post<any>(this.base, u);
  }

  update(id: number, u: any): Observable<any> {
    return this.http.put<any>(`${this.base}/${id}`, u);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`);
  }

  resendInvite(id: number): Observable<any> {
    return this.http.post<any>(`${this.base}/${id}/resend-invite`, {});
  }
}
