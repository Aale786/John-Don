export type OrderStatus = 'rejected' | 'in-process' | 'accepted';

export type TaxseerOrder = {
    id: string;
    filerName: string;
    formSummary: string;
    placedDate: string;
    taxYear: number;
    forms: number;
    amount: number;
    status: OrderStatus;
    rejectedForms: number;
    acceptedForms: number;
    recipientCopies: string;
    downloadable: boolean;

    detail?: {
        filingType: string;
        submissionId: string;
        submittedAt: string;
        recipients: number;
        acceptedRecipients: number;
        rejectedRecipients: number;
        notes: string;
    };
}

export const TAXSEER_ORDERS: TaxseerOrder[] = [
    {
        id: '20261204',
        filerName: 'Nextlinx Technologies Inc',
        formSummary: 'W-2',
        placedDate: 'Jan 11, 2026',
        taxYear: 2025,
        forms: 130,
        amount: 260,
        status: 'rejected',
        rejectedForms: 2,
        acceptedForms: 128,
        recipientCopies: 'Held until corrected',
        downloadable: true,
        detail: {
            filingType: 'W-2',
            submissionId: 'IRS-2026-1204-01',
            submittedAt: 'Jan 11, 2026',
            recipients: 130,
            acceptedRecipients: 128,
            rejectedRecipients: 2,
            notes: 'Two recipient records were rejected and require correction.',
        },
    },

    {
        id: '20261198',
        filerName: 'Maryland Trucking Company',
        formSummary: 'W-2',
        placedDate: 'Jan 10, 2026',
        taxYear: 2025,
        forms: 49,
        amount: 98,
        status: 'in-process',
        rejectedForms: 0,
        acceptedForms: 0,
        recipientCopies: 'Sends on acceptance',
        downloadable: false,
        detail: {
            filingType: 'W-2',
            submissionId: 'IRS-2026-1198-01',
            submittedAt: 'Jan 10, 2026',
            recipients: 49,
            acceptedRecipients: 0,
            rejectedRecipients: 0,
            notes: 'Submission is currently being processed.',
        },
    },

    {
        id: '20261197',
        filerName: 'Maryland Trucking Company',
        formSummary: '1099-NEC',
        placedDate: 'Jan 10, 2026',
        taxYear: 2025,
        forms: 12,
        amount: 24,
        status: 'rejected',
        rejectedForms: 1,
        acceptedForms: 11,
        recipientCopies: 'Held until corrected',
        downloadable: true,
        detail: {
            filingType: '1099-NEC',
            submissionId: 'IRS-2026-1197-01',
            submittedAt: 'Jan 10, 2026',
            recipients: 12,
            acceptedRecipients: 11,
            rejectedRecipients: 1,
            notes: 'One recipient record was rejected and requires correction.',
        },
    },

    {
        id: '20261160',
        filerName: 'Tech International Corporation',
        formSummary: '1099-NEC, 1099-MISC',
        placedDate: 'Jan 8, 2026',
        taxYear: 2025,
        forms: 29,
        amount: 58,
        status: 'accepted',
        rejectedForms: 0,
        acceptedForms: 29,
        recipientCopies: '29 emailed',
        downloadable: true,
        detail: {
            filingType: '1099-NEC, 1099-MISC',
            submissionId: 'IRS-2026-1160-01',
            submittedAt: 'Jan 8, 2026',
            recipients: 29,
            acceptedRecipients: 29,
            rejectedRecipients: 0,
            notes: 'Filing accepted successfully.',
        },
    },

    {
        id: '20251102',
        filerName: 'Tech International Corporation',
        formSummary: '1099-NEC',
        placedDate: 'Jan 27, 2025',
        taxYear: 2024,
        forms: 25,
        amount: 50,
        status: 'accepted',
        rejectedForms: 0,
        acceptedForms: 25,
        recipientCopies: '21 emailed, 4 mailed',
        downloadable: true,
        detail: {
            filingType: '1099-NEC',
            submissionId: 'IRS-2025-1102-01',
            submittedAt: 'Jan 27, 2025',
            recipients: 25,
            acceptedRecipients: 25,
            rejectedRecipients: 0,
            notes: 'Filing accepted successfully.',
        },
    },

    {
        id: '20261144',
        filerName: 'Infinite Technologies',
        formSummary: '1099-NEC, 1099-MISC',
        placedDate: 'Jan 7, 2026',
        taxYear: 2025,
        forms: 31,
        amount: 62,
        status: 'accepted',
        rejectedForms: 0,
        acceptedForms: 31,
        recipientCopies: 'Available',
        downloadable: true,
        detail: {
            filingType: '1099-NEC, 1099-MISC',
            submissionId: 'IRS-2026-1144-01',
            submittedAt: 'Jan 7, 2026',
            recipients: 31,
            acceptedRecipients: 31,
            rejectedRecipients: 0,
            notes: 'Filing accepted successfully.',
        },
    },

    {
        id: '20261102',
        filerName: 'New York Accounting',
        formSummary: '1099-NEC',
        placedDate: 'Jan 5, 2026',
        taxYear: 2025,
        forms: 4,
        amount: 8,
        status: 'accepted',
        rejectedForms: 0,
        acceptedForms: 4,
        recipientCopies: 'Available',
        downloadable: true,
        detail: {
            filingType: '1099-NEC',
            submissionId: 'IRS-2026-1102-01',
            submittedAt: 'Jan 5, 2026',
            recipients: 4,
            acceptedRecipients: 4,
            rejectedRecipients: 0,
            notes: 'Filing accepted successfully.',
        },
    },

    {
        id: '20261081',
        filerName: 'Avi Enterprises',
        formSummary: '1099-MISC',
        placedDate: 'Jan 3, 2026',
        taxYear: 2025,
        forms: 16,
        amount: 32,
        status: 'accepted',
        rejectedForms: 0,
        acceptedForms: 16,
        recipientCopies: 'Available',
        downloadable: true,
        detail: {
            filingType: '1099-MISC',
            submissionId: 'IRS-2026-1081-01',
            submittedAt: 'Jan 3, 2026',
            recipients: 16,
            acceptedRecipients: 16,
            rejectedRecipients: 0,
            notes: 'Filing accepted successfully.',
        },
    },

    {
        id: '20261055',
        filerName: 'Precise Technologies Inc',
        formSummary: '1099-NEC',
        placedDate: 'Jan 2, 2026',
        taxYear: 2025,
        forms: 11,
        amount: 72,
        status: 'accepted',
        rejectedForms: 0,
        acceptedForms: 11,
        recipientCopies: 'Available',
        downloadable: true,
        detail: {
            filingType: '1099-NEC',
            submissionId: 'IRS-2026-1055-01',
            submittedAt: 'Jan 2, 2026',
            recipients: 11,
            acceptedRecipients: 11,
            rejectedRecipients: 0,
            notes: 'Filing accepted successfully.',
        },
    },
];