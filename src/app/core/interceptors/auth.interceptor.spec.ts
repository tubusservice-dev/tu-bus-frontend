import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '@env';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

/**
 * The session token must reach our own API and nothing else: any future
 * third-party integration made through HttpClient would otherwise receive it.
 */
describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: {
            getToken: () => 'jwt-token',
            isAuthenticated: () => true,
            handleSessionExpired: () => {},
            triggerAccountBlocked: () => {},
          },
        },
      ],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('attaches the token to our own API', () => {
    http.get(`${environment.apiUrl}/orders`).subscribe();

    const req = httpMock.expectOne(`${environment.apiUrl}/orders`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-token');
    req.flush({});
  });

  it('does not leak the token to a third-party host', () => {
    http.get('https://api.thirdparty.example/v1/track').subscribe();

    const req = httpMock.expectOne('https://api.thirdparty.example/v1/track');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });

  it('does not leak the token to another host of the same company', () => {
    http.get('https://cdn.tubusexpress.com/assets/data.json').subscribe();

    const req = httpMock.expectOne('https://cdn.tubusexpress.com/assets/data.json');
    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
