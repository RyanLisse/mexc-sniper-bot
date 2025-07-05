/**
 * Simple React Test to verify DOM environment
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('Simple React Test', () => {
  it('should render a simple div', () => {
    render(<div data-testid="test-div">Hello World</div>)
    
    const element = screen.getByTestId('test-div')
    expect(element).toBeInTheDocument()
    expect(element).toHaveTextContent('Hello World')
  })
})