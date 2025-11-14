import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppComponentHtml } from './app.component.html';

describe('AppComponentHtml', () => {
  let component: AppComponentHtml;
  let fixture: ComponentFixture<AppComponentHtml>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponentHtml]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppComponentHtml);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
