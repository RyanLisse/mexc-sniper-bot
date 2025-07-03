/**
 * Parameter Management
 * Minimal implementation for build optimization
 */

export interface Parameter {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'object';
  description?: string;
  default?: any;
  validation?: (value: any) => boolean;
}

export interface ParameterGroup {
  name: string;
  description?: string;
  parameters: Record<string, Parameter>;
}

class ParameterManager {
  private parameters: Map<string, Parameter> = new Map();
  private groups: Map<string, ParameterGroup> = new Map();

  setParameter(name: string, value: any, type: Parameter['type'] = 'string'): void {
    const existing = this.parameters.get(name);
    
    const parameter: Parameter = {
      name,
      value,
      type,
      description: existing?.description,
      default: existing?.default,
      validation: existing?.validation
    };

    if (parameter.validation && !parameter.validation(value)) {
      throw new Error(`Invalid value for parameter ${name}`);
    }

    this.parameters.set(name, parameter);
  }

  getParameter<T = any>(name: string, defaultValue?: T): T {
    const parameter = this.parameters.get(name);
    return parameter ? parameter.value : defaultValue;
  }

  getAllParameters(): Record<string, any> {
    const result: Record<string, any> = {};
    for (const [name, parameter] of this.parameters) {
      result[name] = parameter.value;
    }
    return result;
  }

  registerParameter(parameter: Parameter): void {
    this.parameters.set(parameter.name, parameter);
  }

  createGroup(name: string, description?: string): void {
    this.groups.set(name, {
      name,
      description,
      parameters: {}
    });
  }

  addParameterToGroup(groupName: string, parameter: Parameter): void {
    const group = this.groups.get(groupName);
    if (group) {
      group.parameters[parameter.name] = parameter;
      this.registerParameter(parameter);
    }
  }

  getGroup(name: string): ParameterGroup | undefined {
    return this.groups.get(name);
  }

  getAllGroups(): Record<string, ParameterGroup> {
    const result: Record<string, ParameterGroup> = {};
    for (const [name, group] of this.groups) {
      result[name] = group;
    }
    return result;
  }

  validateParameter(name: string, value: any): boolean {
    const parameter = this.parameters.get(name);
    if (!parameter) return false;
    
    if (parameter.validation) {
      return parameter.validation(value);
    }
    
    return true;
  }

  resetToDefaults(): void {
    for (const [name, parameter] of this.parameters) {
      if (parameter.default !== undefined) {
        parameter.value = parameter.default;
      }
    }
  }

  exportParameters(): Record<string, any> {
    return this.getAllParameters();
  }

  importParameters(parameters: Record<string, any>): void {
    for (const [name, value] of Object.entries(parameters)) {
      const existing = this.parameters.get(name);
      if (existing) {
        this.setParameter(name, value, existing.type);
      }
    }
  }
}

export const parameterManager = new ParameterManager();

// Initialize default parameters
parameterManager.createGroup('trading', 'Trading parameters');
parameterManager.createGroup('risk', 'Risk management parameters');
parameterManager.createGroup('performance', 'Performance tuning parameters');

export function getParameter<T = any>(name: string, defaultValue?: T): T {
  return parameterManager.getParameter(name, defaultValue);
}

export function setParameter(name: string, value: any, type: Parameter['type'] = 'string'): void {
  parameterManager.setParameter(name, value, type);
}

export function getParameterManager(): ParameterManager {
  return parameterManager;
}