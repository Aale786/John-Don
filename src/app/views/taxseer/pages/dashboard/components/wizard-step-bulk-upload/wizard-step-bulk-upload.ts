import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-wizard-step-bulk-upload',
  standalone: true,
  imports: [MatButtonModule, MatChipsModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './wizard-step-bulk-upload.html',
})
export class WizardStepBulkUploadComponent {
  readonly ds = inject(DashboardService);
}
