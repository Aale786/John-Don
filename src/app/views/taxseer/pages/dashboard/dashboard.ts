import { Component, HostListener, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DashboardService } from './dashboard.service';
import { DashboardHomeComponent } from './components/dashboard-home/dashboard-home';
import { FilingWizardComponent } from './components/filing-wizard/filing-wizard';
import { FilerRecipientPanelComponent } from './components/filer-recipient-panel/filer-recipient-panel';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DashboardHomeComponent, FilingWizardComponent, FilerRecipientPanelComponent],
  templateUrl: './dashboard.html',
})
export class TaxseerDashboard implements OnInit {
  readonly ds = inject(DashboardService);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    const params = this.route.snapshot.queryParamMap;
    const filing = params.get('filing');
    if (filing === 'manual' || filing === 'bulk') {
      const year = Number(params.get('year'));
      const filerId = Number(params.get('filerId'));
      if (year >= 2020 && year <= 2100) this.ds.setTaxYear(year);
      this.ds.startFiling(filing, Number.isInteger(filerId) && filerId > 0 ? filerId : undefined);
    }
  }

  ngOnInit(): void {
    this.ds.loadFilers();
  }

  @HostListener('window:keydown.escape')
  onEscapeKey(): void {
    if (this.ds.panelOpen()) {
      this.ds.closePanel();
    } else if (this.ds.chooserOpen()) {
      this.ds.closeChooser();
    }
  }
}
