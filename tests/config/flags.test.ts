import { describe, expect, it } from 'vitest';
import { manualLoopRequested, rendererChoice } from '../../src/config/flags';

describe('rendererChoice', () => {
  it('defaults to the 2D renderer', () => {
    expect(rendererChoice('')).toBe('2d');
    expect(rendererChoice('?loop=manual')).toBe('2d');
  });

  it('takes the 3D renderer only when asked for exactly', () => {
    expect(rendererChoice('?renderer=3d')).toBe('3d');
    expect(rendererChoice('?loop=manual&renderer=3d')).toBe('3d');
    expect(rendererChoice('?renderer=3D')).toBe('2d');
    expect(rendererChoice('?renderer=three')).toBe('2d');
    expect(rendererChoice('?renderer=2d')).toBe('2d');
  });
});

describe('manualLoopRequested', () => {
  it('is off unless the loop is named manual', () => {
    expect(manualLoopRequested('')).toBe(false);
    expect(manualLoopRequested('?loop=auto')).toBe(false);
    expect(manualLoopRequested('?loop=manual')).toBe(true);
    expect(manualLoopRequested('?renderer=3d&loop=manual')).toBe(true);
  });
});
