import { necRowErrors, necRowWarnings, type NecAmountRow } from './nec-amounts.types';

function row(overrides: Partial<NecAmountRow> = {}): NecAmountRow {
  return {
    id: '1',
    name: 'Ada',
    tin: '123456789',
    address: '1 Main',
    box1: 700,
    box4: null,
    box5: null,
    state: '',
    payerStateNumber: '',
    box7: null,
    box2: false,
    box3: null,
    accountNumber: '',
    secondTin: false,
    recipientIssues: [],
    warning: '',
    expanded: false,
    ...overrides,
  };
}

describe('necRowErrors', () => {
  it('requires Box 1, Box 3, or Box 2', () => {
    expect(necRowErrors(row({ box1: null }))).toContain(
      'Enter Box 1, Box 3 or check Box 2'
    );
    expect(necRowErrors(row({ box1: 700 }))).toEqual([]);
  });

  it('rejects federal withholding above Box 1', () => {
    expect(necRowErrors(row({ box1: 100, box4: 150 }))).toContain(
      'Box 4 is more than Box 1'
    );
  });

  it('requires a state when Box 5 or 7 is filled', () => {
    expect(necRowErrors(row({ box5: 10, state: '' }))).toContain(
      'Choose a state for Box 5–7'
    );
  });
});

describe('necRowWarnings', () => {
  it('notes amounts below the $600 threshold', () => {
    expect(necRowWarnings(row({ box1: 500 }))).toContain(
      'Below the $600 threshold for 2025. You can still file.'
    );
  });
});
