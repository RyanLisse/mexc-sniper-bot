import { test, expect } from '@playwright/test';
import { Stagehand } from "@browserbasehq/stagehand";
import StagehandConfig from "../../stagehand.config.unified";
import { z } from "zod";

/**
 * Settings & Configuration Visual Testing
 * 
 * This test suite validates comprehensive settings interfaces including:
 * - Trading settings configuration and validation
 * - Risk management parameter adjustments
 * - Take-profit strategy selection and customization
 * - API credentials management interface
 * - User preferences and automation settings
 * - Real-time validation feedback systems
 */

test.describe('Settings & Configuration Visual Testing Suite', () => {
  let stagehand: Stagehand;
  let userId: string;

  const TEST_EMAIL = `settings-visual-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'SettingsTest123!';
  const TEST_NAME = 'Settings Visual Test User';

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
    console.log('⚙️ Initializing Settings Configuration Visual Testing Suite...');
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test('Trading Settings Page - Complete Interface Validation', async () => {
    const page = stagehand.page;
    console.log('📊 Testing trading settings page comprehensive interface');

    // Setup authenticated session
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');
    
    await page.act(`Register user: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.waitForLoadState('networkidle');
    userId = `settings-test-${Date.now()}`;

    // Navigate to settings page
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');

    // Analyze settings page layout and structure
    const settingsPageAnalysis = await page.extract({
      instruction: "Analyze the complete settings page layout, tabs, and navigation structure",
      schema: z.object({
        pageStructure: z.object({
          hasPageHeader: z.boolean(),
          hasTabNavigation: z.boolean(),
          hasSaveControls: z.boolean(),
          hasUnsavedChangesIndicator: z.boolean()
        }),
        tabsPresent: z.object({
          hasTakeProfitTab: z.boolean(),
          hasRiskManagementTab: z.boolean(),
          hasAutomationTab: z.boolean(),
          additionalTabs: z.array(z.string())
        }),
        systemNotices: z.object({
          hasAPICredentialsNotice: z.boolean(),
          hasSystemCheckLink: z.boolean(),
          hasConfigurationGuidance: z.boolean()
        }),
        visualDesign: z.object({
          clearTabLabels: z.boolean(),
          consistentStyling: z.boolean(),
          responsiveLayout: z.boolean(),
          goodContrast: z.boolean()
        })
      })
    });

    expect(settingsPageAnalysis.pageStructure.hasPageHeader).toBe(true);
    expect(settingsPageAnalysis.pageStructure.hasTabNavigation).toBe(true);
    expect(settingsPageAnalysis.tabsPresent.hasTakeProfitTab).toBe(true);
    expect(settingsPageAnalysis.tabsPresent.hasRiskManagementTab).toBe(true);
    expect(settingsPageAnalysis.tabsPresent.hasAutomationTab).toBe(true);
    console.log('✅ Settings page structure validated');
  });

  test('Take-Profit Configuration - Strategy Selection and Customization', async () => {
    const page = stagehand.page;
    console.log('💰 Testing take-profit strategy configuration interface');

    // Navigate to settings and take-profit tab
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    
    await page.act("Click on Take Profit tab");
    await page.waitForTimeout(1000);

    // Analyze take-profit configuration interface
    const takeProfitInterface = await page.extract({
      instruction: "Analyze take-profit configuration interface including strategy options and customization controls",
      schema: z.object({
        strategySelection: z.object({
          hasStrategyOptions: z.boolean(),
          hasPresetStrategies: z.boolean(),
          hasCustomStrategy: z.boolean(),
          strategyTypes: z.array(z.string())
        }),
        customizationControls: z.object({
          hasLevelInputs: z.boolean(),
          hasPercentageControls: z.boolean(),
          hasAmountControls: z.boolean(),
          hasAddRemoveLevels: z.boolean()
        }),
        visualFeedback: z.object({
          hasStrategyPreview: z.boolean(),
          hasCalculationDisplay: z.boolean(),
          hasValidationMessages: z.boolean(),
          hasRealTimeUpdates: z.boolean()
        }),
        userExperience: z.object({
          intuitivelayout: z.boolean(),
          clearLabeling: z.boolean(),
          helpDocumentation: z.boolean(),
          responsiveControls: z.boolean()
        })
      })
    });

    expect(takeProfitInterface.strategySelection.hasStrategyOptions).toBe(true);
    expect(takeProfitInterface.customizationControls.hasLevelInputs).toBe(true);
    expect(takeProfitInterface.visualFeedback.hasRealTimeUpdates).toBe(true);
    
    // Test strategy switching
    await page.act("Switch between different take-profit strategies to test interface updates");
    await page.waitForTimeout(2000);

    const strategySwitchingTest = await page.extract({
      instruction: "Analyze interface updates when switching between take-profit strategies",
      schema: z.object({
        switchingBehavior: z.object({
          smoothTransitions: z.boolean(),
          immediateUpdates: z.boolean(),
          preservesValidInput: z.boolean(),
          clearsInvalidInput: z.boolean()
        }),
        visualConsistency: z.object({
          consistentLayout: z.boolean(),
          maintainsState: z.boolean(),
          noVisualGlitches: z.boolean()
        })
      })
    });

    expect(strategySwitchingTest.switchingBehavior.smoothTransitions).toBe(true);
    expect(strategySwitchingTest.visualConsistency.noVisualGlitches).toBe(true);
    console.log('✅ Take-profit configuration interface validated');
  });

  test('Risk Management Settings - Parameter Controls and Validation', async () => {
    const page = stagehand.page;
    console.log('🛡️ Testing risk management settings interface');

    // Navigate to risk management tab
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    
    await page.act("Click on Risk Management tab");
    await page.waitForTimeout(1000);

    // Analyze risk management interface
    const riskManagementInterface = await page.extract({
      instruction: "Analyze risk management settings interface including controls, validation, and safety features",
      schema: z.object({
        riskControls: z.object({
          hasStopLossSettings: z.boolean(),
          hasRiskToleranceControls: z.boolean(),
          hasPositionSizeControls: z.boolean(),
          hasConcurrentLimits: z.boolean()
        }),
        validationSystem: z.object({
          hasRangeValidation: z.boolean(),
          hasWarningMessages: z.boolean(),
          hasErrorPrevention: z.boolean(),
          hasRecommendations: z.boolean()
        }),
        safetyFeatures: z.object({
          hasRiskCalculations: z.boolean(),
          hasWarningThresholds: z.boolean(),
          hasEmergencyLimits: z.boolean(),
          hasRiskAssessment: z.boolean()
        }),
        userGuidance: z.object({
          hasHelpText: z.boolean(),
          hasTooltips: z.boolean(),
          hasExamples: z.boolean(),
          hasBestPractices: z.boolean()
        })
      })
    });

    expect(riskManagementInterface.riskControls.hasStopLossSettings).toBe(true);
    expect(riskManagementInterface.validationSystem.hasWarningMessages).toBe(true);
    expect(riskManagementInterface.safetyFeatures.hasRiskCalculations).toBe(true);

    // Test risk parameter adjustments
    await page.act("Adjust risk management parameters to test validation and feedback");
    await page.waitForTimeout(1500);

    const riskValidationTest = await page.extract({
      instruction: "Analyze validation behavior when adjusting risk management parameters",
      schema: z.object({
        validationBehavior: z.object({
          immediateValidation: z.boolean(),
          clearErrorMessages: z.boolean(),
          helpfulSuggestions: z.boolean(),
          preventInvalidValues: z.boolean()
        }),
        visualFeedback: z.object({
          colorCodedValidation: z.boolean(),
          progressiveDisclosure: z.boolean(),
          contextualHelp: z.boolean()
        })
      })
    });

    expect(riskValidationTest.validationBehavior.immediateValidation).toBe(true);
    expect(riskValidationTest.visualFeedback.colorCodedValidation).toBe(true);
    console.log('✅ Risk management settings validation completed');
  });

  test('Automation Settings - Control Panel and Feature Toggles', async () => {
    const page = stagehand.page;
    console.log('🤖 Testing automation settings and control panel');

    // Navigate to automation tab
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');
    
    await page.act("Click on Automation tab");
    await page.waitForTimeout(1000);

    // Analyze automation settings interface
    const automationInterface = await page.extract({
      instruction: "Analyze automation settings interface including toggles, controls, and safety mechanisms",
      schema: z.object({
        automationControls: z.object({
          hasAutoSnipeToggle: z.boolean(),
          hasAutoBuyToggle: z.boolean(),
          hasAutoSellToggle: z.boolean(),
          hasGlobalAutomationToggle: z.boolean()
        }),
        safetyMechanisms: z.object({
          hasConfirmationDialogs: z.boolean(),
          hasWarningMessages: z.boolean(),
          hasSafetyOverrides: z.boolean(),
          hasEmergencyStops: z.boolean()
        }),
        statusDisplay: z.object({
          showsAutomationStatus: z.boolean(),
          showsActiveFeatures: z.boolean(),
          showsSystemHealth: z.boolean(),
          hasStatusIndicators: z.boolean()
        }),
        userControl: z.object({
          easyToToggle: z.boolean(),
          clearLabeling: z.boolean(),
          immediateEffect: z.boolean(),
          reversibleActions: z.boolean()
        })
      })
    });

    expect(automationInterface.automationControls.hasAutoSnipeToggle).toBe(true);
    expect(automationInterface.safetyMechanisms.hasWarningMessages).toBe(true);
    expect(automationInterface.statusDisplay.hasStatusIndicators).toBe(true);

    // Test automation toggle behavior
    await page.act("Toggle automation settings to test immediate feedback and safety confirmations");
    await page.waitForTimeout(2000);

    const automationToggleTest = await page.extract({
      instruction: "Analyze automation toggle behavior and safety confirmation workflows",
      schema: z.object({
        toggleBehavior: z.object({
          immediateVisualFeedback: z.boolean(),
          confirmationRequired: z.boolean(),
          reversibilityCleared: z.boolean(),
          statusUpdated: z.boolean()
        }),
        safetyWorkflow: z.object({
          warningsDisplayed: z.boolean(),
          confirmationSteps: z.boolean(),
          riskAssessment: z.boolean(),
          emergencyAccess: z.boolean()
        })
      })
    });

    expect(automationToggleTest.toggleBehavior.immediateVisualFeedback).toBe(true);
    expect(automationToggleTest.safetyWorkflow.warningsDisplayed).toBe(true);
    console.log('✅ Automation settings interface validated');
  });

  test('Settings Save Workflow - Validation and Persistence', async () => {
    const page = stagehand.page;
    console.log('💾 Testing settings save workflow and validation');

    // Navigate to settings and make changes across tabs
    await page.goto('http://localhost:3008/settings');
    await page.waitForLoadState('networkidle');

    // Make changes in multiple tabs
    await page.act("Make configuration changes across different settings tabs");
    await page.waitForTimeout(2000);

    // Analyze unsaved changes workflow
    const unsavedChangesWorkflow = await page.extract({
      instruction: "Analyze unsaved changes detection and save workflow interface",
      schema: z.object({
        changeDetection: z.object({
          detectsChanges: z.boolean(),
          showsUnsavedIndicator: z.boolean(),
          enablesSaveButton: z.boolean(),
          providesChangePreview: z.boolean()
        }),
        saveWorkflow: z.object({
          hasSaveButton: z.boolean(),
          showsSavingProgress: z.boolean(),
          confirmsSuccess: z.boolean(),
          handlesErrors: z.boolean()
        }),
        validationChecks: z.object({
          validatesBeforeSave: z.boolean(),
          preventsInvalidSave: z.boolean(),
          showsValidationErrors: z.boolean(),
          guidesCorrection: z.boolean()
        }),
        userExperience: z.object({
          clearFeedback: z.boolean(),
          preventDataLoss: z.boolean(),
          allowsCancel: z.boolean(),
          maintainsContext: z.boolean()
        })
      })
    });

    expect(unsavedChangesWorkflow.changeDetection.detectsChanges).toBe(true);
    expect(unsavedChangesWorkflow.saveWorkflow.confirmsSuccess).toBe(true);
    expect(unsavedChangesWorkflow.validationChecks.validatesBeforeSave).toBe(true);

    // Test save process
    await page.act("Save the configuration changes");
    await page.waitForTimeout(3000);

    const saveProcessTest = await page.extract({
      instruction: "Analyze save process completion and success confirmation",
      schema: z.object({
        saveCompletion: z.object({
          saveSuccessful: z.boolean(),
          confirmationShown: z.boolean(),
          settingsPersisted: z.boolean(),
          interfaceUpdated: z.boolean()
        }),
        postSaveState: z.object({
          unsavedIndicatorCleared: z.boolean(),
          saveButtonDisabled: z.boolean(),
          changesApplied: z.boolean(),
          noErrors: z.boolean()
        })
      })
    });

    expect(saveProcessTest.saveCompletion.saveSuccessful).toBe(true);
    expect(saveProcessTest.postSaveState.unsavedIndicatorCleared).toBe(true);
    console.log('✅ Settings save workflow validated');
  });
});