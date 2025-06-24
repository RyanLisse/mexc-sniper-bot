"use client";

import { useState } from "react";
import { useTakeProfitLevels, useUpdateTakeProfitLevels } from "../hooks/use-user-preferences";
import { createSafeLogger } from "../lib/structured-logger";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";

interface TakeProfitLevelsProps {
  userId: string;
}

const logger = createSafeLogger("take-profit-levels");

export function TakeProfitLevels({ userId }: TakeProfitLevelsProps) {
  const { levels, defaultLevel, customLevel } = useTakeProfitLevels(userId);
  const updateTakeProfitLevels = useUpdateTakeProfitLevels();

  const [editingLevels, setEditingLevels] = useState(false);
  const [tempLevels, setTempLevels] = useState(levels);
  const [tempDefaultLevel, setTempDefaultLevel] = useState(defaultLevel);
  const [tempCustomLevel, setTempCustomLevel] = useState(customLevel);

  const handleSaveLevels = async () => {
    try {
      await updateTakeProfitLevels.mutateAsync({
        userId,
        levels: {
          level1: tempLevels[0].value,
          level2: tempLevels[1].value,
          level3: tempLevels[2].value,
          level4: tempLevels[3].value,
          custom: tempCustomLevel,
        },
        defaultLevel: tempDefaultLevel,
      });
      setEditingLevels(false);
    } catch (error) {
      logger.error("Failed to save take profit levels:", error);
    }
  };

  const handleCancelEdit = () => {
    setTempLevels(levels);
    setTempDefaultLevel(defaultLevel);
    setTempCustomLevel(customLevel);
    setEditingLevels(false);
  };

  const updateTempLevel = (index: number, value: number) => {
    const newLevels = [...tempLevels];
    newLevels[index] = { ...newLevels[index], value };
    setTempLevels(newLevels);
  };

  return (
    <Card className="bg-slate-800/50 border-slate-700 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-white">Take Profit Levels</CardTitle>
        <CardDescription className="text-slate-400">
          Configure your default take profit percentages for different risk levels
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Levels Display */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {(editingLevels ? tempLevels : levels).map((level, index) => (
            <TakeProfitLevelCard
              key={level.id}
              level={level}
              index={index}
              isEditing={editingLevels}
              isDefault={level.id === (editingLevels ? tempDefaultLevel : defaultLevel)}
              onUpdateLevel={updateTempLevel}
              onSetDefault={() => setTempDefaultLevel(level.id)}
            />
          ))}
        </div>

        {/* Custom Level */}
        <CustomLevelSection
          editingLevels={editingLevels}
          customLevel={editingLevels ? tempCustomLevel : customLevel}
          onCustomLevelChange={setTempCustomLevel}
        />

        {/* Action Buttons */}
        <TakeProfitLevelActions
          editingLevels={editingLevels}
          onEdit={() => setEditingLevels(true)}
          onSave={handleSaveLevels}
          onCancel={handleCancelEdit}
          isLoading={updateTakeProfitLevels.isPending}
        />
      </CardContent>
    </Card>
  );
}

interface TakeProfitLevelCardProps {
  level: {
    id: number;
    name: string;
    value: number;
    description: string;
  };
  index: number;
  isEditing: boolean;
  isDefault: boolean;
  onUpdateLevel: (index: number, value: number) => void;
  onSetDefault: () => void;
}

function TakeProfitLevelCard({
  level,
  index,
  isEditing,
  isDefault,
  onUpdateLevel,
  onSetDefault,
}: TakeProfitLevelCardProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-white">{level.name}</span>
        {isDefault && (
          <Badge variant="default" className="text-xs bg-green-600 text-white">
            Default
          </Badge>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <Input
            type="number"
            value={level.value}
            onChange={(e) => onUpdateLevel(index, Number.parseFloat(e.target.value) || 0)}
            min="0.1"
            max="100"
            step="0.1"
            className="text-center bg-slate-700 border-slate-600 text-white"
          />
          <Button
            variant={isDefault ? "default" : "outline"}
            size="sm"
            className={`w-full ${
              isDefault
                ? "bg-green-600 hover:bg-green-700 text-white"
                : "border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
            onClick={onSetDefault}
          >
            {isDefault ? "Default" : "Set Default"}
          </Button>
        </div>
      ) : (
        <div className="text-center p-3 bg-slate-700/30 border border-slate-600/50 rounded-lg">
          <div className="text-2xl font-bold text-green-400">{level.value}%</div>
          <div className="text-xs text-slate-400 mt-1">{level.description}</div>
        </div>
      )}
    </div>
  );
}

interface CustomLevelSectionProps {
  editingLevels: boolean;
  customLevel?: number;
  onCustomLevelChange: (value?: number) => void;
}

function CustomLevelSection({
  editingLevels,
  customLevel,
  onCustomLevelChange,
}: CustomLevelSectionProps) {
  return (
    <div className="space-y-2">
      <label htmlFor="custom-take-profit" className="text-sm font-medium text-white">
        Custom Level (Optional)
      </label>
      {editingLevels ? (
        <div className="flex items-center space-x-2">
          <Input
            id="custom-take-profit"
            type="number"
            value={customLevel || ""}
            onChange={(e) => onCustomLevelChange(Number.parseFloat(e.target.value) || undefined)}
            placeholder="Enter custom percentage"
            min="0.1"
            max="1000"
            step="0.1"
            className="max-w-xs bg-slate-700 border-slate-600 text-white"
          />
          <span className="text-sm text-slate-400">%</span>
        </div>
      ) : (
        <div className="text-sm text-slate-400">
          {customLevel ? `${customLevel}% - Custom user-defined level` : "Not set"}
        </div>
      )}
    </div>
  );
}

interface TakeProfitLevelActionsProps {
  editingLevels: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  isLoading: boolean;
}

function TakeProfitLevelActions({
  editingLevels,
  onEdit,
  onSave,
  onCancel,
  isLoading,
}: TakeProfitLevelActionsProps) {
  return (
    <div className="flex items-center space-x-2">
      {editingLevels ? (
        <>
          <Button
            onClick={onSave}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            variant="outline"
            onClick={onCancel}
            className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
          >
            Cancel
          </Button>
        </>
      ) : (
        <Button onClick={onEdit} className="bg-blue-600 hover:bg-blue-700 text-white">
          Edit Levels
        </Button>
      )}
    </div>
  );
}
