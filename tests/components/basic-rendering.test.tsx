import { describe, it, expect } from 'vitest';
import * as React from 'react';

describe('Basic Component Tests', () => {
  it('should validate React import', () => {
    expect(typeof React).toBe('object');
    expect(typeof React.createElement).toBe('function');
  });

  it('should create basic element', () => {
    const element = React.createElement('div', null, 'test');
    expect(element.type).toBe('div');
    expect(element.props?.children).toBe('test');
  });

  it('should handle component props', () => {
    const props = { id: 'test', className: 'test-class' };
    const element = React.createElement('div', props);
    expect(element.props?.id).toBe('test');
    expect(element.props?.className).toBe('test-class');
  });
});