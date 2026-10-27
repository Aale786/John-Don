import { Component, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-wizard-step-recipients',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatButtonToggleModule, MatCheckboxModule, MatChipsModule],
  templateUrl: './wizard-step-recipients.html',
})
export class WizardStepRecipientsComponent {
  readonly ds = inject(DashboardService);
}
