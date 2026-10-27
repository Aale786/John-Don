import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-wizard-step-form',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatButtonToggleModule, MatChipsModule],
  templateUrl: './wizard-step-form.html',
})
export class WizardStepFormComponent {
  readonly ds = inject(DashboardService);
}
