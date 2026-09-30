import { describe, expect, it } from 'vitest';
import { manualLoopRequested, rendererRequested } from '../../src/config/flags';

describe('manualLoopRequested', () => {
  it('is off unless the loop is named manual', () => {
    expect(manualLoopRequested('')).toBe(false);
    expect(manualLoopRequested('?loop=auto')).toBe(false);
    expect(manualLoopRequested('?loop=manual')).toBe(true);
    expect(manualLoopRequested('?debug=1&loop=manual')).toBe(true);
  });
});

describe('rendererRequested', () => {
  it('draws in 3D unless 2D is named', () => {
    expect(rendererRequested('')).toBe('3d');
    expect(rendererRequested('?renderer=webgl')).toBe('3d');
    expect(rendererRequested('?renderer=2d')).toBe('2d');
    expect(rendererRequested('?loop=manual&renderer=2d')).toBe('2d');
  });
});
