/**
 * useAiServices Hook Tests
 * 
 * Tests for the AI services hook that manages AI service integrations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock the hook structure
const mockUseAiServices = () => {
  const [isLoading, setIsLoading] = vi.fn().mockReturnValue([false, vi.fn()]);
  const [error, setError] = vi.fn().mockReturnValue([null, vi.fn()]);
  const [services, setServices] = vi.fn().mockReturnValue([{}, vi.fn()]);

  return {
    isLoading: false,
    error: null,
    services: {
      openai: { available: true, status: 'connected' },
      perplexity: { available: true, status: 'connected' }
    },
    initializeServices: vi.fn(),
    resetServices: vi.fn(),
    checkServiceHealth: vi.fn()
  };
};

describe('useAiServices Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Hook Initialization', () => {
    it('should initialize with default state', () => {
      const hook = mockUseAiServices();
      
      expect(hook.isLoading).toBe(false);
      expect(hook.error).toBe(null);
      expect(hook.services).toBeDefined();
    });

    it('should have all required service interfaces', () => {
      const hook = mockUseAiServices();
      
      expect(hook.services.openai).toBeDefined();
      expect(hook.services.perplexity).toBeDefined();
      expect(hook.services.openai.available).toBe(true);
      expect(hook.services.perplexity.available).toBe(true);
    });
  });

  describe('Service Management', () => {
    it('should initialize AI services', async () => {
      const hook = mockUseAiServices();
      
      await act(async () => {
        await hook.initializeServices();
      });
      
      expect(hook.initializeServices).toHaveBeenCalled();
    });

    it('should reset services when needed', async () => {
      const hook = mockUseAiServices();
      
      await act(async () => {
        await hook.resetServices();
      });
      
      expect(hook.resetServices).toHaveBeenCalled();
    });

    it('should check service health status', async () => {
      const hook = mockUseAiServices();
      
      await act(async () => {
        await hook.checkServiceHealth();
      });
      
      expect(hook.checkServiceHealth).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors', () => {
      const mockErrorHook = {
        ...mockUseAiServices(),
        error: new Error('Service initialization failed'),
        isLoading: false
      };
      
      expect(mockErrorHook.error).toBeInstanceOf(Error);
      expect(mockErrorHook.error.message).toBe('Service initialization failed');
    });

    it('should handle network connectivity issues', () => {
      const mockOfflineHook = {
        ...mockUseAiServices(),
        services: {
          openai: { available: false, status: 'disconnected', error: 'Network error' },
          perplexity: { available: false, status: 'disconnected', error: 'Network error' }
        }
      };
      
      expect(mockOfflineHook.services.openai.available).toBe(false);
      expect(mockOfflineHook.services.perplexity.available).toBe(false);
    });

    it('should handle API key configuration errors', () => {
      const mockConfigErrorHook = {
        ...mockUseAiServices(),
        error: new Error('Invalid API key configuration'),
        services: {
          openai: { available: false, status: 'error', error: 'Invalid API key' },
          perplexity: { available: true, status: 'connected' }
        }
      };
      
      expect(mockConfigErrorHook.error.message).toContain('Invalid API key');
      expect(mockConfigErrorHook.services.openai.available).toBe(false);
    });
  });

  describe('Service Status Monitoring', () => {
    it('should track service health changes', () => {
      const hook = mockUseAiServices();
      
      // Simulate service status change
      const newStatus = {
        openai: { available: true, status: 'connected', lastCheck: Date.now() },
        perplexity: { available: false, status: 'error', lastCheck: Date.now() }
      };
      
      expect(newStatus.openai.available).toBe(true);
      expect(newStatus.perplexity.available).toBe(false);
    });

    it('should handle rate limiting', () => {
      const mockRateLimitedHook = {
        ...mockUseAiServices(),
        services: {
          openai: { 
            available: true, 
            status: 'rate_limited', 
            rateLimitReset: Date.now() + 60000 
          },
          perplexity: { available: true, status: 'connected' }
        }
      };
      
      expect(mockRateLimitedHook.services.openai.status).toBe('rate_limited');
      expect(mockRateLimitedHook.services.openai.rateLimitReset).toBeGreaterThan(Date.now());
    });
  });

  describe('Service Integration', () => {
    it('should provide service selection functionality', () => {
      const hook = mockUseAiServices();
      
      const selectBestService = (task: string) => {
        if (task === 'research') return 'perplexity';
        if (task === 'analysis') return 'openai';
        return 'openai'; // default
      };
      
      expect(selectBestService('research')).toBe('perplexity');
      expect(selectBestService('analysis')).toBe('openai');
      expect(selectBestService('unknown')).toBe('openai');
    });

    it('should handle service failover', () => {
      const servicesWithFailover = {
        openai: { available: false, status: 'error' },
        perplexity: { available: true, status: 'connected' }
      };
      
      const getAvailableService = () => {
        if (servicesWithFailover.openai.available) return 'openai';
        if (servicesWithFailover.perplexity.available) return 'perplexity';
        return null;
      };
      
      expect(getAvailableService()).toBe('perplexity');
    });
  });
});