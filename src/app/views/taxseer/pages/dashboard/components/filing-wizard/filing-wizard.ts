import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { DashboardService } from '../../dashboard.service';
import { WizardStepFilerComponent } from '../wizard-step-filer/wizard-step-filer';
import { WizardStepFormComponent } from '../wizard-step-form/wizard-step-form';
import { WizardStepRecipientsComponent } from '../wizard-step-recipients/wizard-step-recipients';
import { WizardStepBulkUploadComponent } from '../wizard-step-bulk-upload/wizard-step-bulk-upload';
import { WizardStepAmountsComponent } from '../wizard-step-amounts/wizard-step-amounts';
import { WizardStepBulkCheckComponent } from '../wizard-step-bulk-check/wizard-step-bulk-check';
import { WizardStepReviewComponent } from '../wizard-step-review/wizard-step-review';

@Component({
  selector: 'app-filing-wizard',
  standalone: true,
  imports: [
    MatButtonModule, MatTabsModule, MatChipsModule,
    WizardStepFilerComponent, WizardStepFormComponent,
    WizardStepRecipientsComponent, WizardStepBulkUploadComponent,
    WizardStepAmountsComponent, WizardStepBulkCheckComponent,
    WizardStepReviewComponent,
  ],
  templateUrl: './filing-wizard.html',
})
export class FilingWizardComponent {
  readonly ds = inject(DashboardService);
}
