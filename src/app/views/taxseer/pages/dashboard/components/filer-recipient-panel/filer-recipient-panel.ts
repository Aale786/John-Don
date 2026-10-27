import { Component, HostListener, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatRadioModule } from '@angular/material/radio';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-filer-recipient-panel',
  standalone: true,
  imports: [NgClass, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule, MatCheckboxModule],
  templateUrl: './filer-recipient-panel.html',
})
export class FilerRecipientPanelComponent {
  readonly ds = inject(DashboardService);

  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    if (this.ds.panelOpen()) {
      this.ds.closePanel();
    }
  }
}
