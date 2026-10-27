import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { authInterceptor, isTaxseerApiRequest } from './auth.interceptor';
import { AuthService } from './auth.service';

describe('isTaxseerApiRequest', () => {
  it('allows same-origin /api paths used by the Angular proxy', () => {
    expect(isTaxseerApiRequest('/api/filers')).toBe(true);
    expect(isTaxseerApiRequest('/i18n/en.json')).toBe(false);
  });

  it('does not treat third-party URLs as our API', () => {
    expect(isTaxseerApiRequest('https://evil.example/api/filers')).toBe(false);
    expect(isTaxseerApiRequest('http://localhost:8080/api/filers')).toBe(false);
  });
});

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let token: string | null;

  beforeEach(() => {
    token = 'demo-token-1';
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { token: () => token },
        },
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('attaches the bearer token to Taxseer API calls', () => {
    http.get('/api/filers').subscribe();
    const req = httpMock.expectOne('/api/filers');
    expect(req.request.headers.get('Authorization')).toBe('Bearer demo-token-1');
    req.flush([]);
  });

  it('does not attach the token to login', () => {
    http.post('/api/auth/login', {}).subscribe();
    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('does not attach the token to third-party URLs', () => {
    http.get('https://cdn.example/data.json').subscribe();
    const req = httpMock.expectOne('https://cdn.example/data.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });
});
