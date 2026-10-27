import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatRadioModule } from '@angular/material/radio';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-wizard-step-filer',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatRadioModule],
  templateUrl: './wizard-step-filer.html',
})
export class WizardStepFilerComponent {
  readonly ds = inject(DashboardService);
}
