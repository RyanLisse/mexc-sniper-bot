"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Info,
  Save,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Separator } from "./ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

interface TakeProfitLevel {
  id: string;
  level: string;
  profitPercentage: number;
  sellPortion: number;
  actionWhenReached: string;
}

interface EditableTakeProfitTableProps {
  levels?: TakeProfitLevel[];
  onLevelsChange?: (levels: TakeProfitLevel[]) => void;
  onSave?: (levels: TakeProfitLevel[]) => Promise<void>;
  className?: string;
  isLoading?: boolean;
}

interface ValidationError {
  field: string;
  levelId?: string;
  message: string;
  type: "error" | "warning";
}

const defaultLevels: TakeProfitLevel[] = [
  {
    id: "tp1",
    level: "TP1",
    profitPercentage: 30,
    sellPortion: 25,
    actionWhenReached: "Sell 25%",
  },
  {
    id: "tp2",
    level: "TP2",
    profitPercentage: 50,
    sellPortion: 25,
    actionWhenReached: "Sell another 25%",
  },
  {
    id: "tp3",
    level: "TP3",
    profitPercentage: 75,
    sellPortion: 25,
    actionWhenReached: "Sell another 25%",
  },
  {
    id: "tp4",
    level: "TP4",
    profitPercentage: 100,
    sellPortion: 25,
    actionWhenReached: "Sell final 25%",
  },
];

export function EditableTakeProfitTable({
  levels = defaultLevels,
  onLevelsChange,
  onSave,
  className,
  isLoading = false,
}: EditableTakeProfitTableProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editingLevels, setEditingLevels] = useState<TakeProfitLevel[]>(levels);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Validation helper functions - extracted to reduce complexity

  const validateProfitPercentage = (level: TakeProfitLevel): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (level.profitPercentage <= 0) {
      errors.push({
        field: "profitPercentage",
        levelId: level.id,
        message: `${level.level}: Profit percentage must be greater than 0%`,
        type: "error",
      });
    }
    if (level.profitPercentage < 5) {
      errors.push({
        field: "profitPercentage",
        levelId: level.id,
        message: `${level.level}: Profit percentage below 5% may not be profitable after fees`,
        type: "warning",
      });
    }
    if (level.profitPercentage > 1000) {
      errors.push({
        field: "profitPercentage",
        levelId: level.id,
        message: `${level.level}: Profit percentage above 1000% seems unrealistic`,
        type: "warning",
      });
    }

    return errors;
  };

  const validateSellPortion = (level: TakeProfitLevel): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (level.sellPortion <= 0) {
      errors.push({
        field: "sellPortion",
        levelId: level.id,
        message: `${level.level}: Sell portion must be greater than 0%`,
        type: "error",
      });
    }
    if (level.sellPortion > 100) {
      errors.push({
        field: "sellPortion",
        levelId: level.id,
        message: `${level.level}: Sell portion cannot exceed 100%`,
        type: "error",
      });
    }

    return errors;
  };

  const validateLevelProgression = (
    level: TakeProfitLevel,
    sortedLevels: TakeProfitLevel[]
  ): ValidationError[] => {
    const errors: ValidationError[] = [];

    const currentIndex = sortedLevels.findIndex((l) => l.id === level.id);
    if (currentIndex > 0) {
      const prevLevel = sortedLevels[currentIndex - 1];
      if (prevLevel && level.profitPercentage <= prevLevel.profitPercentage) {
        errors.push({
          field: "profitPercentage",
          levelId: level.id,
          message: `${level.level}: Should have higher profit % than previous levels`,
          type: "warning",
        });
      }
    }

    return errors;
  };

  const validateActionDescription = (level: TakeProfitLevel): ValidationError[] => {
    const errors: ValidationError[] = [];

    if (!level.actionWhenReached.trim()) {
      errors.push({
        field: "actionWhenReached",
        levelId: level.id,
        message: `${level.level}: Action description is required`,
        type: "error",
      });
    }

    return errors;
  };

  const validateSingleLevel = (
    level: TakeProfitLevel,
    sortedLevels: TakeProfitLevel[]
  ): ValidationError[] => {
    return [
      ...validateProfitPercentage(level),
      ...validateSellPortion(level),
      ...validateLevelProgression(level, sortedLevels),
      ...validateActionDescription(level),
    ];
  };

  // Simplified validation function
  const validateConfiguration = useCallback((levels: TakeProfitLevel[]): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Validate levels array
    if (levels.length === 0) {
      errors.push({
        field: "levels",
        message: "At least one take-profit level is required",
        type: "error",
      });
      return errors;
    }

    // Sort levels by profit percentage for validation
    const sortedLevels = [...levels].sort((a, b) => a.profitPercentage - b.profitPercentage);

    // Validate each level using extracted functions
    levels.forEach((level) => {
      errors.push(...validateSingleLevel(level, sortedLevels));
    });

    // Total sell portion validation
    const totalSellPortion = levels.reduce((sum, level) => sum + level.sellPortion, 0);
    if (Math.abs(totalSellPortion - 100) > 0.01) {
      errors.push({
        field: "totalSellPortion",
        message: `Total sell portions must equal 100% (currently ${totalSellPortion.toFixed(1)}%)`,
        type: "error",
      });
    }

    return errors;
  }, []);

  // Update editing levels when props change
  useEffect(() => {
    setEditingLevels(levels);
  }, [levels]);

  // Validate configuration whenever levels change
  useEffect(() => {
    if (isEditing) {
      const errors = validateConfiguration(editingLevels);
      setValidationErrors(errors);
    }
  }, [editingLevels, isEditing, validateConfiguration]);

  // Validation: Check for errors and warnings
  const hasErrors = useMemo(() => {
    return validationErrors.some((error) => error.type === "error");
  }, [validationErrors]);

  const _hasWarnings = useMemo(() => {
    return validationErrors.some((error) => error.type === "warning");
  }, [validationErrors]);

  const isValidConfiguration = !hasErrors;

  // Update a specific level
  const updateLevel = (levelId: string, field: keyof TakeProfitLevel, value: string | number) => {
    const updatedLevels = editingLevels.map((level) =>
      level.id === levelId ? { ...level, [field]: value } : level
    );
    setEditingLevels(updatedLevels);
    onLevelsChange?.(updatedLevels);
  };

  // Handle save with comprehensive error handling
  const handleSave = async () => {
    if (!isValidConfiguration) {
      return;
    }

    if (!onSave) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(editingLevels);
      setIsEditing(false);
      setValidationErrors([]);
    } catch (error) {
      console.error("Failed to save take-profit levels:", error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save configuration. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setEditingLevels(levels);
    setValidationErrors([]);
    setSaveError(null);
    setIsEditing(false);
  };

  // Auto-generate action descriptions
  const generateActionDescription = (levelIndex: number, sellPortion: number): string => {
    if (levelIndex === 0) return `Sell ${sellPortion}%`;
    if (levelIndex === editingLevels.length - 1) return `Sell final ${sellPortion}%`;
    return `Sell another ${sellPortion}%`;
  };

  // Get validation errors for a specific field and level
  const getFieldErrors = (field: string, levelId?: string) => {
    return validationErrors.filter(
      (error) => error.field === field && (!levelId || error.levelId === levelId)
    );
  };

  // Check if a field has errors
  const hasFieldError = (field: string, levelId?: string) => {
    return getFieldErrors(field, levelId).some((error) => error.type === "error");
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />📊 Take-Profit Levels Configuration
            </CardTitle>
            <CardDescription>
              Configure multiple exit levels to maximize profits and manage risk automatically
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <Button
                onClick={() => setIsEditing(true)}
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Edit Table
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSave}
                  disabled={!isValidConfiguration || isSaving || isLoading}
                  size="sm"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                >
                  {isSaving || isLoading ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  size="sm"
                  disabled={isSaving || isLoading}
                  className="flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* How It Works Info */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>How Take-Profit Levels Work:</strong> Instead of selling your entire position at
            once, this strategy sells portions at different profit targets. This helps you capture
            gains while keeping exposure for potentially higher profits.
          </AlertDescription>
        </Alert>

        {/* Main Table */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Take-Profit Level</TableHead>
                <TableHead className="w-[120px]">Profit (%)</TableHead>
                <TableHead className="w-[140px]">Sell Portion (%)</TableHead>
                <TableHead>Action When Reached</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {editingLevels.map((level, index) => (
                <TableRow key={level.id}>
                  {/* Take-Profit Level */}
                  <TableCell className="font-medium">
                    <Badge variant="outline" className="font-mono">
                      {level.level}
                    </Badge>
                  </TableCell>

                  {/* Profit Percentage - Editable */}
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={level.profitPercentage}
                        onChange={(e) =>
                          updateLevel(
                            level.id,
                            "profitPercentage",
                            Number.parseFloat(e.target.value) || 0
                          )
                        }
                        className={`w-20 text-center ${
                          hasFieldError("profitPercentage", level.id)
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : ""
                        }`}
                        min="0"
                        step="1"
                      />
                    ) : (
                      <span className="font-mono">{level.profitPercentage}%</span>
                    )}
                  </TableCell>

                  {/* Sell Portion - Editable */}
                  <TableCell>
                    {isEditing ? (
                      <Input
                        type="number"
                        value={level.sellPortion}
                        onChange={(e) => {
                          const newValue = Number.parseFloat(e.target.value) || 0;
                          updateLevel(level.id, "sellPortion", newValue);
                          updateLevel(
                            level.id,
                            "actionWhenReached",
                            generateActionDescription(index, newValue)
                          );
                        }}
                        className={`w-20 text-center ${
                          hasFieldError("sellPortion", level.id)
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : ""
                        }`}
                        min="0"
                        max="100"
                        step="1"
                      />
                    ) : (
                      <span className="font-mono">{level.sellPortion}%</span>
                    )}
                  </TableCell>

                  {/* Action When Reached - Auto-generated or Editable */}
                  <TableCell>
                    {isEditing ? (
                      <Input
                        value={level.actionWhenReached}
                        onChange={(e) => updateLevel(level.id, "actionWhenReached", e.target.value)}
                        className={`min-w-[200px] ${
                          hasFieldError("actionWhenReached", level.id)
                            ? "border-red-500 focus:border-red-500 focus:ring-red-500"
                            : ""
                        }`}
                        placeholder={generateActionDescription(index, level.sellPortion)}
                      />
                    ) : (
                      <span>{level.actionWhenReached}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Save Error Display */}
        {saveError && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Save Failed:</strong> {saveError}
            </AlertDescription>
          </Alert>
        )}

        {/* Comprehensive Validation Feedback */}
        {isEditing && validationErrors.length > 0 && (
          <div className="space-y-3">
            {/* Error Summary */}
            <Alert
              className={`border ${hasErrors ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}
            >
              {hasErrors ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Configuration Issues Found:</strong> Please fix the errors below before
                    saving.
                  </AlertDescription>
                </>
              ) : (
                <>
                  <Info className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Warnings:</strong> Configuration is valid but please review the warnings
                    below.
                  </AlertDescription>
                </>
              )}
            </Alert>

            {/* Detailed Error List */}
            <div className="space-y-2">
              {validationErrors.map((error, index) => (
                <Alert
                  key={`validation-error-${index}-${error.message.slice(0, 10)}`}
                  className={`border ${error.type === "error" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"}`}
                >
                  {error.type === "error" ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Info className="h-4 w-4 text-yellow-600" />
                  )}
                  <AlertDescription
                    className={error.type === "error" ? "text-red-800" : "text-yellow-800"}
                  >
                    {error.type === "error" ? "❌" : "⚠️"} {error.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Success Validation Feedback */}
        {isEditing && validationErrors.length === 0 && (
          <Alert className="border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              ✅ <strong>Valid Configuration:</strong> All checks passed. Ready to save!
            </AlertDescription>
          </Alert>
        )}

        <Separator />

        {/* Simulation Results */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />✅ Result using the above simulation
          </h4>
          <div className="grid gap-2 text-sm">
            {editingLevels.map((level) => (
              <div key={level.id} className="flex items-center gap-2 text-muted-foreground">
                <span>•</span>
                <span>
                  At <strong className="text-green-600">{level.profitPercentage}% profit</strong>,{" "}
                  {level.actionWhenReached.toLowerCase()}.
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Trailing Stop Question */}
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Question:</strong> Would you also like to add a trailing stop after the last
            sale (e.g., as extra protection against a drop)? 🎯
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
