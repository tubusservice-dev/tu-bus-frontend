import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BackDismissService, dismissOnBack } from './back-dismiss.service';

@Component({ standalone: true, template: '' })
class ModalHost {
  readonly open = signal(false);
  closed = 0;
  constructor() {
    dismissOnBack(() => this.open(), () => {
      this.closed++;
      this.open.set(false);
    });
  }
}

describe('BackDismissService', () => {
  let service: BackDismissService;

  beforeEach(() => {
    service = TestBed.inject(BackDismissService);
  });

  it('closes the most recent modal first', () => {
    const calls: string[] = [];
    service.register(() => calls.push('first'));
    service.register(() => calls.push('second'));

    expect(service.dismissTop()).toBeTrue();
    expect(calls).toEqual(['second']);
  });

  it('reports when there is nothing to close', () => {
    expect(service.dismissTop()).toBeFalse();
  });

  it('forgets a modal once it unregisters', () => {
    const calls: string[] = [];
    service.register(() => calls.push('first'));
    const unregister = service.register(() => calls.push('second'));
    unregister();

    service.dismissTop();
    expect(calls).toEqual(['first']);
  });
});

describe('dismissOnBack', () => {
  const create = () => {
    const fixture = TestBed.createComponent(ModalHost);
    fixture.detectChanges();
    return fixture;
  };

  it('lets back close the modal only while it is open', () => {
    const fixture = create();
    const back = TestBed.inject(BackDismissService);

    expect(back.dismissTop()).toBeFalse();

    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    expect(back.dismissTop()).toBeTrue();
    expect(fixture.componentInstance.closed).toBe(1);

    fixture.detectChanges();
    expect(back.dismissTop()).toBeFalse();
  });

  it('unregisters when the modal is destroyed while open', () => {
    const fixture = create();
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();

    fixture.destroy();
    expect(TestBed.inject(BackDismissService).dismissTop()).toBeFalse();
  });
});
