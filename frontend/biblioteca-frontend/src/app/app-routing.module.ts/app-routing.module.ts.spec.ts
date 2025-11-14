import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppRoutingModuleTs } from './app-routing.module.ts';

describe('AppRoutingModuleTs', () => {
  let component: AppRoutingModuleTs;
  let fixture: ComponentFixture<AppRoutingModuleTs>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppRoutingModuleTs]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AppRoutingModuleTs);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
