# Duplicate Code Analysis and Refactoring Opportunities

## 1. **API Response Patterns**

### Current Duplicate Pattern:
Most API routes follow the same try-catch structure with similar response formats:

```typescript
// Pattern repeated in: connectivity/route.ts, server-time/route.ts, calendar/route.ts, etc.
try {
  const result = await someApiCall();
  return NextResponse.json({
    success: true,
    data: result,
    timestamp: new Date().toISOString(),
    // ... other fields
  });
} catch (error) {
  console.error("Operation failed:", error);
  return NextResponse.json(
    {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      timestamp: new Date().toISOString(),
      // ... other fields
    },
    { status: 500 }
  );
}
```

### Refactoring Recommendation:
Create a unified API response handler:

```typescript
// src/lib/api-response.ts
export class ApiResponse {
  static success<T>(data: T, metadata?: Record<string, unknown>) {
    return NextResponse.json({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...metadata,
    });
  }

  static error(error: unknown, status = 500, metadata?: Record<string, unknown>) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
        ...metadata,
      },
      { status }
    );
  }
}

// Usage example:
export async function GET() {
  try {
    const result = await mexcApi.getCalendar();
    return ApiResponse.success(result.data, { count: result.data.length });
  } catch (error) {
    return ApiResponse.error(error);
  }
}
```

## 2. **Hook Data Fetching Patterns**

### Current Duplicate Pattern:
Multiple hooks use the same fetch pattern with error handling:

```typescript
// Pattern repeated in: use-mexc-data.ts, use-user-preferences.ts, etc.
queryFn: async () => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  const result = await response.json();
  return result.data;
}
```

### Refactoring Recommendation:
Create a unified fetch utility:

```typescript
// src/lib/api-client.ts
export class ApiClient {
  static async get<T>(url: string): Promise<T> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data || result;
  }

  static async post<T>(url: string, data: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result.data || result;
  }
}

// Usage in hooks:
queryFn: () => ApiClient.get<CalendarEntry[]>("/api/mexc/calendar")
```

## 3. **Trigger Route Patterns**

### Current Duplicate Pattern:
All trigger routes have nearly identical structure:

```typescript
// Pattern in: calendar-poll/route.ts, pattern-analysis/route.ts, etc.
export async function POST(request: NextRequest) {
  try {
    const event = await inngest.send({
      name: "mexc/something",
      data: {
        triggeredBy: "ui",
        timestamp: new Date().toISOString(),
        // ... other data
      },
    });

    return NextResponse.json({
      success: true,
      message: "Workflow triggered",
      eventId: event.ids[0],
    });
  } catch (error) {
    console.error("Failed to trigger:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to trigger workflow",
      },
      { status: 500 }
    );
  }
}
```

### Refactoring Recommendation:
Create a trigger handler factory:

```typescript
// src/lib/trigger-handler.ts
export function createTriggerHandler(eventName: string, description: string) {
  return async function POST(request: NextRequest) {
    try {
      const body = await request.json().catch(() => ({}));
      
      const event = await inngest.send({
        name: eventName,
        data: {
          triggeredBy: "ui",
          timestamp: new Date().toISOString(),
          ...body,
        },
      });

      return ApiResponse.success({
        message: `${description} workflow triggered`,
        eventId: event.ids[0],
        ...body,
      });
    } catch (error) {
      return ApiResponse.error(error, 500, {
        workflow: description,
      });
    }
  };
}

// Usage:
export const POST = createTriggerHandler("mexc/calendar.poll", "Calendar polling");
```

## 4. **Validation Patterns**

### Current Duplicate Pattern:
Take profit level validation is repeated multiple times:

```typescript
// Pattern in user-preferences/route.ts
if (data.takeProfitLevel1 !== undefined) {
  if (data.takeProfitLevel1 < 0) {
    return NextResponse.json(
      { error: 'Take profit level 1 cannot be negative' },
      { status: 400 }
    );
  }
  updateData.takeProfitLevel1 = data.takeProfitLevel1;
}
// Repeated for levels 2, 3, 4, and custom
```

### Refactoring Recommendation:
Create a validation utility:

```typescript
// src/lib/validators.ts
export const validators = {
  takeProfitLevel: (value: number, levelName: string) => {
    if (value < 0) {
      throw new ValidationError(`${levelName} cannot be negative`);
    }
    if (value > 1000) {
      throw new ValidationError(`${levelName} cannot exceed 1000%`);
    }
    return value;
  },

  validateTakeProfitLevels: (data: Record<string, unknown>) => {
    const validated: Record<string, number> = {};
    
    const levels = [
      { key: 'takeProfitLevel1', name: 'Take profit level 1' },
      { key: 'takeProfitLevel2', name: 'Take profit level 2' },
      { key: 'takeProfitLevel3', name: 'Take profit level 3' },
      { key: 'takeProfitLevel4', name: 'Take profit level 4' },
      { key: 'takeProfitCustom', name: 'Custom take profit level' },
    ];

    for (const { key, name } of levels) {
      if (data[key] !== undefined) {
        validated[key] = validators.takeProfitLevel(Number(data[key]), name);
      }
    }

    return validated;
  }
};
```

## 5. **Component Loading States**

### Current Duplicate Pattern:
Many components have similar loading/error states:

```typescript
// Repeated pattern in multiple components
if (isLoading) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center text-muted-foreground">Loading...</div>
      </CardContent>
    </Card>
  );
}

if (error) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="text-center text-red-500">Error: {error.message}</div>
      </CardContent>
    </Card>
  );
}
```

### Refactoring Recommendation:
Create reusable loading components:

```typescript
// src/components/ui/data-state.tsx
interface DataStateProps {
  isLoading?: boolean;
  error?: Error | null;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: React.ReactNode;
}

export function DataState({ isLoading, error, isEmpty, emptyMessage, children }: DataStateProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-200">
        <CardContent className="p-6">
          <div className="flex items-center text-red-500">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>Error: {error.message}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isEmpty) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">
            {emptyMessage || "No data available"}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
```

## 6. **Error Handling in Services**

### Current Duplicate Pattern:
Similar error handling logic in service methods:

```typescript
// Pattern in mexc-api-client.ts and other services
catch (error) {
  const isTimeoutError = error instanceof Error && 
    (error.name === "AbortError" || 
     error.message.includes("timeout") || 
     error.message.includes("Connect Timeout"));

  const isConnectionError = error instanceof Error &&
    (error.message.includes("fetch failed") ||
     error.message.includes("ECONNRESET") ||
     error.message.includes("ENOTFOUND"));

  // ... similar handling logic
}
```

### Refactoring Recommendation:
Create an error classifier:

```typescript
// src/lib/error-utils.ts
export class ErrorClassifier {
  static isTimeout(error: unknown): boolean {
    return error instanceof Error && (
      error.name === "AbortError" ||
      error.message.toLowerCase().includes("timeout")
    );
  }

  static isConnection(error: unknown): boolean {
    return error instanceof Error && (
      error.message.includes("fetch failed") ||
      error.message.includes("ECONNRESET") ||
      error.message.includes("ENOTFOUND") ||
      error.message.includes("ETIMEDOUT")
    );
  }

  static isRetryable(error: unknown): boolean {
    return this.isTimeout(error) || this.isConnection(error);
  }

  static getErrorType(error: unknown): string {
    if (this.isTimeout(error)) return "timeout";
    if (this.isConnection(error)) return "connection";
    if (error instanceof Error && error.message.includes("401")) return "auth";
    if (error instanceof Error && error.message.includes("429")) return "rate_limit";
    return "unknown";
  }
}
```

## 7. **Database Query Patterns**

### Current Duplicate Pattern:
Similar database query patterns with error handling:

```typescript
// Pattern in multiple services
try {
  const result = await db
    .select()
    .from(table)
    .where(eq(table.field, value))
    .limit(1);
  
  if (result.length === 0) {
    return null;
  }
  
  return result[0];
} catch (error) {
  console.error("Database query failed:", error);
  throw error;
}
```

### Refactoring Recommendation:
Create a database query helper:

```typescript
// src/lib/db-helpers.ts
export class DbHelpers {
  static async findOne<T>(
    query: () => Promise<T[]>,
    errorMessage = "Database query failed"
  ): Promise<T | null> {
    try {
      const result = await query();
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error(errorMessage, error);
      throw error;
    }
  }

  static async findMany<T>(
    query: () => Promise<T[]>,
    errorMessage = "Database query failed"
  ): Promise<T[]> {
    try {
      return await query();
    } catch (error) {
      console.error(errorMessage, error);
      throw error;
    }
  }

  static async upsert<T>(
    table: any,
    data: any,
    conflictColumns: string[],
    returning = true
  ): Promise<T | null> {
    try {
      const result = await db
        .insert(table)
        .values(data)
        .onConflictDoUpdate({
          target: conflictColumns,
          set: data,
        })
        .returning();
      
      return returning && result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error("Database upsert failed:", error);
      throw error;
    }
  }
}
```

## Implementation Priority

1. **High Priority** - API Response Handler (affects all API routes)
2. **High Priority** - API Client for hooks (affects all data fetching)
3. **Medium Priority** - Error Classification (improves error handling)
4. **Medium Priority** - Validation Utilities (reduces code duplication)
5. **Low Priority** - Component State Handlers (improves UX consistency)
6. **Low Priority** - Database Helpers (nice to have)

## Estimated Impact

- **Code Reduction**: ~30-40% in API routes and hooks
- **Consistency**: Unified error handling and response formats
- **Maintainability**: Single source of truth for common patterns
- **Type Safety**: Better TypeScript inference with generic utilities
- **Testing**: Easier to test centralized utilities