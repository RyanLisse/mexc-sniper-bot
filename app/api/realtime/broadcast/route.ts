import type { NextRequest } from "next/server";
import { apiResponse } from "@/src/lib/api-response";
import { requireAuth } from "@/src/lib/supabase-auth";
import type { PriceUpdate, SystemAlert } from "@/src/lib/supabase-realtime";
import { realtimeManager } from "@/src/lib/supabase-realtime";

/**
 * Real-time Broadcast API
 *
 * POST /api/realtime/broadcast - Broadcast real-time updates
 * GET /api/realtime/broadcast - Get real-time connection status
 */

export async function GET(_request: NextRequest) {
  try {
    // Get connection status
    const status = realtimeManager.getConnectionStatus();

    return apiResponse.success({
      realtimeStatus: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Realtime Broadcast] GET Error:", error);
    return apiResponse.error("Failed to get realtime status", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await requireAuth();
    if (!user) {
      return apiResponse.unauthorized("Authentication required");
    }

    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case "price_update": {
        if (!data.symbol || typeof data.price !== "number") {
          return apiResponse.badRequest(
            "Symbol and price are required for price updates"
          );
        }

        const priceUpdate: PriceUpdate = {
          symbol: data.symbol,
          price: data.price,
          change: data.change || 0,
          changePercent: data.changePercent || 0,
          volume: data.volume || 0,
          timestamp: new Date().toISOString(),
        };

        await realtimeManager.broadcastPriceUpdate(priceUpdate);

        return apiResponse.success({
          message: "Price update broadcasted successfully",
          priceUpdate,
          timestamp: new Date().toISOString(),
        });
      }

      case "system_alert": {
        if (!data.title || !data.message || !data.type) {
          return apiResponse.badRequest(
            "Title, message, and type are required for system alerts"
          );
        }

        const systemAlert: SystemAlert = {
          id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: data.type,
          title: data.title,
          message: data.message,
          userId: data.userId || undefined,
          timestamp: new Date().toISOString(),
        };

        await realtimeManager.broadcastSystemAlert(systemAlert);

        return apiResponse.success({
          message: "System alert broadcasted successfully",
          systemAlert,
          timestamp: new Date().toISOString(),
        });
      }

      case "mock_trading_data": {
        // Simulate trading data updates for testing
        const mockData = generateMockTradingData(user.id || "demo-user");

        // Broadcast multiple updates
        const results = await Promise.allSettled([
          realtimeManager.broadcastPriceUpdate(mockData.priceUpdate),
          realtimeManager.broadcastSystemAlert(mockData.alert),
        ]);

        const successful = results.filter(
          (r) => r.status === "fulfilled"
        ).length;
        const failed = results.filter((r) => r.status === "rejected").length;

        return apiResponse.success({
          message: `Mock trading data broadcasted: ${successful} successful, ${failed} failed`,
          mockData,
          results: results.map((r) => r.status),
          timestamp: new Date().toISOString(),
        });
      }

      case "test_connection": {
        // Test the real-time connection
        const testAlert: SystemAlert = {
          id: `test_${Date.now()}`,
          type: "info",
          title: "Connection Test",
          message: "Real-time connection is working properly",
          userId: user.id || "demo-user",
          timestamp: new Date().toISOString(),
        };

        await realtimeManager.broadcastSystemAlert(testAlert);

        return apiResponse.success({
          message: "Connection test alert sent",
          testAlert,
          connectionStatus: realtimeManager.getConnectionStatus(),
          timestamp: new Date().toISOString(),
        });
      }

      default:
        return apiResponse.badRequest(`Unknown broadcast type: ${type}`);
    }
  } catch (error) {
    console.error("[Realtime Broadcast] POST Error:", error);
    return apiResponse.error("Failed to broadcast real-time update", 500);
  }
}

/**
 * Generate mock trading data for testing
 */
function generateMockTradingData(userId: string) {
  const symbols = ["BTCUSDT", "ETHUSDT", "BNBUSDT", "ADAUSDT", "SOLUSDT"];
  const randomSymbol = symbols[Math.floor(Math.random() * symbols.length)];

  const basePrice =
    {
      BTCUSDT: 45000,
      ETHUSDT: 3000,
      BNBUSDT: 300,
      ADAUSDT: 0.5,
      SOLUSDT: 100,
    }[randomSymbol] || 1000;

  const change = (Math.random() - 0.5) * basePrice * 0.05; // ±5% change
  const currentPrice = basePrice + change;
  const changePercent = (change / basePrice) * 100;

  const priceUpdate: PriceUpdate = {
    symbol: randomSymbol,
    price: currentPrice,
    change: change,
    changePercent: changePercent,
    volume: Math.random() * 1000000,
    timestamp: new Date().toISOString(),
  };

  const alertTypes = ["info", "warning", "error", "success"] as const;
  const randomAlertType =
    alertTypes[Math.floor(Math.random() * alertTypes.length)];

  const alert: SystemAlert = {
    id: `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: randomAlertType,
    title: `${randomSymbol} Price Alert`,
    message: `${randomSymbol} price ${changePercent > 0 ? "increased" : "decreased"} by ${Math.abs(changePercent).toFixed(2)}% to $${currentPrice.toFixed(4)}`,
    userId: userId,
    timestamp: new Date().toISOString(),
  };

  return {
    priceUpdate,
    alert,
  };
}
