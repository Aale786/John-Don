
export type FilerRecipient = {
  id: string;
  filerId: number;
  type: 'SSN' | 'EIN';
  tin: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  add?:string;
  econsent?: boolean;
  w9: 'Requested' | 'Submitted' | 'Not requested';
};

export const FILER_RECIPIENTS: FilerRecipient[] = [
  {
    id: 'r1', filerId: 1, type: 'SSN',
    tin: '888222330', name: 'Mark Waugh',
    address: '101 Market St', city: 'Rockville',
    state: 'MD', zip: '20850',
    email: 'mark.waugh@example.com', w9: 'Requested',econsent: false
  },
  {
    id: 'r2', filerId: 1, type: 'SSN',
    tin: '111235678', name: 'Derek Randal',
    address: '20 East Bank St', city: '',
    state: 'MENDOZA', zip: '',
    email: '', w9: 'Submitted',econsent: false
  },
  {
    id: 'r3', filerId: 1, type: 'SSN',
    tin: '88765878', name: 'Tariq Fateh',
    address: '36 Market Street', city: 'Gaithersburg',
    state: 'MD', zip: '20878',
    email: '', w9: 'Not requested',econsent: false
  },
  {
    id: 'r4', filerId: 1, type: 'SSN',
    tin: '402119021', name: 'Priya Nair',
    address: '55 Oak Ave', city: 'San Jose',
    state: 'CA', zip: '95112',
    email: 'priya.nair@example.com', w9: 'Submitted',econsent: false
  },
  {
    id: 'r5', filerId: 1, type: 'EIN',
    tin: '521234102', name: 'Hillside Legal Group PC',
    address: '1 Court Sq', city: 'Towson',
    state: 'MD', zip: '21204',
    email: 'billing@hillsidelegal.example', w9: 'Submitted',econsent: false
  },
  {
    id: 'r6', filerId: 1, type: 'EIN',
    tin: '540987730', name: 'Rockcreek Office LLC',
    address: '800 Rock Creek Pkwy', city: 'Arlington',
    state: 'VA', zip: '22201',
    email: '', w9: 'Submitted',econsent: false
  },
  {
    id: 'r7', filerId: 9, type: 'SSN',
    tin: '219554411', name: 'Jose Ortega',
    address: '4 Elm Ct', city: 'Laurel',
    state: 'MD', zip: '20707',
    email: '', w9: 'Requested',econsent: false
  },
  {
    id: 'r8', filerId: 9, type: 'EIN',
    tin: '271117654', name: 'Blue Ridge Couriers',
    address: '77 Route 1', city: 'Elkridge',
    state: 'MD', zip: '21075',
    email: '', w9: 'Submitted',econsent: false
  },
];

export type FilingStatus =
  | 'Pending'
  | 'Completed'
  | 'In cart'
  | 'Submitted'
  | 'Accepted'
  | 'Rejected';

export type FilerFiling = {
  id: string;
  filerId: number;
  taxYear: number;
  form: string;
  recipient: string;
  tin: string;
  amount: number | null;
  status: FilingStatus;
  edited: string;
  order?: string;
  issue?: string;
}

const ACCEPTED_RECIPIENTS = [
  'Aaron Adams', 'Bianca Brooks', 'Carlos Chen', 'Dana Diaz',
  'Elif Evans', 'Farah Foster', 'Grant Garcia', 'Hana Hughes',
  'Isaac Iqbal', 'Jada Jensen', 'Kofi Kim', 'Lena Lopez',
  'Marco Moore', 'Nia Nguyen', 'Owen Ortiz', 'Pooja Patel',
  'Quinn Reyes', 'Rosa Shah', 'Sam Turner', 'Tara Vance',
  'Uma Adams', 'Victor Brooks', 'Wes Chen', 'Ximena Diaz',
  'Yusuf Evans', 'Zoe Foster', 'Ana Garcia', 'Ben Hughes',
  'Cleo Iqbal',
];

type AcceptedSeed = {
  filerId: number;
  taxYear: number;
  count: number;
  miscFrom: number;
  order: string;
  edited: string;
  base: number;
  step: number;
}

function acceptedFilings(seed: AcceptedSeed): FilerFiling[] {
  return ACCEPTED_RECIPIENTS.slice(0, seed.count).map((name, i) => ({
    id: `a${seed.taxYear}-${i}`,
    filerId: seed.filerId,
    taxYear: seed.taxYear,
    form: i < seed.miscFrom ? '1099-NEC' : '1099-MISC',
    recipient: name,
    tin: `•••-••-${String(1000 + i * 37).slice(-4)}`,
    amount: seed.base + ((i * seed.step) % 22000),
    status: 'Accepted' as FilingStatus,
    order: seed.order,
    edited: seed.edited,
  }));
}

export const FILER_FILINGS: FilerFiling[] = [
  {
    id: 'f1', filerId: 1, taxYear: 2025, form: '1099-NEC',
    recipient: 'Mark Waugh', tin: '•••-••-2330',
    amount: null, status: 'Pending', order: undefined,
    issue: 'Box 1 is empty', edited: 'Jan 13, 2026',
  },
  {
    id: 'f2', filerId: 1, taxYear: 2025, form: '1099-NEC',
    recipient: 'Priya Nair', tin: '•••-••-9021',
    amount: 9800, status: 'Completed', edited: 'Jan 12, 2026',
  },
  {
    id: 'f3', filerId: 1, taxYear: 2025, form: '1099-MISC',
    recipient: 'Rockcreek Office LLC', tin: '54-0987730',
    amount: 24000, status: 'Completed', edited: 'Jan 12, 2026',
  },
  {
    id: 'f4', filerId: 1, taxYear: 2025, form: '1099-NEC',
    recipient: 'Hillside Legal Group PC', tin: '52-1234102',
    amount: 12000, status: 'In cart', edited: 'Jan 11, 2026',
  },
  ...acceptedFilings({
    filerId: 1, taxYear: 2025, count: 29, miscFrom: 26,
    order: '20261160', edited: 'Jan 8, 2026', base: 1800, step: 7331,
  }),
  ...acceptedFilings({
    filerId: 1, taxYear: 2024, count: 25, miscFrom: 25,
    order: '20251102', edited: 'Jan 27, 2025', base: 1500, step: 5113,
  }),
  {
    id: 'f5', filerId: 9, taxYear: 2025, form: '1099-NEC',
    recipient: 'Jose Ortega', tin: '•••-••-4411',
    amount: null, status: 'Pending', issue: 'Box 1 is empty',
    edited: 'Jan 10, 2026',
  },
  {
    id: 'f6', filerId: 2, taxYear: 2025, form: 'W-2',
    recipient: 'Employee records', tin: '—',
    amount: 0, status: 'Accepted', order: '20261198',
    edited: 'Jan 10, 2026',
  },
];

export type FilerDownload = {
  id: string;
  filerId: number;
  by: string;
  date: string;
  type: string;
  forms: number;
  status: 'Ready' | 'Preparing' | 'Expired';
}

export const DOWNLOAD_TYPES = [
  'Recipient copies (Copy B), PDF',
  'Filer copies (Copy C), PDF',
  'State copies (Copy 1), PDF',
  'IRS acceptance acknowledgment',
  'All data, Excel',
];

export const FILER_DOWNLOADS: FilerDownload[] = [
  {
    id: 'd1', filerId: 1, by: 'Mary Pierce',
    date: 'Jan 9, 2026 4:12 PM',
    type: 'Recipient copies (Copy B), PDF',
    forms: 29, status: 'Ready',
  },
  {
    id: 'd2', filerId: 1, by: 'Mary Pierce',
    date: 'Jan 8, 2026 11:30 AM',
    type: 'IRS acceptance acknowledgment',
    forms: 29, status: 'Ready',
  },
  {
    id: 'd3', filerId: 1, by: 'Raj Mehta',
    date: 'Jan 28, 2025 9:02 AM',
    type: 'Filer copies (Copy C), PDF',
    forms: 25, status: 'Expired',
  },
];

export const FILING_STEPS: {
  status: FilingStatus;
  hint: string;
  pill: string;
}[] = [
  { status: 'Pending', hint: 'Missing information', pill: 'p-warn' },
  { status: 'Completed', hint: 'Ready for the cart', pill: 'p-info' },
  { status: 'In cart', hint: 'Waiting for checkout', pill: 'p-neutral' },
  { status: 'Submitted', hint: 'With IRS / SSA', pill: 'p-info' },
  { status: 'Accepted', hint: 'Filed', pill: 'p-ok' },
  { status: 'Rejected', hint: 'Fix and resubmit', pill: 'p-err' },
];

export const STEP_HELP: Record<FilingStatus, string> = {
  Pending:
    'Open a form to finish it. It moves to Completed when every required box is filled.',
  Completed: 'Select forms and add them to the cart to e-file.',
  'In cart': 'Check out from the cart to e-file these forms.',
  Submitted:
    'Waiting for the IRS or SSA to accept. Status updates automatically.',
  Accepted: 'Accepted forms can be corrected if something changes.',
  Rejected: 'Open a rejected form to see the reason and resubmit.',
};
