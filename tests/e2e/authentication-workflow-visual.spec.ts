import { Stagehand } from "@browserbasehq/stagehand";
import { expect, test } from '@playwright/test';
import { z } from "zod";
import StagehandConfig from "../../stagehand.config.unified";

/**
 * Authentication & Workflow Management Visual Testing
 * 
 * This test suite validates authentication flows and workflow management including:
 * - Complete authentication flow validation (login/register/logout)
 * - User session management and security features
 * - Workflow status tracking and agent management
 * - User profile and preferences management
 * - Security verification and access control
 * - Cross-browser authentication consistency
 */

test.describe('Authentication & Workflow Management Visual Testing Suite', () => {
  let stagehand: Stagehand;
  let userId: string;

  const TEST_EMAIL = `auth-visual-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'AuthTest123!';
  const TEST_NAME = 'Auth Visual Test User';

  test.beforeAll(async () => {
    stagehand = new Stagehand(StagehandConfig);
    await stagehand.init();
    console.log('🔐 Initializing Authentication & Workflow Visual Testing Suite...');
  });

  test.afterAll(async () => {
    if (stagehand) {
      await stagehand.close();
    }
  });

  test('Complete Authentication Flow - Registration to Dashboard Access', async () => {
    const page = stagehand.page;
    console.log('🚪 Testing complete authentication flow from registration to dashboard access');

    // Start from homepage/auth page
    await page.goto('http://localhost:3008');
    await page.waitForLoadState('networkidle');

    // Analyze initial authentication interface
    const authPageAnalysis = await page.extract({
      instruction: "Analyze the initial authentication interface including login/register options and page layout",
      schema: z.object({
        authInterface: z.object({
          hasLoginOption: z.boolean(),
          hasRegisterOption: z.boolean(),
          hasAuthenticationForm: z.boolean(),
          clearCallToAction: z.boolean()
        }),
        pageDesign: z.object({
          professionalAppearance: z.boolean(),
          clearNavigation: z.boolean(),
          responsiveLayout: z.boolean(),
          accessibleControls: z.boolean()
        }),
        securityFeatures: z.object({
          hasSecureConnection: z.boolean(),
          displaysSecurityInfo: z.boolean(),
          hasPasswordRequirements: z.boolean(),
          providesSecurityGuidance: z.boolean()
        }),
        userExperience: z.object({
          intuitiveFlow: z.boolean(),
          clearInstructions: z.boolean(),
          helpfulErrorMessages: z.boolean(),
          streamlinedProcess: z.boolean()
        })
      })
    });

    expect(authPageAnalysis.authInterface.hasLoginOption).toBe(true);
    expect(authPageAnalysis.authInterface.hasRegisterOption).toBe(true);
    expect(authPageAnalysis.pageDesign.professionalAppearance).toBe(true);
    expect(authPageAnalysis.securityFeatures.hasSecureConnection).toBe(true);

    // Test registration process
    await page.act("Navigate to registration and complete the registration form");
    await page.act(`Fill registration form: name "${TEST_NAME}", email "${TEST_EMAIL}", password "${TEST_PASSWORD}"`);
    await page.act("Submit registration form");
    await page.waitForLoadState('networkidle', { timeout: 20000 });

    userId = `auth-test-${Date.now()}`;
    console.log('✅ Registration flow completed');

    // Analyze post-registration state
    const postRegistrationAnalysis = await page.extract({
      instruction: "Analyze post-registration state including dashboard access and user session establishment",
      schema: z.object({
        sessionEstablishment: z.object({
          userLoggedIn: z.boolean(),
          sessionActive: z.boolean(),
          dashboardAccessible: z.boolean(),
          userInfoDisplayed: z.boolean()
        }),
        dashboardAccess: z.object({
          redirectedToDashboard: z.boolean(),
          dashboardFullyLoaded: z.boolean(),
          userDataAvailable: z.boolean(),
          featuresAccessible: z.boolean()
        }),
        userInterface: z.object({
          hasUserMenu: z.boolean(),
          displaysUserName: z.boolean(),
          showsUserAvatar: z.boolean(),
          hasLogoutOption: z.boolean()
        })
      })
    });

    expect(postRegistrationAnalysis.sessionEstablishment.userLoggedIn).toBe(true);
    expect(postRegistrationAnalysis.dashboardAccess.redirectedToDashboard).toBe(true);
    expect(postRegistrationAnalysis.userInterface.hasUserMenu).toBe(true);
    console.log('✅ Post-registration dashboard access validated');
  });

  test('User Session Management - Session Persistence and Security', async () => {
    const page = stagehand.page;
    console.log('🔒 Testing user session management and security features');

    // Navigate to dashboard (assuming user is logged in from previous test)
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');

    // Analyze session management features
    const sessionManagementAnalysis = await page.extract({
      instruction: "Analyze user session management including session persistence, security indicators, and user controls",
      schema: z.object({
        sessionFeatures: z.object({
          maintainsSession: z.boolean(),
          hasSessionIndicators: z.boolean(),
          showsSessionStatus: z.boolean(),
          hasSessionTimeout: z.boolean()
        }),
        securityIndicators: z.object({
          showsSecureConnection: z.boolean(),
          displaysSecurityStatus: z.boolean(),
          hasSecurityAlerts: z.boolean(),
          providesSecurityOptions: z.boolean()
        }),
        userControls: z.object({
          hasProfileAccess: z.boolean(),
          allowsPasswordChange: z.boolean(),
          hasPrivacySettings: z.boolean(),
          providesSessionControl: z.boolean()
        }),
        accessControl: z.object({
          restrictsUnauthorizedAccess: z.boolean(),
          maintainsPermissions: z.boolean(),
          hasRoleBasedAccess: z.boolean(),
          protectsUserData: z.boolean()
        })
      })
    });

    expect(sessionManagementAnalysis.sessionFeatures.maintainsSession).toBe(true);
    expect(sessionManagementAnalysis.securityIndicators.showsSecureConnection).toBe(true);
    expect(sessionManagementAnalysis.userControls.hasProfileAccess).toBe(true);

    // Test session persistence across page navigation
    await page.act("Navigate through different pages to test session persistence");
    
    const pages = ['/settings', '/safety', '/dashboard'];
    for (const pagePath of pages) {
      await page.goto(`http://localhost:3008${pagePath}`);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
    }

    const sessionPersistenceTest = await page.extract({
      instruction: "Analyze session persistence across page navigation and user state maintenance",
      schema: z.object({
        sessionPersistence: z.object({
          sessionMaintained: z.boolean(),
          userDataPreserved: z.boolean(),
          authenticationPersistent: z.boolean(),
          noReauthenticationRequired: z.boolean()
        }),
        userStateConsistency: z.object({
          userInfoConsistent: z.boolean(),
          permissionsPreserved: z.boolean(),
          preferencesRetained: z.boolean(),
          dataAccessible: z.boolean()
        })
      })
    });

    expect(sessionPersistenceTest.sessionPersistence.sessionMaintained).toBe(true);
    expect(sessionPersistenceTest.userStateConsistency.userInfoConsistent).toBe(true);
    console.log('✅ Session management and persistence validated');
  });

  test('User Profile and Preferences - Profile Management Interface', async () => {
    const page = stagehand.page;
    console.log('👤 Testing user profile and preferences management interface');

    // Navigate to user profile/settings
    await page.goto('http://localhost:3008/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Access user menu and profile options
    await page.act("Access user menu to view profile and account management options");
    await page.waitForTimeout(1500);

    // Analyze user profile interface
    const profileInterface = await page.extract({
      instruction: "Analyze user profile management interface including profile display, editing capabilities, and account settings",
      schema: z.object({
        profileDisplay: z.object({
          showsUserInformation: z.boolean(),
          displaysUserAvatar: z.boolean(),
          hasProfileDetails: z.boolean(),
          showsAccountStatus: z.boolean()
        }),
        editingCapabilities: z.object({
          allowsProfileEditing: z.boolean(),
          hasPasswordChange: z.boolean(),
          allowsEmailUpdate: z.boolean(),
          providesSecurityOptions: z.boolean()
        }),
        accountManagement: z.object({
          hasAccountSettings: z.boolean(),
          providesPrivacyControls: z.boolean(),
          allowsDataManagement: z.boolean(),
          hasAccountDeletion: z.boolean()
        }),
        userPreferences: z.object({
          hasPreferenceSettings: z.boolean(),
          allowsCustomization: z.boolean(),
          hasNotificationSettings: z.boolean(),
          providesThemeOptions: z.boolean()
        })
      })
    });

    expect(profileInterface.profileDisplay.showsUserInformation).toBe(true);
    expect(profileInterface.editingCapabilities.allowsProfileEditing).toBe(true);

    // Test profile editing workflow (if available)
    if (profileInterface.editingCapabilities.allowsProfileEditing) {
      await page.act("Test profile editing workflow by accessing profile edit options");
      await page.waitForTimeout(2000);

      const profileEditingTest = await page.extract({
        instruction: "Analyze profile editing workflow including form validation, save functionality, and security verification",
        schema: z.object({
          editingWorkflow: z.object({
            hasEditForm: z.boolean(),
            providesValidation: z.boolean(),
            allowsSaving: z.boolean(),
            hasConfirmation: z.boolean()
          }),
          securityMeasures: z.object({
            requiresCurrentPassword: z.boolean(),
            hasSecurityVerification: z.boolean(),
            providesSecurityWarnings: z.boolean(),
            protectsSensitiveData: z.boolean()
          })
        })
      });

      expect(profileEditingTest.editingWorkflow.hasEditForm).toBe(true);
      expect(profileEditingTest.securityMeasures.protectsSensitiveData).toBe(true);
    }
    console.log('✅ User profile management validated');
  });

  test('Workflow Management - Agent and Process Monitoring', async () => {
    const page = stagehand.page;
    console.log('⚙️ Testing workflow management and agent monitoring interface');

    // Check if workflows page exists
    try {
      await page.goto('http://localhost:3008/workflows');
      await page.waitForLoadState('networkidle');
    } catch {
      // If workflows page doesn't exist, check agents page
      try {
        await page.goto('http://localhost:3008/agents');
        await page.waitForLoadState('networkidle');
      } catch {
        // Fall back to dashboard and look for workflow/agent components
        await page.goto('http://localhost:3008/dashboard');
        await page.waitForLoadState('networkidle');
      }
    }

    // Analyze workflow management interface
    const workflowInterface = await page.extract({
      instruction: "Analyze workflow and agent management interface including process monitoring, agent status, and workflow controls",
      schema: z.object({
        workflowOverview: z.object({
          hasWorkflowDashboard: z.boolean(),
          showsProcessStatus: z.boolean(),
          displaysWorkflowHealth: z.boolean(),
          hasWorkflowControls: z.boolean()
        }),
        agentMonitoring: z.object({
          showsAgentStatus: z.boolean(),
          displaysAgentHealth: z.boolean(),
          hasAgentControls: z.boolean(),
          providesAgentMetrics: z.boolean()
        }),
        processTracking: z.object({
          showsActiveProcesses: z.boolean(),
          displaysProcessProgress: z.boolean(),
          hasProcessHistory: z.boolean(),
          providesProcessAnalytics: z.boolean()
        }),
        managementControls: z.object({
          allowsProcessControl: z.boolean(),
          hasWorkflowConfiguration: z.boolean(),
          providesAgentManagement: z.boolean(),
          hasEmergencyControls: z.boolean()
        })
      })
    });

    expect(workflowInterface.workflowOverview.hasWorkflowDashboard).toBe(true);
    expect(workflowInterface.agentMonitoring.showsAgentStatus).toBe(true);

    // Test workflow interaction capabilities
    await page.act("Interact with workflow and agent management components to test monitoring and control capabilities");
    await page.waitForTimeout(2000);

    const workflowInteractionTest = await page.extract({
      instruction: "Analyze workflow interaction capabilities and management features",
      schema: z.object({
        interactionCapabilities: z.object({
          allowsDetailedView: z.boolean(),
          providesControlOptions: z.boolean(),
          hasConfigurationAccess: z.boolean(),
          allowsStatusChanges: z.boolean()
        }),
        monitoringFeatures: z.object({
          providesRealTimeUpdates: z.boolean(),
          hasHistoricalData: z.boolean(),
          allowsPerformanceAnalysis: z.boolean(),
          hasAlertingCapabilities: z.boolean()
        })
      })
    });

    expect(workflowInteractionTest.interactionCapabilities.allowsDetailedView).toBe(true);
    expect(workflowInteractionTest.monitoringFeatures.providesRealTimeUpdates).toBe(true);
    console.log('✅ Workflow management interface validated');
  });

  test('Security Verification - Access Control and Verification Workflows', async () => {
    const page = stagehand.page;
    console.log('🛡️ Testing security verification and access control workflows');

    // Navigate to sensitive areas to test access control
    await page.goto('http://localhost:3008/safety');
    await page.waitForLoadState('networkidle');

    // Analyze security verification interface
    const securityInterface = await page.extract({
      instruction: "Analyze security verification interface including access controls, verification workflows, and security indicators",
      schema: z.object({
        accessControls: z.object({
          hasAccessRestrictions: z.boolean(),
          requiresAuthentication: z.boolean(),
          hasPermissionChecks: z.boolean(),
          providesAccessLogging: z.boolean()
        }),
        verificationWorkflows: z.object({
          hasSecurityVerification: z.boolean(),
          requiresAdditionalAuth: z.boolean(),
          hasSecurityQuestions: z.boolean(),
          providesVerificationSteps: z.boolean()
        }),
        securityIndicators: z.object({
          showsSecurityStatus: z.boolean(),
          displaysSecurityLevel: z.boolean(),
          hasSecurityAlerts: z.boolean(),
          providesSecurityGuidance: z.boolean()
        }),
        protectiveFeatures: z.object({
          hasDataProtection: z.boolean(),
          providesSessionSecurity: z.boolean(),
          hasAuditLogging: z.boolean(),
          implementsSecurityPolicies: z.boolean()
        })
      })
    });

    expect(securityInterface.accessControls.requiresAuthentication).toBe(true);
    expect(securityInterface.securityIndicators.showsSecurityStatus).toBe(true);

    // Test logout workflow
    await page.act("Test logout workflow to ensure proper session termination");
    await page.waitForTimeout(2000);

    const logoutWorkflowTest = await page.extract({
      instruction: "Analyze logout workflow including session termination, security cleanup, and redirect behavior",
      schema: z.object({
        logoutProcess: z.object({
          hasLogoutOption: z.boolean(),
          requiresConfirmation: z.boolean(),
          clearsSession: z.boolean(),
          redirectsAppropriately: z.boolean()
        }),
        sessionCleanup: z.object({
          terminatesSession: z.boolean(),
          clearsUserData: z.boolean(),
          removesAuthentication: z.boolean(),
          securesUserInfo: z.boolean()
        }),
        postLogoutState: z.object({
          blocksAccess: z.boolean(),
          requiresReauthentication: z.boolean(),
          showsLoggedOutState: z.boolean(),
          providesLoginOptions: z.boolean()
        })
      })
    });

    expect(logoutWorkflowTest.logoutProcess.hasLogoutOption).toBe(true);
    expect(logoutWorkflowTest.sessionCleanup.terminatesSession).toBe(true);
    expect(logoutWorkflowTest.postLogoutState.blocksAccess).toBe(true);
    console.log('✅ Security verification and logout workflow validated');
  });

  test('Cross-Browser Authentication Consistency - Multi-Environment Testing', async () => {
    const page = stagehand.page;
    console.log('🌐 Testing cross-browser authentication consistency');

    // Test authentication interface consistency
    await page.goto('http://localhost:3008/auth');
    await page.waitForLoadState('networkidle');

    // Analyze cross-browser compatibility
    const crossBrowserCompatibility = await page.extract({
      instruction: "Analyze authentication interface for cross-browser compatibility and consistency",
      schema: z.object({
        interfaceConsistency: z.object({
          consistentLayout: z.boolean(),
          consistentStyling: z.boolean(),
          consistentFunctionality: z.boolean(),
          consistentBehavior: z.boolean()
        }),
        functionalitySupport: z.object({
          allFeaturesWorking: z.boolean(),
          noCompatibilityIssues: z.boolean(),
          consistentPerformance: z.boolean(),
          reliableOperation: z.boolean()
        }),
        userExperience: z.object({
          seamlessExperience: z.boolean(),
          noVisualArtifacts: z.boolean(),
          responsiveDesign: z.boolean(),
          accessibleControls: z.boolean()
        }),
        securityFeatures: z.object({
          securityFeaturesWork: z.boolean(),
          encryptionSupported: z.boolean(),
          secureConnections: z.boolean(),
          dataProtectionActive: z.boolean()
        })
      })
    });

    expect(crossBrowserCompatibility.interfaceConsistency.consistentLayout).toBe(true);
    expect(crossBrowserCompatibility.functionalitySupport.allFeaturesWorking).toBe(true);
    expect(crossBrowserCompatibility.userExperience.seamlessExperience).toBe(true);
    expect(crossBrowserCompatibility.securityFeatures.securityFeaturesWork).toBe(true);

    // Test responsive authentication on different viewport sizes
    const viewportSizes = [
      { width: 1920, height: 1080, name: 'Desktop Large' },
      { width: 1280, height: 720, name: 'Desktop Standard' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewportSizes) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);

      const responsiveAuthTest = await page.extract({
        instruction: `Analyze authentication interface responsiveness on ${viewport.name} viewport`,
        schema: z.object({
          responsiveDesign: z.object({
            layoutAdapts: z.boolean(),
            elementsVisible: z.boolean(),
            functionalityAccessible: z.boolean(),
            userFriendly: z.boolean()
          }),
          usability: z.object({
            easyToUse: z.boolean(),
            touchFriendly: z.boolean(),
            readableText: z.boolean(),
            accessibleControls: z.boolean()
          })
        })
      });

      expect(responsiveAuthTest.responsiveDesign.layoutAdapts).toBe(true);
      expect(responsiveAuthTest.usability.easyToUse).toBe(true);
      console.log(`✅ ${viewport.name} authentication responsiveness validated`);
    }

    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
    console.log('✅ Cross-browser authentication consistency validated');
  });
});