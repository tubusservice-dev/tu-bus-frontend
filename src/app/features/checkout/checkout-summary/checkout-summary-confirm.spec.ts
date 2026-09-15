import { signal } from '@angular/core';
import { CheckoutSummaryComponent } from './checkout-summary.component';

/**
 * Regression: clicking the backdrop while "Procesando…" closed the confirm
 * modal but the order was still created two seconds later.
 *
 * The component has many collaborators, so the dismiss handler is exercised
 * directly against a minimal stand-in for its state.
 */
describe('CheckoutSummaryComponent — confirm modal dismissal', () => {
  const onCancelOrder = CheckoutSummaryComponent.prototype.onCancelOrder;

  function stateWith(processing: boolean) {
    return {
      isProcessingConfirm: signal(processing),
      showConfirmModal: signal(true),
      releaseScrollLock: jasmine.createSpy('releaseScrollLock'),
    };
  }

  it('closes the modal when the order has not been confirmed yet', () => {
    const state = stateWith(false);

    onCancelOrder.call(state as unknown as CheckoutSummaryComponent);

    expect(state.showConfirmModal()).toBeFalse();
    expect(state.releaseScrollLock).toHaveBeenCalledTimes(1);
  });

  it('ignores dismissal while the confirmed order is being processed', () => {
    const state = stateWith(true);

    onCancelOrder.call(state as unknown as CheckoutSummaryComponent);

    expect(state.showConfirmModal()).toBeTrue();
    expect(state.releaseScrollLock).not.toHaveBeenCalled();
  });
});
