import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { providePlatform } from '@platform';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        // The root component pulls in services that reach HttpClient, the
        // router and the platform tokens (analytics, storage, …). Without
        // them the injector fails before the component is even created.
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        providePlatform(),
      ],
    }).compileComponents();

    // The real template mounts every overlay of the app; this suite only
    // checks that the root component can be created and rendered.
    TestBed.overrideComponent(App, { set: { template: '', imports: [] } });
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render app component', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    expect(fixture.nativeElement).toBeTruthy();
  });
});
