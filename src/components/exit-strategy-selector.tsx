/**
 * Exit Strategy Selector Stub
 * Minimal implementation to fix TypeScript compilation
 */

import type { ExitStrategy } from "../types/exit-strategies";

export interface ExitStrategySelectorProps {
  value?: ExitStrategy;
  onChange?: (value: ExitStrategy) => void;
  disabled?: boolean;
  [key: string]: unknown;
}

export function ExitStrategySelector(_props: ExitStrategySelectorProps) {
  return (
    <div>
      {/* Stub implementation */}
      <p>Exit Strategy Selector (stub)</p>
    </div>
  );
}
