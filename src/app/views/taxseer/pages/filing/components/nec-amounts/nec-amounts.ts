import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    Output,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatChipsModule } from '@angular/material/chips';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { US_STATES } from '../../../../data/taxseer-filers.data';

export type NecAmountRow = {
    id: string;
    name: string;
    tin: string;
    address: string;

    box1: number | null;
    box4: number | null;
    box5: number | null;

    state: string;
    payerStateNumber: string;
    box7: number | null;

    box2: boolean;
    box3: number | null;
    accountNumber: string;
    secondTin: boolean;

    recipientIssues: string[];
    warning: string;
    expanded: boolean;
}

type AmountBox = 'box1' | 'box3' | 'box4' | 'box5' | 'box7';

export function necRowErrors(row: NecAmountRow): string[] {
    const issues = row.recipientIssues.length
        ? [`Recipient: ${row.recipientIssues.join(', ')}`]
        : [];

    if (!Number(row.box1) && !Number(row.box3) && !row.box2) {
        issues.push('Enter Box 1, Box 3 or check Box 2');
    }

    if (Number(row.box4) > 0 && Number(row.box1) > 0 && row.box4! > row.box1!) {
        issues.push('Box 4 is more than Box 1');
    }

    if ((Number(row.box5) || Number(row.box7)) && !row.state) {
        issues.push('Choose a state for Box 5–7');
    }

    return issues;
}

export function necRowWarnings(row: NecAmountRow): string[] {
    const notes: string[] = [];

    if (Number(row.box1) > 0 && row.box1! < 600) {
        notes.push('Below the $600 threshold for 2025. You can still file.');
    }

    if (row.warning && !Number(row.box4)) {
        notes.push(row.warning);
    }

    return notes;
}

@Component({
    selector: 'taxseer-nec-amounts',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatChipsModule,
        MatInputModule,
        MatSelectModule,
    ],
    templateUrl: './nec-amounts.html',
})
export class NecAmountsComponent {
    @Input() rows: NecAmountRow[] = [];

    @Input() payerName = '';
    @Input() payerTin = '';
    @Input() payerAddress = '';
    @Input() payerState = 'MD';
    @Input() payerStateNumber = '';

    @Output() rowsChange = new EventEmitter<NecAmountRow[]>();
    @Output() preview = new EventEmitter<void>();
    @Output() fixRecipient = new EventEmitter<string>();

    readonly states = US_STATES;

    get totalBox1(): number {
        return this.sum('box1');
    }

    get totalBox4(): number {
        return this.sum('box4');
    }

    get totalBox5(): number {
        return this.sum('box5');
    }

    get totalBox7(): number {
        return this.sum('box7');
    }

    get formCount(): number {
        return this.rows.length;
    }

    private sum(
        key: 'box1' | 'box4' | 'box5' | 'box7'
    ): number {
        return this.rows.reduce(
            (total, row) => total + (Number(row[key]) || 0),
            0
        );
    }

    errors(row: NecAmountRow): string[] {
        return necRowErrors(row);
    }

    warnings(row: NecAmountRow): string[] {
        return necRowWarnings(row);
    }

    hasError(row: NecAmountRow): boolean {
        return necRowErrors(row).length > 0;
    }

    status(row: NecAmountRow): string {
        if (this.hasError(row)) {
            return 'Fix';
        }

        return this.warnings(row).length ? 'Check' : 'Ready';
    }

    statusClass(row: NecAmountRow): string {
        if (this.hasError(row)) {
            return 'p-err';
        }

        return this.warnings(row).length ? 'p-warn' : 'p-ok';
    }

    boxLabel(row: NecAmountRow, box: AmountBox): string {
        return `${box.replace('box', 'Box ')} for ${row.name}`;
    }

    toggleRow(row: NecAmountRow): void {
        row.expanded = !row.expanded;
        this.emitChanges();
    }

    usePayerStateForAll(): void {
        for (const row of this.rows) {
            row.state = this.payerState;
            row.payerStateNumber = this.payerStateNumber;
        }

        this.emitChanges();
    }

    onStateChange(row: NecAmountRow, code: string): void {
        row.state = code;

        if (code === this.payerState && !row.payerStateNumber) {
            row.payerStateNumber = this.payerStateNumber;
        }

        this.emitChanges();
    }

    onAmountChange(
        row: NecAmountRow,
        field: AmountBox,
        value: number | null
    ): void {
        row[field] = value;
        this.emitChanges();
    }

    emitChanges(): void {
        this.rowsChange.emit(
            this.rows.map(row => ({ ...row }))
        );
    }
}


