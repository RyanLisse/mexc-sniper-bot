import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, TrendingUp, Shield, Zap, Target, DollarSign } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const PRESET_STRATEGIES = {
  conservative: {
    name: 'Conservative (2x)',
    target: 2,
    levels: [
      { percent: 30, sellPercent: 25 },
      { percent: 50, sellPercent: 25 },
      { percent: 75, sellPercent: 25 },
      { percent: 100, sellPercent: 25 }
    ],
    stopLoss: 10,
    description: 'Lower risk, steady gains'
  },
  balanced: {
    name: 'Balanced (5x)',
    target: 5,
    levels: [
      { percent: 100, sellPercent: 15 },
      { percent: 200, sellPercent: 25 },
      { percent: 300, sellPercent: 35 },
      { percent: 400, sellPercent: 25 }
    ],
    stopLoss: 15,
    description: 'Moderate risk/reward'
  },
  aggressive: {
    name: 'Aggressive (10x)',
    target: 10,
    levels: [
      { percent: 200, sellPercent: 10 },
      { percent: 500, sellPercent: 20 },
      { percent: 700, sellPercent: 30 },
      { percent: 900, sellPercent: 40 }
    ],
    stopLoss: 20,
    description: 'High risk, high reward'
  }
};

export default function TradingSettings() {
  const [selectedStrategy, setSelectedStrategy] = useState('balanced');
  const [customLevels, setCustomLevels] = useState([
    { percent: 50, sellPercent: 25 },
    { percent: 100, sellPercent: 25 },
    { percent: 200, sellPercent: 25 },
    { percent: 300, sellPercent: 25 }
  ]);
  const [stopLoss, setStopLoss] = useState(15);
  const [trailingStop, setTrailingStop] = useState(true);
  const [maxPosition, setMaxPosition] = useState(1000);

  const currentStrategy = selectedStrategy === 'custom' 
    ? { levels: customLevels, stopLoss, name: 'Custom Strategy' }
    : { ...PRESET_STRATEGIES[selectedStrategy], stopLoss: PRESET_STRATEGIES[selectedStrategy].stopLoss };

  const handleLevelChange = (index, field, value) => {
    const newLevels = [...customLevels];
    newLevels[index][field] = parseInt(value) || 0;
    setCustomLevels(newLevels);
  };

  const addLevel = () => {
    if (customLevels.length < 6) {
      const lastPercent = customLevels[customLevels.length - 1]?.percent || 0;
      setCustomLevels([...customLevels, { percent: lastPercent + 100, sellPercent: 20 }]);
    }
  };

  const removeLevel = (index) => {
    if (customLevels.length > 2) {
      setCustomLevels(customLevels.filter((_, i) => i !== index));
    }
  };

  const totalSellPercent = useMemo(() => {
    return currentStrategy.levels.reduce((sum, level) => sum + level.sellPercent, 0);
  }, [currentStrategy]);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Trading Settings</h1>
            <p className="text-muted-foreground">Configure your exit strategy and risk management</p>
          </div>
          <Button size="lg" className="gap-2">
            <Shield className="h-4 w-4" />
            Save Strategy
          </Button>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Strategy Selection */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Exit Strategy</CardTitle>
              <CardDescription>Choose your profit-taking approach</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup value={selectedStrategy} onValueChange={setSelectedStrategy}>
                <div className="space-y-3">
                  {Object.entries(PRESET_STRATEGIES).map(([key, strategy]) => (
                    <div
                      key={key}
                      className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                        selectedStrategy === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedStrategy(key)}
                    >
                      <RadioGroupItem value={key} id={key} className="mt-1" />
                      <Label htmlFor={key} className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{strategy.name}</span>
                          <Badge variant={key === 'conservative' ? 'secondary' : key === 'balanced' ? 'default' : 'destructive'}>
                            {strategy.target}x Target
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{strategy.description}</p>
                        <div className="mt-2 flex items-center gap-4 text-xs">
                          <span className="flex items-center gap-1">
                            <Target className="h-3 w-3" />
                            {strategy.levels.length} levels
                          </span>
                          <span className="flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {strategy.stopLoss}% stop
                          </span>
                        </div>
                      </Label>
                    </div>
                  ))}
                  
                  {/* Custom Option */}
                  <div
                    className={`relative flex items-start space-x-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                      selectedStrategy === 'custom' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedStrategy('custom')}
                  >
                    <RadioGroupItem value="custom" id="custom" className="mt-1" />
                    <Label htmlFor="custom" className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">Custom Strategy</span>
                        <Badge variant="outline">Advanced</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">Define your own exit levels</p>
                    </Label>
                  </div>
                </div>
              </RadioGroup>
            </CardContent>
          </Card>

          {/* Strategy Configuration */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Strategy Configuration</CardTitle>
              <CardDescription>Fine-tune your selected strategy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Visual Chart */}
              <div className="bg-muted/30 rounded-lg p-6 relative overflow-hidden">
                <div className="absolute inset-0 opacity-5">
                  <svg width="100%" height="100%">
                    <defs>
                      <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                </div>
                
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-medium">Profit Distribution</h3>
                    <Badge variant="outline" className="gap-1">
                      <TrendingUp className="h-3 w-3" />
                      {currentStrategy.name}
                    </Badge>
                  </div>
                  
                  <div className="flex items-end justify-between h-40 mb-4">
                    {currentStrategy.levels.map((level, index) => (
                      <div key={index} className="flex-1 flex flex-col items-center">
                        <div 
                          className="w-full max-w-16 bg-primary rounded-t transition-all"
                          style={{ height: `${(level.sellPercent / 40) * 100}%` }}
                        />
                        <div className="text-center mt-2">
                          <p className="text-xs text-muted-foreground">+{level.percent}%</p>
                          <p className="text-sm font-semibold">{level.sellPercent}%</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {totalSellPercent !== 100 && (
                    <Alert variant="warning" className="mt-4">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Total sell percentage is {totalSellPercent}%. Adjust levels to reach 100%.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>

              <Tabs defaultValue="levels" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="levels">Exit Levels</TabsTrigger>
                  <TabsTrigger value="risk">Risk Management</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="levels" className="space-y-4 mt-6">
                  {selectedStrategy === 'custom' ? (
                    <div className="space-y-3">
                      {customLevels.map((level, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 rounded-lg border">
                          <span className="text-sm font-medium w-16">Level {index + 1}</span>
                          <div className="flex items-center gap-2 flex-1">
                            <Label className="text-sm">Profit:</Label>
                            <Input
                              type="number"
                              value={level.percent}
                              onChange={(e) => handleLevelChange(index, 'percent', e.target.value)}
                              className="w-20 h-8"
                            />
                            <span className="text-sm">%</span>
                          </div>
                          <div className="flex items-center gap-2 flex-1">
                            <Label className="text-sm">Sell:</Label>
                            <Input
                              type="number"
                              value={level.sellPercent}
                              onChange={(e) => handleLevelChange(index, 'sellPercent', e.target.value)}
                              className="w-20 h-8"
                            />
                            <span className="text-sm">%</span>
                          </div>
                          {customLevels.length > 2 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLevel(index)}
                              className="h-8 w-8 p-0"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      ))}
                      {customLevels.length < 6 && (
                        <Button variant="outline" size="sm" onClick={addLevel} className="w-full">
                          Add Level
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {currentStrategy.levels.map((level, index) => (
                        <div key={index} className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center gap-4">
                            <Badge variant="outline">Level {index + 1}</Badge>
                            <span className="text-sm">Take profit at +{level.percent}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">Sell {level.sellPercent}%</span>
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="risk" className="space-y-6 mt-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="stop-loss" className="flex items-center gap-2 mb-2">
                        Stop Loss
                        <Badge variant="outline" className="text-xs">Protects downside</Badge>
                      </Label>
                      <div className="flex items-center gap-4">
                        <Slider
                          id="stop-loss"
                          value={[stopLoss]}
                          onValueChange={([value]) => setStopLoss(value)}
                          min={5}
                          max={30}
                          step={1}
                          className="flex-1"
                        />
                        <div className="w-20 text-right">
                          <span className="text-lg font-semibold">-{stopLoss}%</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <Zap className="h-5 w-5 text-primary" />
                        <div>
                          <Label htmlFor="trailing-stop" className="text-base">Trailing Stop</Label>
                          <p className="text-sm text-muted-foreground">Lock in profits as price rises</p>
                        </div>
                      </div>
                      <Switch
                        id="trailing-stop"
                        checked={trailingStop}
                        onCheckedChange={setTrailingStop}
                      />
                    </div>

                    <div>
                      <Label htmlFor="max-position" className="flex items-center gap-2 mb-2">
                        Maximum Position Size
                        <Badge variant="outline" className="text-xs">Per trade</Badge>
                      </Label>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">$</span>
                        <Input
                          id="max-position"
                          type="number"
                          value={maxPosition}
                          onChange={(e) => setMaxPosition(parseInt(e.target.value) || 0)}
                          className="flex-1"
                        />
                        <span className="text-muted-foreground">USDT</span>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="advanced" className="space-y-6 mt-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Advanced settings for experienced traders. Use with caution.
                    </AlertDescription>
                  </Alert>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Label className="text-base">Enable Partial Fills</Label>
                        <p className="text-sm text-muted-foreground">Allow orders to be partially filled</p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Label className="text-base">Auto-Rebalance</Label>
                        <p className="text-sm text-muted-foreground">Automatically adjust positions</p>
                      </div>
                      <Switch />
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-lg border">
                      <div>
                        <Label className="text-base">Slippage Protection</Label>
                        <p className="text-sm text-muted-foreground">Cancel orders with high slippage</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Strategy Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Strategy Type</p>
                <p className="text-lg font-semibold">{currentStrategy.name}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Exit Levels</p>
                <p className="text-lg font-semibold">{currentStrategy.levels.length}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Stop Loss</p>
                <p className="text-lg font-semibold">-{stopLoss}%</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Max Position</p>
                <p className="text-lg font-semibold">${maxPosition}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}