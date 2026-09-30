import { describe, expect, it } from 'vitest';
import { manualLoopRequested } from '../../src/config/flags';

describe('manualLoopRequested', () => {
  it('is off unless the loop is named manual', () => {
    expect(manualLoopRequested('')).toBe(false);
    expect(manualLoopRequested('?loop=auto')).toBe(false);
    expect(manualLoopRequested('?loop=manual')).toBe(true);
    expect(manualLoopRequested('?debug=1&loop=manual')).toBe(true);
  });
});
