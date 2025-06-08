import { describe, it, expect } from 'vitest'
import {
  CalendarEntrySchema,
  SymbolV2EntrySchema,
  ReadyStatePatternSchema,
  validateCalendarEntry,
  validateSymbolV2Entry,
  matchesReadyPattern,
  hasCompleteData,
  isValidForSnipe,
  READY_STATE_PATTERN,
  type CalendarEntry,
  type SymbolV2Entry
} from '../../src/schemas/mexc-schemas'

describe('MEXC Schemas', () => {
  describe('CalendarEntrySchema', () => {
    it('should validate a correct calendar entry', () => {
      const validEntry = {
        vcoinId: 'USDT123',
        symbol: 'TESTUSDT',
        projectName: 'Test Project',
        firstOpenTime: 1672531200000
      }

      expect(() => CalendarEntrySchema.parse(validEntry)).not.toThrow()
      const parsed = CalendarEntrySchema.parse(validEntry)
      expect(parsed).toEqual(validEntry)
    })

    it('should reject calendar entry with missing fields', () => {
      const invalidEntry = {
        vcoinId: 'USDT123',
        symbol: 'TESTUSDT'
        // Missing projectName and firstOpenTime
      }

      expect(() => CalendarEntrySchema.parse(invalidEntry)).toThrow()
    })

    it('should reject calendar entry with wrong types', () => {
      const invalidEntry = {
        vcoinId: 123, // Should be string
        symbol: 'TESTUSDT',
        projectName: 'Test Project',
        firstOpenTime: '1672531200000' // Should be number
      }

      expect(() => CalendarEntrySchema.parse(invalidEntry)).toThrow()
    })
  })

  describe('SymbolV2EntrySchema', () => {
    it('should validate a correct symbol entry', () => {
      const validSymbol = {
        cd: 'USDT123',
        sts: 2,
        st: 2,
        tt: 4,
        ca: '0x123abc',
        ps: 8,
        qs: 2,
        ot: 1672531200000
      }

      expect(() => SymbolV2EntrySchema.parse(validSymbol)).not.toThrow()
      const parsed = SymbolV2EntrySchema.parse(validSymbol)
      expect(parsed).toEqual(validSymbol)
    })

    it('should validate minimal symbol entry', () => {
      const minimalSymbol = {
        cd: 'USDT123',
        sts: 1,
        st: 1,
        tt: 1
      }

      expect(() => SymbolV2EntrySchema.parse(minimalSymbol)).not.toThrow()
    })

    it('should reject symbol entry with missing required fields', () => {
      const invalidSymbol = {
        cd: 'USDT123',
        sts: 2
        // Missing st and tt
      }

      expect(() => SymbolV2EntrySchema.parse(invalidSymbol)).toThrow()
    })
  })

  describe('ReadyStatePatternSchema', () => {
    it('should validate correct ready state pattern', () => {
      const validPattern = {
        sts: 2,
        st: 2,
        tt: 4
      }

      expect(() => ReadyStatePatternSchema.parse(validPattern)).not.toThrow()
    })

    it('should validate READY_STATE_PATTERN constant', () => {
      expect(() => ReadyStatePatternSchema.parse(READY_STATE_PATTERN)).not.toThrow()
      expect(READY_STATE_PATTERN).toEqual({ sts: 2, st: 2, tt: 4 })
    })
  })

  describe('Validation helpers', () => {
    it('should validate calendar entry with helper function', () => {
      const validEntry = {
        vcoinId: 'USDT123',
        symbol: 'TESTUSDT',
        projectName: 'Test Project',
        firstOpenTime: 1672531200000
      }

      const result = validateCalendarEntry(validEntry)
      expect(result).toEqual(validEntry)
    })

    it('should throw error for invalid calendar entry', () => {
      const invalidEntry = { invalid: 'data' }

      expect(() => validateCalendarEntry(invalidEntry)).toThrow()
    })

    it('should validate symbol entry with helper function', () => {
      const validSymbol = {
        cd: 'USDT123',
        sts: 2,
        st: 2,
        tt: 4
      }

      const result = validateSymbolV2Entry(validSymbol)
      expect(result).toEqual(validSymbol)
    })
  })

  describe('Pattern matching utilities', () => {
    const readySymbol: SymbolV2Entry = {
      cd: 'USDT123',
      sts: 2,
      st: 2,
      tt: 4,
      ca: '0x123abc',
      ps: 8,
      qs: 2,
      ot: 1672531200000
    }

    const notReadySymbol: SymbolV2Entry = {
      cd: 'USDT456',
      sts: 1,
      st: 1,
      tt: 1
    }

    const incompleteSymbol: SymbolV2Entry = {
      cd: 'USDT789',
      sts: 2,
      st: 2,
      tt: 4
      // Missing ca, ps, qs, ot
    }

    describe('matchesReadyPattern', () => {
      it('should return true for symbol matching ready pattern', () => {
        expect(matchesReadyPattern(readySymbol)).toBe(true)
      })

      it('should return false for symbol not matching ready pattern', () => {
        expect(matchesReadyPattern(notReadySymbol)).toBe(false)
      })

      it('should return true for incomplete symbol with correct pattern', () => {
        expect(matchesReadyPattern(incompleteSymbol)).toBe(true)
      })
    })

    describe('hasCompleteData', () => {
      it('should return true for symbol with complete data', () => {
        expect(hasCompleteData(readySymbol)).toBe(true)
      })

      it('should return false for symbol missing data', () => {
        expect(hasCompleteData(notReadySymbol)).toBe(false)
        expect(hasCompleteData(incompleteSymbol)).toBe(false)
      })
    })

    describe('isValidForSnipe', () => {
      it('should return true only for ready symbols with complete data', () => {
        expect(isValidForSnipe(readySymbol)).toBe(true)
      })

      it('should return false for not ready symbols', () => {
        expect(isValidForSnipe(notReadySymbol)).toBe(false)
      })

      it('should return false for ready symbols without complete data', () => {
        expect(isValidForSnipe(incompleteSymbol)).toBe(false)
      })
    })
  })
})