import { Component, inject } from '@angular/core';
import { NgClass, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-wizard-step-amounts',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatChipsModule, MatCheckboxModule, MatInputModule, MatSelectModule, DecimalPipe],
  templateUrl: './wizard-step-amounts.html',
})
export class WizardStepAmountsComponent {
  readonly ds = inject(DashboardService);
}
