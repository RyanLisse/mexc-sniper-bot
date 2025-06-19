import { describe, it, expect } from 'vitest'
import {
  ActivityDataSchema,
  ActivityResponseSchema,
  ActivityEnhancementSchema,
  ActivityQueryOptions,
  validateActivityData,
  validateActivityResponse,
  validateActivityEnhancement,
  calculateActivityBoost,
  hasHighPriorityActivity,
  getUniqueActivityTypes,
  type ActivityData,
  type ActivityResponse,
  type ActivityEnhancement
} from '../../src/schemas/mexc-schemas'

describe('Activity API Schemas and Utilities', () => {
  describe('ActivityDataSchema', () => {
    it('should validate a correct activity data object', () => {
      const validActivity: ActivityData = {
        activityId: 'aa7d647aeaa240e5b8ef2a17e068cf04',
        currency: 'FCAT',
        currencyId: 'cea6aaa1fe8b47a4abb059e45c147587',
        activityType: 'SUN_SHINE'
      }

      expect(() => ActivityDataSchema.parse(validActivity)).not.toThrow()
      const parsed = ActivityDataSchema.parse(validActivity)
      expect(parsed).toEqual(validActivity)
    })

    it('should reject activity data with missing fields', () => {
      const invalidActivity = {
        activityId: 'aa7d647aeaa240e5b8ef2a17e068cf04',
        currency: 'FCAT'
        // Missing currencyId and activityType
      }

      expect(() => ActivityDataSchema.parse(invalidActivity)).toThrow()
    })

    it('should reject activity data with wrong types', () => {
      const invalidActivity = {
        activityId: 123, // Should be string
        currency: 'FCAT',
        currencyId: 'cea6aaa1fe8b47a4abb059e45c147587',
        activityType: 'SUN_SHINE'
      }

      expect(() => ActivityDataSchema.parse(invalidActivity)).toThrow()
    })
  })

  describe('ActivityResponseSchema', () => {
    it('should validate a correct activity response', () => {
      const validResponse: ActivityResponse = {
        data: [
          {
            activityId: 'aa7d647aeaa240e5b8ef2a17e068cf04',
            currency: 'FCAT',
            currencyId: 'cea6aaa1fe8b47a4abb059e45c147587',
            activityType: 'SUN_SHINE'
          }
        ],
        code: 0,
        msg: 'success',
        timestamp: 1750323667057
      }

      expect(() => ActivityResponseSchema.parse(validResponse)).not.toThrow()
      const parsed = ActivityResponseSchema.parse(validResponse)
      expect(parsed).toEqual(validResponse)
    })

    it('should validate empty activity response', () => {
      const emptyResponse: ActivityResponse = {
        data: [],
        code: 0,
        msg: 'success',
        timestamp: 1750323667057
      }

      expect(() => ActivityResponseSchema.parse(emptyResponse)).not.toThrow()
    })

    it('should reject response with invalid structure', () => {
      const invalidResponse = {
        data: 'not-an-array',
        code: 0,
        msg: 'success',
        timestamp: 1750323667057
      }

      expect(() => ActivityResponseSchema.parse(invalidResponse)).toThrow()
    })
  })

  describe('ActivityEnhancementSchema', () => {
    it('should validate activity enhancement data', () => {
      const validEnhancement: ActivityEnhancement = {
        baseConfidence: 75,
        enhancedConfidence: 90,
        activityBoost: 15,
        activities: 2,
        activityTypes: ['SUN_SHINE', 'PROMOTION'],
        multipleActivitiesBonus: 5,
        recentActivityBonus: 3
      }

      expect(() => ActivityEnhancementSchema.parse(validEnhancement)).not.toThrow()
      const parsed = ActivityEnhancementSchema.parse(validEnhancement)
      expect(parsed).toEqual(validEnhancement)
    })

    it('should validate minimal enhancement data', () => {
      const minimalEnhancement = {
        baseConfidence: 70,
        enhancedConfidence: 70,
        activityBoost: 0,
        activities: 0,
        activityTypes: []
      }

      expect(() => ActivityEnhancementSchema.parse(minimalEnhancement)).not.toThrow()
    })
  })

  describe('ActivityQueryOptions', () => {
    it('should apply default values correctly', () => {
      const options = ActivityQueryOptions.parse({})
      
      expect(options.batchSize).toBe(5)
      expect(options.maxRetries).toBe(3)
      expect(options.rateLimitDelay).toBe(200)
    })

    it('should accept custom values', () => {
      const customOptions = {
        batchSize: 10,
        maxRetries: 5,
        rateLimitDelay: 500
      }

      const parsed = ActivityQueryOptions.parse(customOptions)
      expect(parsed).toEqual(customOptions)
    })
  })

  describe('Validation helpers', () => {
    it('should validate activity data with helper function', () => {
      const validActivity: ActivityData = {
        activityId: 'test-id',
        currency: 'TEST',
        currencyId: 'test-currency-id',
        activityType: 'PROMOTION'
      }

      const result = validateActivityData(validActivity)
      expect(result).toEqual(validActivity)
    })

    it('should throw error for invalid activity data', () => {
      const invalidActivity = { invalid: 'data' }

      expect(() => validateActivityData(invalidActivity)).toThrow()
    })

    it('should validate activity response with helper function', () => {
      const validResponse: ActivityResponse = {
        data: [],
        code: 0,
        msg: 'success',
        timestamp: Date.now()
      }

      const result = validateActivityResponse(validResponse)
      expect(result).toEqual(validResponse)
    })

    it('should validate activity enhancement with helper function', () => {
      const validEnhancement: ActivityEnhancement = {
        baseConfidence: 80,
        enhancedConfidence: 95,
        activityBoost: 15,
        activities: 1,
        activityTypes: ['LAUNCH_EVENT']
      }

      const result = validateActivityEnhancement(validEnhancement)
      expect(result).toEqual(validEnhancement)
    })
  })

  describe('Activity utility functions', () => {
    const testActivities: ActivityData[] = [
      {
        activityId: '1',
        currency: 'TEST1',
        currencyId: 'test1-id',
        activityType: 'SUN_SHINE'
      },
      {
        activityId: '2',
        currency: 'TEST2',
        currencyId: 'test2-id',
        activityType: 'LAUNCH_EVENT'
      },
      {
        activityId: '3',
        currency: 'TEST3',
        currencyId: 'test3-id',
        activityType: 'PROMOTION'
      }
    ]

    describe('calculateActivityBoost', () => {
      it('should return 0 for empty activities array', () => {
        expect(calculateActivityBoost([])).toBe(0)
      })

      it('should calculate boost for single high-priority activity', () => {
        const launchEventActivity = [{
          activityId: '1',
          currency: 'TEST',
          currencyId: 'test-id',
          activityType: 'LAUNCH_EVENT'
        }]

        const boost = calculateActivityBoost(launchEventActivity)
        expect(boost).toBe(18) // LAUNCH_EVENT score
      })

      it('should calculate boost for single listing event (highest priority)', () => {
        const listingEventActivity = [{
          activityId: '1',
          currency: 'TEST',
          currencyId: 'test-id',
          activityType: 'LISTING_EVENT'
        }]

        const boost = calculateActivityBoost(listingEventActivity)
        expect(boost).toBe(20) // LISTING_EVENT score (highest)
      })

      it('should add multiple activities bonus', () => {
        const multipleActivities = [
          {
            activityId: '1',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'SUN_SHINE'
          },
          {
            activityId: '2',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'PROMOTION'
          }
        ]

        const boost = calculateActivityBoost(multipleActivities)
        // Max of (SUN_SHINE: 15, PROMOTION: 12) = 15, plus multiple activities bonus: 5
        expect(boost).toBe(20)
      })

      it('should cap boost at maximum of 20', () => {
        const maxActivities = [
          {
            activityId: '1',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'LISTING_EVENT' // 20 points
          },
          {
            activityId: '2',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'LAUNCH_EVENT' // 18 points
          }
        ]

        const boost = calculateActivityBoost(maxActivities)
        // LISTING_EVENT (20) + multiple bonus (5) = 25, but capped at 20
        expect(boost).toBe(20)
      })

      it('should use default score for unknown activity types', () => {
        const unknownActivity = [{
          activityId: '1',
          currency: 'TEST',
          currencyId: 'test-id',
          activityType: 'UNKNOWN_TYPE'
        }]

        const boost = calculateActivityBoost(unknownActivity)
        expect(boost).toBe(5) // Default score
      })
    })

    describe('hasHighPriorityActivity', () => {
      it('should return true for activities with high priority types', () => {
        const highPriorityActivities = [
          {
            activityId: '1',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'LAUNCH_EVENT'
          }
        ]

        expect(hasHighPriorityActivity(highPriorityActivities)).toBe(true)
      })

      it('should return true for SUN_SHINE activities', () => {
        const sunShineActivities = [
          {
            activityId: '1',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'SUN_SHINE'
          }
        ]

        expect(hasHighPriorityActivity(sunShineActivities)).toBe(true)
      })

      it('should return true for LISTING_EVENT activities', () => {
        const listingEventActivities = [
          {
            activityId: '1',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'LISTING_EVENT'
          }
        ]

        expect(hasHighPriorityActivity(listingEventActivities)).toBe(true)
      })

      it('should return false for activities without high priority types', () => {
        const lowPriorityActivities = [
          {
            activityId: '1',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'AIRDROP'
          },
          {
            activityId: '2',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'TRADING_COMPETITION'
          }
        ]

        expect(hasHighPriorityActivity(lowPriorityActivities)).toBe(false)
      })

      it('should return false for empty activities', () => {
        expect(hasHighPriorityActivity([])).toBe(false)
      })

      it('should return true if any activity is high priority', () => {
        const mixedActivities = [
          {
            activityId: '1',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'AIRDROP'
          },
          {
            activityId: '2',
            currency: 'TEST',
            currencyId: 'test-id',
            activityType: 'LAUNCH_EVENT' // High priority
          }
        ]

        expect(hasHighPriorityActivity(mixedActivities)).toBe(true)
      })
    })

    describe('getUniqueActivityTypes', () => {
      it('should return unique activity types', () => {
        const activities = [
          {
            activityId: '1',
            currency: 'TEST1',
            currencyId: 'test1-id',
            activityType: 'SUN_SHINE'
          },
          {
            activityId: '2',
            currency: 'TEST2',
            currencyId: 'test2-id',
            activityType: 'PROMOTION'
          },
          {
            activityId: '3',
            currency: 'TEST3',
            currencyId: 'test3-id',
            activityType: 'SUN_SHINE'
          }
        ]

        const uniqueTypes = getUniqueActivityTypes(activities)
        expect(uniqueTypes).toEqual(['SUN_SHINE', 'PROMOTION'])
        expect(uniqueTypes).toHaveLength(2)
      })

      it('should return empty array for no activities', () => {
        expect(getUniqueActivityTypes([])).toEqual([])
      })

      it('should handle single activity type', () => {
        const singleActivity = [{
          activityId: '1',
          currency: 'TEST',
          currencyId: 'test-id',
          activityType: 'LAUNCH_EVENT'
        }]

        const uniqueTypes = getUniqueActivityTypes(singleActivity)
        expect(uniqueTypes).toEqual(['LAUNCH_EVENT'])
      })

      it('should preserve order of first occurrence', () => {
        const activities = [
          {
            activityId: '1',
            currency: 'TEST1',
            currencyId: 'test1-id',
            activityType: 'PROMOTION'
          },
          {
            activityId: '2',
            currency: 'TEST2',
            currencyId: 'test2-id',
            activityType: 'LAUNCH_EVENT'
          },
          {
            activityId: '3',
            currency: 'TEST3',
            currencyId: 'test3-id',
            activityType: 'PROMOTION'
          }
        ]

        const uniqueTypes = getUniqueActivityTypes(activities)
        expect(uniqueTypes).toEqual(['PROMOTION', 'LAUNCH_EVENT'])
      })
    })
  })
})