import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { ExchangeRateService } from '@core/services/exchange-rate.service';
import { CopyableValueComponent } from '@shared/components/copyable-value/copyable-value.component';
import { DateInputComponent } from '@shared/components/date-input/date-input.component';
import { CheckoutPaymentUiService } from '../../services/checkout-payment-ui.service';
import { dismissOnBack } from '@core/services/back-dismiss.service';

/**
 * The payment modal of the checkout summary: account details of the method
 * picked, the amount to pay and, for Pago Móvil / transfer / Zelle, the form
 * where the customer registers the payment.
 *
 * All state lives in CheckoutPaymentUiService, provided by the summary, so
 * this component only renders it; the summary decides when it opens.
 */
@Component({
  selector: 'app-checkout-payment-modal',
  standalone: true,
  imports: [CurrencyPipe, CopyableValueComponent, DateInputComponent],
  templateUrl: './checkout-payment-modal.component.html',
  styleUrl: './checkout-payment-modal.component.scss',
})
export class CheckoutPaymentModalComponent {
  private readonly paymentUi = inject(CheckoutPaymentUiService);
  protected readonly exchangeRateService = inject(ExchangeRateService);

  protected readonly showModal = this.paymentUi.showModal;
  protected readonly selectedGroup = this.paymentUi.selectedGroup;
  protected readonly selectedMethodInModal = this.paymentUi.selectedMethodInModal;
  protected readonly isSubmittingPayment = this.paymentUi.isSubmittingPayment;
  protected readonly formReferenceNumber = this.paymentUi.formReferenceNumber;
  protected readonly formSourceBank = this.paymentUi.formSourceBank;
  protected readonly formSenderName = this.paymentUi.formSenderName;
  protected readonly formAmount = this.paymentUi.formAmount;
  protected readonly formPaymentDate = this.paymentUi.formPaymentDate;
  protected readonly formProofPreview = this.paymentUi.formProofPreview;
  protected readonly isPaymentDateInvalid = this.paymentUi.isPaymentDateInvalid;
  protected readonly copiedAll = this.paymentUi.copiedAll;
  protected readonly venezuelanBanks = this.paymentUi.venezuelanBanks;
  protected readonly infoOnlyMessage = this.paymentUi.infoOnlyMessage;
  protected readonly amountReadonly = this.paymentUi.amountReadonly;

  protected readonly total = () => this.paymentUi.total();
  protected readonly today = () => this.paymentUi.today();
  protected readonly totalUsdRaw = () => this.paymentUi.totalUsdRaw();
  protected readonly totalBsRaw = () => this.paymentUi.totalBsRaw();
  protected readonly getCurrencySymbol = (type?: string) => this.paymentUi.getCurrencySymbol(type);
  protected readonly isFormType = (type: Parameters<CheckoutPaymentUiService['isFormType']>[0]) => this.paymentUi.isFormType(type);
  protected readonly isInfoOnlyType = (type: Parameters<CheckoutPaymentUiService['isInfoOnlyType']>[0]) => this.paymentUi.isInfoOnlyType(type);
  protected readonly referenceLabel = () => this.paymentUi.referenceLabel();
  protected readonly copyAllPaymentDetails = () => this.paymentUi.copyAllPaymentDetails();
  protected readonly closeModal = () => this.paymentUi.closeModal();
  protected readonly selectMethodInModal = (m: Parameters<CheckoutPaymentUiService['selectMethodInModal']>[0]) => this.paymentUi.selectMethodInModal(m);
  protected readonly onFormInput = (field: string, event: Event) => this.paymentUi.onFormInput(field, event);
  protected readonly onProofFileChange = (event: Event) => this.paymentUi.onProofFileChange(event);
  protected readonly removeProofFile = () => this.paymentUi.removeProofFile();
  protected readonly isFormValid = () => this.paymentUi.isFormValid();
  protected readonly submitPayment = () => this.paymentUi.submitPayment();

  constructor() {
    // The Android back button closes this modal like its ✕ does.
    dismissOnBack(() => this.showModal(), () => { if (!this.isSubmittingPayment()) this.closeModal(); });
  }
}
