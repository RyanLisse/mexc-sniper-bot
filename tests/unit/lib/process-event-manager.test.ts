/**
 * Process Event Manager Tests
 * 
 * Tests for the centralized process event management system
 * that prevents MaxListenersExceededWarning during test execution.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ProcessEventManager, processEventManager, registerProcessEventHandler } from '../../../src/lib/process-event-manager';

describe('ProcessEventManager', () => {
  let manager: ProcessEventManager;

  beforeEach(() => {
    manager = ProcessEventManager.getInstance();
    // Clear any existing handlers for clean tests
    manager.cleanup();
  });

  afterEach(() => {
    manager.cleanup();
  });

  describe('Handler Registration', () => {
    it('should register handlers without duplication', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.registerHandler('test-1', 'unhandledRejection', handler1, 'test-source');
      manager.registerHandler('test-1', 'unhandledRejection', handler2, 'test-source'); // Should be ignored

      const info = manager.getHandlerInfo();
      expect(info.handlerCount).toBe(1);
      expect(info.handlers).toHaveLength(1);
      expect(info.handlers[0].id).toBe('test-1');
      expect(info.handlers[0].source).toBe('test-source');
    });

    it('should allow different handlers with different IDs', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      manager.registerHandler('test-1', 'unhandledRejection', handler1, 'source-1');
      manager.registerHandler('test-2', 'uncaughtException', handler2, 'source-2');

      const info = manager.getHandlerInfo();
      expect(info.handlerCount).toBe(2);
      expect(info.attachedEvents).toContain('unhandledRejection');
      expect(info.attachedEvents).toContain('uncaughtException');
    });

    it('should track attached event types', () => {
      const handler = vi.fn();
      
      manager.registerHandler('test-rejection', 'unhandledRejection', handler, 'test');
      
      const info = manager.getHandlerInfo();
      expect(info.attachedEvents).toContain('unhandledRejection');
    });
  });

  describe('Handler Unregistration', () => {
    it('should unregister handlers by ID', () => {
      const handler = vi.fn();
      
      manager.registerHandler('test-handler', 'unhandledRejection', handler, 'test');
      expect(manager.getHandlerInfo().handlerCount).toBe(1);
      
      manager.unregisterHandler('test-handler');
      expect(manager.getHandlerInfo().handlerCount).toBe(0);
    });

    it('should handle unregistering non-existent handlers gracefully', () => {
      expect(() => {
        manager.unregisterHandler('non-existent');
      }).not.toThrow();
    });
  });

  describe('Max Listeners Management', () => {
    it('should increase process max listeners', () => {
      const originalLimit = process.getMaxListeners();
      
      manager.increaseMaxListeners(25);
      
      expect(process.getMaxListeners()).toBeGreaterThanOrEqual(25);
      
      // Reset to original limit
      process.setMaxListeners(originalLimit);
    });

    it('should not decrease max listeners if new limit is lower', () => {
      const originalLimit = process.getMaxListeners();
      process.setMaxListeners(30);
      
      manager.increaseMaxListeners(20); // Lower than current
      
      expect(process.getMaxListeners()).toBe(30); // Should remain unchanged
      
      // Reset to original limit
      process.setMaxListeners(originalLimit);
    });
  });

  describe('Handler Info', () => {
    it('should provide accurate handler information', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      
      manager.registerHandler('handler-1', 'unhandledRejection', handler1, 'source-1');
      manager.registerHandler('handler-2', 'uncaughtException', handler2, 'source-2');
      
      const info = manager.getHandlerInfo();
      
      expect(info.handlerCount).toBe(2);
      expect(info.attachedEvents).toHaveLength(2);
      expect(info.handlers).toHaveLength(2);
      expect(info.isShuttingDown).toBe(false);
      
      const handlerIds = info.handlers.map(h => h.id);
      expect(handlerIds).toContain('handler-1');
      expect(handlerIds).toContain('handler-2');
    });
  });

  describe('Singleton Pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ProcessEventManager.getInstance();
      const instance2 = ProcessEventManager.getInstance();
      
      expect(instance1).toBe(instance2);
      expect(instance1).toBe(manager);
    });
  });

  describe('Helper Functions', () => {
    it('should register handlers through helper function', () => {
      const handler = vi.fn();
      
      registerProcessEventHandler('helper-test', 'unhandledRejection', handler, 'helper');
      
      const info = manager.getHandlerInfo();
      expect(info.handlerCount).toBe(1);
      expect(info.handlers[0].id).toBe('helper-test');
      expect(info.handlers[0].source).toBe('helper');
    });
  });

  describe('Memory Leak Prevention', () => {
    it('should prevent duplicate process listener attachment', () => {
      const originalListenerCount = process.listenerCount('unhandledRejection');
      
      // Register multiple handlers for the same event type
      manager.registerHandler('test-1', 'unhandledRejection', vi.fn(), 'test');
      manager.registerHandler('test-2', 'unhandledRejection', vi.fn(), 'test');
      manager.registerHandler('test-3', 'unhandledRejection', vi.fn(), 'test');
      
      // Should only add one actual process listener despite multiple handlers
      const newListenerCount = process.listenerCount('unhandledRejection');
      expect(newListenerCount - originalListenerCount).toBeLessThanOrEqual(1);
      
      const info = manager.getHandlerInfo();
      expect(info.handlerCount).toBe(3); // All handlers registered
      expect(info.attachedEvents).toContain('unhandledRejection'); // But only one process listener
    });
  });
});

describe('ProcessEventManager Integration', () => {
  it('should work with the global instance', () => {
    const handler = vi.fn();
    
    // Use the global instance
    processEventManager.registerHandler('global-test', 'unhandledRejection', handler, 'global');
    
    const info = processEventManager.getHandlerInfo();
    expect(info.handlerCount).toBeGreaterThanOrEqual(1);
    
    // Clean up
    processEventManager.unregisterHandler('global-test');
  });

  it('should handle test environment properly', () => {
    // In test environment, default handlers should not be registered
    const info = processEventManager.getHandlerInfo();
    
    // Should have handlers from vitest-setup but not default production handlers
    expect(info.attachedEvents).toEqual(expect.arrayContaining(['unhandledRejection', 'uncaughtException']));
  });
});