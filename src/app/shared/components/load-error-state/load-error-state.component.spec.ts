import { TestBed } from '@angular/core/testing';
import { LoadErrorStateComponent } from './load-error-state.component';

describe('LoadErrorStateComponent', () => {
  const render = (retrying = false) => {
    const fixture = TestBed.createComponent(LoadErrorStateComponent);
    fixture.componentRef.setInput('retrying', retrying);
    fixture.detectChanges();
    return fixture;
  };

  it('tells the customer the products could not load and offers a retry', () => {
    const el: HTMLElement = render().nativeElement;

    expect(el.querySelector('.title')!.textContent).toContain('No pudimos cargar los productos');
    expect(el.querySelector('.message')!.textContent).toContain('Revisa tu conexión a internet');
    expect(el.querySelector('button')!.textContent).toContain('Reintentar');
  });

  it('emits retry when the button is pressed', () => {
    const fixture = render();
    let retried = 0;
    fixture.componentInstance.retry.subscribe(() => retried++);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();

    expect(retried).toBe(1);
  });

  it('blocks the button while a retry is in flight', () => {
    const button: HTMLButtonElement = render(true).nativeElement.querySelector('button');

    expect(button.disabled).toBeTrue();
    expect(button.textContent).toContain('Reintentando');
  });
});
