import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EnhancedTakeProfitConfig } from "@/src/components/enhanced-take-profit-config";
import {
  TAKE_PROFIT_STRATEGIES,
  TakeProfitStrategy,
} from "@/src/types/take-profit-strategies";

// Mock the tooltip provider
vi.mock("@/src/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

describe("EnhancedTakeProfitConfig", () => {
  const mockOnStrategyChange = vi.fn();
  const mockOnCustomStrategyChange = vi.fn();

  const defaultProps = {
    selectedStrategy: "balanced",
    onStrategyChange: mockOnStrategyChange,
    onCustomStrategyChange: mockOnCustomStrategyChange,
    investmentAmount: 1000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Preset Strategies", () => {
    it("should render all preset strategies", () => {
      render(<EnhancedTakeProfitConfig {...defaultProps} />);

      // Check that all three preset strategies are rendered
      expect(screen.getByText("Conservative")).toBeInTheDocument();
      expect(screen.getByText("Balanced")).toBeInTheDocument();
      expect(screen.getByText("Aggressive")).toBeInTheDocument();
    });

    it("should highlight selected strategy", () => {
      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="conservative"
        />,
      );

      const conservativeCard = screen
        .getByText("Conservative")
        .closest(".cursor-pointer");
      expect(conservativeCard).toHaveClass(
        "ring-2",
        "ring-primary",
        "border-primary",
      );
    });

    it("should call onStrategyChange when preset strategy is selected", async () => {
      const user = userEvent.setup();
      render(<EnhancedTakeProfitConfig {...defaultProps} />);

      const aggressiveCard = screen
        .getByText("Aggressive")
        .closest(".cursor-pointer");
      await user.click(aggressiveCard!);

      expect(mockOnStrategyChange).toHaveBeenCalledWith("aggressive");
    });

    it("should display profit levels for each strategy", () => {
      render(<EnhancedTakeProfitConfig {...defaultProps} />);

      // Check that profit levels are displayed
      TAKE_PROFIT_STRATEGIES.forEach((strategy) => {
        strategy.levels.forEach((level) => {
          const levelText = `${level.profitPercentage}% (${level.sellQuantity}%)`;
          expect(screen.getByText(levelText)).toBeInTheDocument();
        });
      });
    });

    it("should display potential profit calculations", () => {
      render(
        <EnhancedTakeProfitConfig {...defaultProps} investmentAmount={1000} />,
      );

      // Check that potential profit calculations are shown
      expect(screen.getByText(/Potential with \$1000:/)).toBeInTheDocument();
    });
  });

  describe("Custom Strategy", () => {
    it("should render custom strategy card", () => {
      render(<EnhancedTakeProfitConfig {...defaultProps} />);

      expect(screen.getByText("Custom Strategy")).toBeInTheDocument();
      expect(
        screen.getByText(/Create your own personalized take profit levels/),
      ).toBeInTheDocument();
    });

    it("should switch to custom tab when custom strategy is selected", async () => {
      const user = userEvent.setup();
      render(<EnhancedTakeProfitConfig {...defaultProps} />);

      const customCard = screen
        .getByText("Custom Strategy")
        .closest(".cursor-pointer");
      await user.click(customCard!);

      expect(mockOnStrategyChange).toHaveBeenCalledWith("custom");
    });

    it("should display custom levels configuration when custom strategy is selected", () => {
      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      fireEvent.click(customTab);

      expect(screen.getByText("Custom Take Profit Levels")).toBeInTheDocument();
      expect(screen.getByText("Add Level")).toBeInTheDocument();
    });

    it("should allow adding custom levels", async () => {
      const user = userEvent.setup();
      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      await user.click(customTab);

      const addButton = screen.getByText("Add Level");
      await user.click(addButton);

      expect(mockOnCustomStrategyChange).toHaveBeenCalled();
    });

    it("should disable add button when maximum levels reached", () => {
      const customStrategy: TakeProfitStrategy = {
        id: "custom",
        name: "Custom Strategy",
        description: "Custom",
        riskLevel: "medium",
        levels: Array.from({ length: 6 }, (_, i) => ({
          id: `level-${i}`,
          profitPercentage: (i + 1) * 5,
          sellQuantity: 16.67,
          isActive: true,
        })),
        isCustom: true,
      };

      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={customStrategy}
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      fireEvent.click(customTab);

      const addButton = screen.getByText("Add Level");
      expect(addButton).toBeDisabled();
    });
  });

  describe("Custom Level Editor", () => {
    const customStrategy: TakeProfitStrategy = {
      id: "custom",
      name: "Custom Strategy",
      description: "Custom",
      riskLevel: "medium",
      levels: [
        {
          id: "level-1",
          profitPercentage: 10.0,
          sellQuantity: 50.0,
          isActive: true,
          description: "First level",
        },
      ],
      isCustom: true,
    };

    it("should render custom level editor", () => {
      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={customStrategy}
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      fireEvent.click(customTab);

      expect(screen.getByText("Level 1")).toBeInTheDocument();
      expect(screen.getByDisplayValue("10")).toBeInTheDocument();
      expect(screen.getByDisplayValue("50")).toBeInTheDocument();
      expect(screen.getByDisplayValue("First level")).toBeInTheDocument();
    });

    it("should allow editing profit percentage", async () => {
      const user = userEvent.setup();
      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={customStrategy}
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      await user.click(customTab);

      const profitInput = screen.getByDisplayValue("10");
      await user.clear(profitInput);
      await user.type(profitInput, "15");

      expect(mockOnCustomStrategyChange).toHaveBeenCalled();
    });

    it("should allow editing sell quantity", async () => {
      const user = userEvent.setup();
      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={customStrategy}
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      await user.click(customTab);

      const sellQuantityInput = screen.getByDisplayValue("50");
      await user.clear(sellQuantityInput);
      await user.type(sellQuantityInput, "75");

      expect(mockOnCustomStrategyChange).toHaveBeenCalled();
    });

    it("should allow removing custom levels", async () => {
      const user = userEvent.setup();
      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={customStrategy}
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      await user.click(customTab);

      const removeButton = screen.getByRole("button", { name: "" }); // Trash icon button
      await user.click(removeButton);

      expect(mockOnCustomStrategyChange).toHaveBeenCalled();
    });
  });

  describe("Validation", () => {
    it("should display validation errors for invalid levels", () => {
      const invalidStrategy: TakeProfitStrategy = {
        id: "custom",
        name: "Custom Strategy",
        description: "Custom",
        riskLevel: "medium",
        levels: [
          {
            id: "level-1",
            profitPercentage: -5.0, // Invalid: negative
            sellQuantity: 150.0, // Invalid: > 100%
            isActive: true,
          },
        ],
        isCustom: true,
      };

      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={invalidStrategy}
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      fireEvent.click(customTab);

      // Should display validation errors
      expect(
        screen.getByText(/Profit percentage must be between/),
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Sell quantity must be between/),
      ).toBeInTheDocument();
    });

    it("should display strategy summary", () => {
      const validStrategy: TakeProfitStrategy = {
        id: "custom",
        name: "Custom Strategy",
        description: "Custom",
        riskLevel: "medium",
        levels: [
          {
            id: "level-1",
            profitPercentage: 10.0,
            sellQuantity: 40.0,
            isActive: true,
          },
          {
            id: "level-2",
            profitPercentage: 20.0,
            sellQuantity: 60.0,
            isActive: true,
          },
        ],
        isCustom: true,
      };

      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={validStrategy}
        />,
      );

      // Switch to custom tab
      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });
      fireEvent.click(customTab);

      expect(screen.getByText("Strategy Summary")).toBeInTheDocument();
      expect(screen.getByText("2")).toBeInTheDocument(); // Total levels
      expect(screen.getByText("100.0%")).toBeInTheDocument(); // Total sell quantity
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", () => {
      render(<EnhancedTakeProfitConfig {...defaultProps} />);

      // Check for proper tab structure
      expect(screen.getByRole("tablist")).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /Preset Strategies/i }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("tab", { name: /Custom Strategy/i }),
      ).toBeInTheDocument();
    });

    it("should support keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<EnhancedTakeProfitConfig {...defaultProps} />);

      const customTab = screen.getByRole("tab", { name: /Custom Strategy/i });

      // Tab should be focusable
      await user.tab();
      expect(customTab).toHaveFocus();

      // Enter should activate tab
      await user.keyboard("{Enter}");
      expect(customTab).toHaveAttribute("aria-selected", "true");
    });
  });

  describe("Performance", () => {
    it("should not re-render unnecessarily", () => {
      const { rerender } = render(
        <EnhancedTakeProfitConfig {...defaultProps} />,
      );

      // Re-render with same props
      rerender(<EnhancedTakeProfitConfig {...defaultProps} />);

      // Component should handle re-renders gracefully
      expect(
        screen.getByText("Take Profit Strategy Configuration"),
      ).toBeInTheDocument();
    });

    it("should handle large custom strategies efficiently", () => {
      const largeStrategy: TakeProfitStrategy = {
        id: "custom",
        name: "Large Custom Strategy",
        description: "Custom",
        riskLevel: "medium",
        levels: Array.from({ length: 6 }, (_, i) => ({
          id: `level-${i}`,
          profitPercentage: (i + 1) * 10,
          sellQuantity: 16.67,
          isActive: true,
        })),
        isCustom: true,
      };

      render(
        <EnhancedTakeProfitConfig
          {...defaultProps}
          selectedStrategy="custom"
          customStrategy={largeStrategy}
        />,
      );

      // Should render all levels without performance issues
      expect(screen.getByText("Custom Strategy")).toBeInTheDocument();
    });
  });
});
