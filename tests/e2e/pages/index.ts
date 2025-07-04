/**
 * Page Object Models Index
 * 
 * Centralized export of all page object models for easy importing in tests
 */

export { BasePage } from './base-page';
export { AuthPage } from './auth-page';
export { DashboardPage } from './dashboard-page';
export { HomePage } from './home-page';
export { SettingsPage } from './settings-page';
export { MonitoringPage } from './monitoring-page';

// Page object factory for creating page instances
export class PageFactory {
  static createAuthPage(page: any) {
    return new AuthPage(page);
  }

  static createDashboardPage(page: any) {
    return new DashboardPage(page);
  }

  static createHomePage(page: any) {
    return new HomePage(page);
  }

  static createSettingsPage(page: any) {
    return new SettingsPage(page);
  }

  static createMonitoringPage(page: any) {
    return new MonitoringPage(page);
  }
}