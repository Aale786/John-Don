import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';
import { AddToCartComponent } from '../../../../components/add-to-cart/add-to-cart';

@Component({
  selector: 'app-wizard-step-review',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatSelectModule, AddToCartComponent],
  templateUrl: './wizard-step-review.html',
})
export class WizardStepReviewComponent {
  readonly ds = inject(DashboardService);
}
