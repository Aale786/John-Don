import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { DashboardService } from '../../dashboard.service';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatChipsModule, MatInputModule],
  templateUrl: './dashboard-home.html',
})
export class DashboardHomeComponent {
  readonly ds = inject(DashboardService);
}
