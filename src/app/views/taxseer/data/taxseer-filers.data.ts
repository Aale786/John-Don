import { Injectable, signal } from '@angular/core';

export type TaxseerFiler = {
  id: number;
  name: string;
  ein: string;
  address: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  email: string;
  phone: string;
  stateId: string;
  name2: string;
  mask: boolean;
  formsUsed: string[];
  pending: number;
  ready: number;
  filed: number;
  w9Total: number;
  w9Required: number;
  w9Received: number;
  warning?: string;
}

type FilerSeed = Pick<
  TaxseerFiler,
  'id' | 'name' | 'ein' | 'address' | 'city' | 'state' | 'zip'
> & Partial<TaxseerFiler>;

const SEED: FilerSeed[] = [
  {
    id: 1,
    name: 'Tech International Corporation',
    ein: '111111111',
    address: '200 Trafalgar Square',
    city: 'Gaithersburg',
    state: 'MD',
    zip: '20878',
    email: 'tac_manoj@yahoo.com',
    stateId: 'MD 11111111',
    formsUsed: ['1099-NEC', '1099-MISC'],
    mask: true,
    pending: 1,
    ready: 3,
    filed: 29,
    w9Total: 5,
    w9Required: 1,
    w9Received: 4,
  },
  {
    id: 9,
    name: 'Avi Enterprises',
    ein: '101010101',
    address: '9 Lakeside Dr',
    city: 'Columbia',
    state: 'MD',
    zip: '21044',
    formsUsed: ['1099-NEC'],
    pending: 13,
    w9Total: 2,
    w9Required: 1,
    w9Received: 1,
  },
  {
    id: 6,
    name: 'Precise Technologies Inc',
    ein: '666666666',
    address: '123 Market St',
    city: 'Rockville',
    state: 'MD',
    zip: '20850',
    formsUsed: ['1095-C'],
    pending: 40,
    w9Total: 2,
    w9Required: 2,
  },
  {
    id: 2,
    name: 'Maryland Trucking Company',
    ein: '222222222',
    address: '100 Market Street',
    city: 'Gaithersburg',
    state: 'MD',
    zip: '20878',
    formsUsed: ['1099-NEC', 'W-2'],
    filed: 60,
    w9Total: 1,
    w9Required: 1,
  },
  {
    id: 3,
    name: 'Virginia Technologies',
    ein: '333333333',
    address: '100 Blue Silk Lane',
    city: 'Rockville',
    state: 'MD',
    zip: '20850',
  },
  {
    id: 4,
    name: 'New York Accounting',
    ein: '444444444',
    address: '10 Park St',
    city: 'New York',
    state: 'NY',
    zip: '20878',
    formsUsed: ['1099-NEC', '1099-INT'],
    filed: 4,
    warning: 'ZIP 20878 is not a New York ZIP. Check the filer address.',
  },
  {
    id: 5,
    name: 'Dillon Consulting',
    ein: '555555555',
    address: '1 Market St',
    city: 'Rockville',
    state: 'MD',
    zip: '20850',
    formsUsed: ['1099-NEC'],
  },
  {
    id: 7,
    name: 'Infinite Technologies',
    ein: '777777777',
    address: '111 King James Way',
    city: 'Bethesda',
    state: 'MD',
    zip: '20831',
    formsUsed: ['1099-NEC', '1099-MISC'],
    filed: 31,
  },
  {
    id: 8,
    name: 'Nextlinx Technologies Inc',
    ein: '999999999',
    address: '1 Rayfield Drive',
    city: 'Germantown',
    state: 'MD',
    zip: '20877',
    formsUsed: ['W-2'],
    filed: 128,
  },
];

export const TAXSEER_FILERS: TaxseerFiler[] = SEED.map(f => ({
  id: f.id,
  name: f.name,
  ein: f.ein,
  address: f.address,
  address2: f.address2 ?? '',
  city: f.city,
  state: f.state,
  zip: f.zip,
  email: f.email ?? '',
  phone: f.phone ?? '',
  stateId: f.stateId ?? '',
  name2: f.name2 ?? '',
  mask: f.mask ?? false,
  formsUsed: [...(f.formsUsed ?? [])],
  pending: f.pending ?? 0,
  ready: f.ready ?? 0,
  filed: f.filed ?? 0,
  w9Total: f.w9Total ?? 0,
  w9Required: f.w9Required ?? 0,
  w9Received: f.w9Received ?? 0,
  warning: f.warning,
}));

export const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA',
  'MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY',
  'NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX',
  'UT','VT','VA','WA','WV','WI','WY','AS','GU','MP','PR','VI',
];

export const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas',
  CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware',
  DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii',
  ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas',
  KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska',
  NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico',
  NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island',
  SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  AS: 'American Samoa', GU: 'Guam', MP: 'Northern Mariana Islands',
  PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
};

export const TAX_FORMS = [
  '1099-NEC', '1099-MISC', '1099-INT', '1099-DIV',
  '1099-R', '1099-K', '1099-B', '1099-C', '1099-A',
  '1099-G', '1099-OID', '1099-PATR', '1099-Q',
  '1099-CAP', '1099-H', 'W-2', 'W-2C',
  '1095-C', '1095-B', '8809',
];

export function formatEin(value: string): string {
  const digits = (value ?? '').replace(/\D/g, '');
  return digits.length === 9
    ? `${digits.slice(0, 2)}-${digits.slice(2)}`
    : value;
}

@Injectable({ providedIn: 'root' })
export class TaxseerFilerStore {
  readonly filers = signal<TaxseerFiler[]>(
    TAXSEER_FILERS.map(f => ({ ...f, formsUsed: [...f.formsUsed] }))
  );

  getById(id: number): TaxseerFiler | undefined {
    return this.filers().find(f => f.id === id);
  }

  save(filer: TaxseerFiler): void {
    this.filers.update(items => {
      const exists = items.some(item => item.id === filer.id);

      return exists
        ? items.map(item =>
            item.id === filer.id ? { ...filer } : item
          )
        : [...items, { ...filer }];
    });
  }

  nextId(): number {
    return Math.max(0, ...this.filers().map(f => f.id)) + 1;
  }
}