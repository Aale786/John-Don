import { isCompleteTin, normalizeTin } from './tin';

describe('TIN helpers', () => {
  it('strips punctuation and caps at 9 digits', () => {
    expect(normalizeTin('123-45-6789')).toBe('123456789');
    expect(normalizeTin('12-3456789 extra')).toBe('123456789');
    expect(normalizeTin('12-34567890')).toBe('123456789');
  });

  it('treats only a full 9-digit value as complete', () => {
    expect(isCompleteTin('123-45-6789')).toBe(true);
    expect(isCompleteTin('12345678')).toBe(false);
    expect(isCompleteTin('')).toBe(false);
  });
});
