import { describe, it, expect } from 'vitest'
import { cn } from '../../src/lib/utils'

describe('Utils', () => {
  describe('cn function', () => {
    it('should merge class names correctly', () => {
      const result = cn('text-red-500', 'bg-blue-500')
      expect(result).toBe('text-red-500 bg-blue-500')
    })

    it('should handle conditional classes', () => {
      const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
      expect(result).toBe('base-class conditional-class')
    })

    it('should handle overlapping Tailwind classes', () => {
      const result = cn('text-red-500', 'text-blue-500')
      expect(result).toBe('text-blue-500')
    })

    it('should handle empty inputs', () => {
      const result = cn()
      expect(result).toBe('')
    })

    it('should handle null and undefined inputs', () => {
      const result = cn('valid-class', null, undefined, 'another-class')
      expect(result).toBe('valid-class another-class')
    })

    it('should handle object notation', () => {
      const result = cn({
        'active': true,
        'hidden': false,
        'text-red-500': true
      })
      expect(result).toBe('active text-red-500')
    })
  })
})