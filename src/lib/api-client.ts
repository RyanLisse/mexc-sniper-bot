/**
 * Unified API client for consistent fetch patterns across hooks
 */
export class ApiClient {
  private static async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    // Handle both { data: T } and T response formats
    return data.data !== undefined ? data.data : data;
  }

  /**
   * Performs a GET request with consistent error handling
   */
  static async get<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "GET",
    });
    return ApiClient.handleResponse<T>(response);
  }

  /**
   * Performs a POST request with consistent error handling
   */
  static async post<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return ApiClient.handleResponse<T>(response);
  }

  /**
   * Performs a PUT request with consistent error handling
   */
  static async put<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return ApiClient.handleResponse<T>(response);
  }

  /**
   * Performs a DELETE request with consistent error handling
   */
  static async delete<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "DELETE",
    });
    return ApiClient.handleResponse<T>(response);
  }

  /**
   * Performs a PATCH request with consistent error handling
   */
  static async patch<T>(url: string, data?: unknown, options?: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...options,
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
      body: data ? JSON.stringify(data) : undefined,
    });
    return ApiClient.handleResponse<T>(response);
  }

  /**
   * Creates a URL with query parameters
   */
  static buildUrl(
    baseUrl: string,
    params?: Record<string, string | number | boolean | undefined>
  ): string {
    if (!params) return baseUrl;

    const url = new URL(baseUrl, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });

    return url.pathname + url.search;
  }
}
