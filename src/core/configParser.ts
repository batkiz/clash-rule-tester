
import { parse } from 'yaml';

export interface RuleProvider {
  type: 'http' | 'inline';
  behavior: 'domain' | 'ipcidr' | 'classical';
  url?: string;
  format?: 'yaml' | 'text';
  payload?: string[];
}

// A basic interface for the Clash config structure.
// We will expand this as we support more fields.
export interface ClashConfig {
  rules?: string[];
  'rule-providers'?: { [key: string]: RuleProvider };
}

/**
 * Parses a YAML string representing a Clash configuration file.
 * @param configYaml The YAML configuration as a string.
 * @returns A JavaScript object representing the parsed config.
 * @throws Throws an error if the YAML is invalid.
 */
export const parseConfig = (configYaml: string): ClashConfig => {
  try {
    const config = parse(configYaml);
    // Basic validation to ensure it's an object
    if (typeof config !== 'object' || config === null) {
      throw new Error('Invalid configuration format: not an object.');
    }
    return config as ClashConfig;
  } catch (e) {
    console.error('Failed to parse YAML config:', e);
    throw new Error('Invalid YAML format.');
  }
};
