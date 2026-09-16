import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;

  const setup = async (inputs: Record<string, unknown> = {}) => {
    await TestBed.configureTestingModule({
      imports: [ConfirmDialogComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.componentRef.setInput('title', 'Eliminar sucursal');
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    fixture.detectChanges();
    return fixture;
  };

  const query = (selector: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(selector);

  const confirmButton = () => query('.cd-btn-confirm') as HTMLButtonElement;
  const cancelButton = () => query('.cd-btn-cancel') as HTMLButtonElement;

  it('Given closed — should render nothing', async () => {
    await setup();
    fixture.componentRef.setInput('isOpen', false);
    fixture.detectChanges();

    expect(query('.cd-dialog')).toBeNull();
  });

  it('Given a title and message — should render both', async () => {
    await setup({ message: '¿Eliminar Valencia Centro?' });

    expect(query('.cd-title')?.textContent).toContain('Eliminar sucursal');
    expect(query('.cd-message')?.textContent).toContain('¿Eliminar Valencia Centro?');
  });

  it('Given no message — should not render an empty paragraph', async () => {
    await setup();

    expect(query('.cd-message')).toBeNull();
  });

  it('Given the confirm button clicked — should emit confirmed once', async () => {
    await setup();
    const confirmed = jasmine.createSpy('confirmed');
    fixture.componentInstance.confirmed.subscribe(confirmed);

    confirmButton().click();

    expect(confirmed).toHaveBeenCalledTimes(1);
  });

  it('Given the cancel button clicked — should emit cancelled, not confirmed', async () => {
    await setup();
    const confirmed = jasmine.createSpy('confirmed');
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);

    cancelButton().click();

    expect(cancelled).toHaveBeenCalledTimes(1);
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('Given a click on the backdrop — should cancel', async () => {
    await setup();
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);

    (query('.cd-overlay') as HTMLElement).click();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('Given a click inside the dialog — should not cancel', async () => {
    await setup({ message: 'texto' });
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);

    (query('.cd-dialog') as HTMLElement).click();

    expect(cancelled).not.toHaveBeenCalled();
  });

  it('Given Escape pressed while open — should cancel', async () => {
    await setup();
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.cancelled.subscribe(cancelled);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(cancelled).toHaveBeenCalledTimes(1);
  });

  it('Given busy — should block both buttons so the action cannot double-fire', async () => {
    await setup({ busy: true, busyLabel: 'Eliminando...' });
    const confirmed = jasmine.createSpy('confirmed');
    const cancelled = jasmine.createSpy('cancelled');
    fixture.componentInstance.confirmed.subscribe(confirmed);
    fixture.componentInstance.cancelled.subscribe(cancelled);

    expect(confirmButton().disabled).toBe(true);
    expect(cancelButton().disabled).toBe(true);
    expect(confirmButton().textContent).toContain('Eliminando...');

    // Even if a caller drives the click programmatically, past the disabled
    // attribute, the guard must hold.
    fixture.componentInstance['onConfirm']();
    fixture.componentInstance['onCancel']();

    expect(confirmed).not.toHaveBeenCalled();
    expect(cancelled).not.toHaveBeenCalled();
  });

  it('Given custom labels — should use them', async () => {
    await setup({ confirmLabel: 'Eliminar', cancelLabel: 'Volver' });

    expect(confirmButton().textContent).toContain('Eliminar');
    expect(cancelButton().textContent).toContain('Volver');
  });

  it('Given the danger variant — should mark the confirm button as destructive', async () => {
    await setup();

    expect(confirmButton().classList).toContain('danger');
  });

  it('Given the primary variant — should not mark it as destructive', async () => {
    await setup({ variant: 'primary' });

    expect(confirmButton().classList).not.toContain('danger');
  });

  it('Given an open dialog — should be an alertdialog wired to its title and body', async () => {
    await setup({ message: 'texto' });
    const dialog = query('.cd-dialog') as HTMLElement;

    expect(dialog.getAttribute('role')).toBe('alertdialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe((query('.cd-title') as HTMLElement).id);
    expect(dialog.getAttribute('aria-describedby')).toBe((query('.cd-body') as HTMLElement).id);
  });

  it('Given it just opened — should focus the non-destructive button', async () => {
    await setup();

    expect(document.activeElement).toBe(cancelButton());
  });
});
