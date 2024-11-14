import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RacinePageComponent } from './racine-page.component';

describe('RacinePageComponent', () => {
  let component: RacinePageComponent;
  let fixture: ComponentFixture<RacinePageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RacinePageComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(RacinePageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
