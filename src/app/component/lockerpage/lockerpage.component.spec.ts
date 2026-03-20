import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LockerpageComponent } from './lockerpage.component';

describe('LockerpageComponent', () => {
  let component: LockerpageComponent;
  let fixture: ComponentFixture<LockerpageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LockerpageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(LockerpageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
