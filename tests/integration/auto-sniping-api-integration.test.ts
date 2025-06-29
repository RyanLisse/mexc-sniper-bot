/**
 * Auto-Sniping API Integration Test
 * 
 * Tests the auto-sniping API endpoints for real functionality
 */

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import route handlers directly from the execution route
// Note: These are Next.js API route handlers
import { getCoreTrading, resetCoreTrading } from '@/src/services/trading/consolidated/core-trading/base-service';

// Mock environment variables
vi.mock('process', () => ({
  env: {
    MEXC_API_KEY: 'test-api-key',
    MEXC_SECRET_KEY: 'test-secret-key',
    NODE_ENV: 'test'
  }
}));

// Mock auth wrapper to bypass authentication in tests
vi.mock('@/src/lib/api-auth', () => ({
  apiAuthWrapper: (handler: any) => handler
}));

describe('Auto-Sniping API Integration Tests', () => {
  let coreTrading: any;
  
  beforeEach(async () => {
    // Reset services
    await resetCoreTrading();
    
    // Initialize core trading with test configuration
    coreTrading = getCoreTrading({
      enablePaperTrading: true,
      autoSnipingEnabled: true,
      apiKey: 'test-key',
      secretKey: 'test-secret'
    });
    
    // Initialize service
    await coreTrading.initialize();
  });
  
  afterEach(async () => {
    if (coreTrading) {
      await coreTrading.shutdown();
    }
    await resetCoreTrading();
    vi.clearAllMocks();
  });

  describe('GET /api/auto-sniping/execution', () => {
    it('should return execution report successfully', async () => {
      const { GET } = await import('@/app/api/auto-sniping/execution/route');
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'GET'
      });

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.report).toBeDefined();
      expect(data.data.execution).toBeDefined();
      expect(data.data.execution.isActive).toBeDefined();
    });

    it('should handle query parameters correctly', async () => {
      const { GET } = await import('@/app/api/auto-sniping/execution/route');
      const request = new NextRequest(
        'http://localhost:3000/api/auto-sniping/execution?include_positions=true&include_history=true',
        { method: 'GET' }
      );

      const response = await GET(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.report.activePositions).toBeDefined();
      expect(data.data.report.recentExecutions).toBeDefined();
    });
  });

  describe('POST /api/auto-sniping/execution', () => {
    it('should start execution successfully', async () => {
      const { POST } = await import('@/app/api/auto-sniping/execution/route');
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'start_execution' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('started');
    });

    it('should stop execution successfully', async () => {
      // First start execution
      await coreTrading.startAutoSniping();

      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'stop_execution' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('stopped');
    });

    it('should pause execution successfully', async () => {
      // First start execution
      await coreTrading.startAutoSniping();

      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'pause_execution' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('paused');
    });

    it('should resume execution successfully', async () => {
      // First start and pause execution
      await coreTrading.startAutoSniping();
      await coreTrading.pauseExecution();

      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'resume_execution' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBe('resumed');
    });

    it('should get active positions successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'get_active_positions' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data.positions)).toBe(true);
    });

    it('should get execution status successfully', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'get_execution_status' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.status).toBeDefined();
      expect(data.data.isActive).toBeDefined();
      expect(data.data.systemHealth).toBeDefined();
    });

    it('should update configuration successfully', async () => {
      const config = {
        maxPositions: 5,
        minConfidence: 80,
        positionSizeUSDT: 100
      };

      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'update_config', config }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.updated).toBe(true);
      expect(data.data.configKeys).toEqual(Object.keys(config));
    });

    it('should handle emergency close all', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'emergency_close_all' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(typeof data.data.closedCount).toBe('number');
    });

    it('should handle unknown action', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'unknown_action' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unknown action');
    });

    it('should validate required fields for close_position', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'close_position' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('positionId is required');
    });
  });

  describe('PUT /api/auto-sniping/execution', () => {
    it('should update configuration successfully', async () => {
      const config = {
        maxPositions: 10,
        minConfidence: 75,
        positionSizeUSDT: 200
      };

      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'PUT',
        body: JSON.stringify({ config }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.updatedFields).toEqual(Object.keys(config));
    });

    it('should validate configuration values', async () => {
      const invalidConfig = {
        maxPositions: 100, // Too high
        minConfidence: 150, // Invalid range
        positionSizeUSDT: -10 // Negative value
      };

      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'PUT',
        body: JSON.stringify({ config: invalidConfig }),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid');
    });

    it('should require config object', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'PUT',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await PUT(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('config object is required');
    });
  });

  describe('DELETE /api/auto-sniping/execution', () => {
    it('should perform emergency shutdown successfully', async () => {
      // Start execution first
      await coreTrading.startAutoSniping();

      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'DELETE'
      });

      const response = await DELETE(request);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(typeof data.data.closedPositions).toBe('number');
      expect(data.message).toContain('Emergency shutdown completed');
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(500);

      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should handle missing action', async () => {
      const request = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({}),
        headers: { 'Content-Type': 'application/json' }
      });

      const response = await POST(request);
      expect(response.status).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Unknown action');
    });
  });

  describe('Service Integration', () => {
    it('should integrate with core trading service', async () => {
      // Test that API calls actually affect the core trading service
      const statusBefore = await coreTrading.getServiceStatus();
      expect(statusBefore.autoSnipingEnabled).toBeDefined();

      // Start via API
      const startRequest = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'start_execution' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const startResponse = await POST(startRequest);
      expect(startResponse.status).toBe(200);

      // Verify service state changed
      const statusAfter = await coreTrading.getServiceStatus();
      expect(statusAfter.autoSnipingEnabled).toBe(true);
    });

    it('should maintain consistency between API and service', async () => {
      // Start execution via service
      await coreTrading.startAutoSniping();

      // Check status via API
      const statusRequest = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'get_execution_status' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const statusResponse = await POST(statusRequest);
      const statusData = await statusResponse.json();

      expect(statusData.success).toBe(true);
      expect(statusData.data.isActive).toBe(true);

      // Stop via API
      const stopRequest = new NextRequest('http://localhost:3000/api/auto-sniping/execution', {
        method: 'POST',
        body: JSON.stringify({ action: 'stop_execution' }),
        headers: { 'Content-Type': 'application/json' }
      });

      const stopResponse = await POST(stopRequest);
      expect(stopResponse.status).toBe(200);

      // Verify service reflects the change
      const finalStatus = await coreTrading.getServiceStatus();
      expect(finalStatus.autoSnipingEnabled).toBe(false);
    });
  });
});