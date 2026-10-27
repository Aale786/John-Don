/**
 * NEC amount row type and pure validation helpers.
 *
 * Moved here when NecAmountsComponent was deleted — its logic was inlined
 * directly into the dashboard wizard (step 4). These types are kept separate
 * so they can be imported without pulling in any Angular component.
 */

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
};

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
