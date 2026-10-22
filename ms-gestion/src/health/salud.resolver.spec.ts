import { SaludResolver } from './salud.resolver.js';

describe('SaludResolver', () => {
  it('responde ok', () => {
    expect(new SaludResolver().salud()).toBe('ok');
  });
});
