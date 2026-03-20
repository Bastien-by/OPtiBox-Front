import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DepositpageComponent } from './depositpage.component';

describe('DepositpageComponent', () => {
  let component: DepositpageComponent;
  let fixture: ComponentFixture<DepositpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DepositpageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(DepositpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
