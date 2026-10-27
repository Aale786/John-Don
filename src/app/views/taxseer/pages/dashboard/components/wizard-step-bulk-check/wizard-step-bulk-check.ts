import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-wizard-step-bulk-check',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatChipsModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  templateUrl: './wizard-step-bulk-check.html',
})
export class WizardStepBulkCheckComponent {
  readonly ds = inject(DashboardService);
}
