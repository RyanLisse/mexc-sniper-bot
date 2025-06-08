import { createHmac } from "crypto";

export interface OrderParameters {
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  quantity: string;
  price?: string;
  timeInForce?: "GTC" | "IOC" | "FOK";
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  symbol: string;
  side: string;
  quantity: string;
  price?: string;
  status?: string;
  error?: string;
  timestamp: string;
}

export class MexcTradingApi {
  private apiKey: string;
  private secretKey: string;
  private baseUrl = "https://api.mexc.com";

  constructor(apiKey: string, secretKey: string) {
    this.apiKey = apiKey;
    this.secretKey = secretKey;
  }

  /**
   * Create HMAC signature for MEXC API requests
   */
  private createSignature(queryString: string): string {
    return createHmac("sha256", this.secretKey).update(queryString).digest("hex");
  }

  /**
   * Place a new order on MEXC exchange
   */
  async placeOrder(params: OrderParameters): Promise<OrderResult> {
    try {
      const timestamp = Date.now();

      // Build query parameters
      const queryParams = {
        symbol: params.symbol,
        side: params.side,
        type: params.type,
        quantity: params.quantity,
        timestamp: timestamp.toString(),
        ...(params.price && { price: params.price }),
        ...(params.timeInForce && { timeInForce: params.timeInForce }),
      };

      // Create query string for signature
      const queryString = Object.entries(queryParams)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");

      const signature = this.createSignature(queryString);
      const finalQueryString = `${queryString}&signature=${signature}`;

      console.log(`🔐 MEXC Trading API: Placing ${params.side} order for ${params.symbol}`);
      console.log(`📊 Order Details: ${params.quantity} at ${params.price || "MARKET"} price`);

      const response = await fetch(`${this.baseUrl}/api/v3/order?${finalQueryString}`, {
        method: "POST",
        headers: {
          "X-MEXC-APIKEY": this.apiKey,
          "Content-Type": "application/json",
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`❌ MEXC Trading API Error: ${response.status}`, responseData);

        return {
          success: false,
          symbol: params.symbol,
          side: params.side,
          quantity: params.quantity,
          price: params.price,
          error: `API Error: ${response.status} - ${responseData.msg || responseData.message || "Unknown error"}`,
          timestamp: new Date().toISOString(),
        };
      }

      console.log(`✅ MEXC Order Placed Successfully:`, responseData);

      return {
        success: true,
        orderId: responseData.orderId,
        symbol: responseData.symbol,
        side: responseData.side,
        quantity: responseData.origQty || responseData.executedQty,
        price: responseData.price,
        status: responseData.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("MEXC Trading API Error:", error);

      return {
        success: false,
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        error: error instanceof Error ? error.message : "Unknown trading error",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get current account balance for a specific asset
   */
  async getAssetBalance(asset: string): Promise<{ free: string; locked: string } | null> {
    try {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = this.createSignature(queryString);

      const response = await fetch(
        `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
        {
          method: "GET",
          headers: {
            "X-MEXC-APIKEY": this.apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        console.error(`❌ MEXC Account API Error: ${response.status}`);
        return null;
      }

      const accountData = await response.json();
      const assetBalance = accountData.balances?.find((balance: any) => balance.asset === asset);

      return assetBalance
        ? {
            free: assetBalance.free,
            locked: assetBalance.locked,
          }
        : null;
    } catch (error) {
      console.error("MEXC Account Balance Error:", error);
      return null;
    }
  }

  /**
   * Validate order parameters before placement
   */
  validateOrderParameters(params: OrderParameters): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!params.symbol) errors.push("Symbol is required");
    if (!params.side) errors.push("Side (BUY/SELL) is required");
    if (!params.type) errors.push("Order type is required");
    if (!params.quantity || Number.parseFloat(params.quantity) <= 0)
      errors.push("Valid quantity is required");
    if (params.type === "LIMIT" && (!params.price || Number.parseFloat(params.price) <= 0)) {
      errors.push("Price is required for LIMIT orders");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
