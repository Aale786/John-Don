import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class RoleService {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_BASE}/api/roles`;

  getAll(): Observable<any[]> {
    return this.http.get<any[]>(this.base);
  }

  update(id: number, r: any): Observable<any> {
    return this.http.put<any>(`${this.base}/${id}`, r);
  }
}
