import { vi, describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  isBrowser,
  findNearestEnvFile,
  configureSettings,
  loadEnvConfig,
  getEnvVariable,
  hasEnvVariable,
  parseNamespacedSettings,
  environmentSettings
} from '../src/settings';

// Mock fs module
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn()
  },
  existsSync: vi.fn()
}));

// Mock path module
vi.mock('path', () => {
  const originalPath = vi.importActual('path');
  return {
    default: {
      join: (...args: string[]) => args.join('/'),
      parse: vi.fn((p: string) => ({ root: '/', dir: p })),
      dirname: (p: string) => {
        const parts = p.split('/');
        parts.pop();
        return parts.join('/') || '/';
      }
    },
    join: (...args: string[]) => args.join('/'),
    parse: vi.fn((p: string) => ({ root: '/', dir: p })),
    dirname: (p: string) => {
      const parts = p.split('/');
      parts.pop();
      return parts.join('/') || '/';
    }
  };
});

describe('settings', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.env = {};
  });

  describe('isBrowser', () => {
    it('should return false in Node environment', () => {
      expect(isBrowser()).toBe(false);
    });
  });

  describe('findNearestEnvFile', () => {
    beforeEach(() => {
      vi.mocked(fs.existsSync).mockReset();
    });

    it('should find .env file in current directory', () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const result = findNearestEnvFile('/test/dir');
      expect(result).toBe('/test/dir/.env');
    });

    it('should find .env file in parent directory', () => {
      vi.mocked(fs.existsSync).mockImplementation((path: string) => {
        return path === '/test/.env';
      });

      const result = findNearestEnvFile('/test/dir');
      expect(result).toBe('/test/.env');
    });

    it('should return null when no .env file found', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = findNearestEnvFile('/test/dir');
      expect(result).toBeNull();
    });
  });

  describe('configureSettings', () => {
    it('should configure settings for browser environment', () => {
      const settings = { TEST_KEY: 'test_value' };
      configureSettings(settings);
      expect(environmentSettings).toEqual(settings);
    });

    it('should override existing settings', () => {
      configureSettings({ EXISTING: 'old' });
      configureSettings({ EXISTING: 'new' });
      expect(environmentSettings).toEqual({ EXISTING: 'new' });
    });
  });

  describe('loadEnvConfig', () => {
    it('should load env config from file in Node environment', () => {
      const mockEnv = {
        TEST_KEY: 'test_value',
        'namespace.key': 'value'
      };
      process.env = mockEnv;

      const result = loadEnvConfig();
      expect(result).toBe(process.env);
      expect(process.env['__namespaced_namespace']).toBe('{"key":"value"}');
    });

    it('should handle missing .env file', () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      const result = loadEnvConfig();
      expect(result).toBe(process.env);
    });
  });

  describe('getEnvVariable', () => {
    it('should get variable from Node process.env', () => {
      process.env.TEST_KEY = 'test_value';
      expect(getEnvVariable('TEST_KEY')).toBe('test_value');
    });

    it('should return default value when variable not found', () => {
      expect(getEnvVariable('NON_EXISTENT', 'default')).toBe('default');
    });

    it('should return undefined when no default provided', () => {
      expect(getEnvVariable('NON_EXISTENT')).toBeUndefined();
    });
  });

  describe('hasEnvVariable', () => {
    it('should check variable existence in Node process.env', () => {
      process.env.TEST_KEY = 'test_value';
      expect(hasEnvVariable('TEST_KEY')).toBe(true);
      expect(hasEnvVariable('NON_EXISTENT')).toBe(false);
    });
  });

  describe('parseNamespacedSettings', () => {
    it('should parse namespaced settings correctly', () => {
      const env = {
        'namespace1.key1': 'value1',
        'namespace1.key2': 'value2',
        'namespace2.key': 'value3',
        'non_namespaced': 'value4'
      };

      const expected = {
        namespace1: {
          key1: 'value1',
          key2: 'value2'
        },
        namespace2: {
          key: 'value3'
        }
      };

      expect(parseNamespacedSettings(env)).toEqual(expected);
    });

    it('should handle empty or invalid namespaced settings', () => {
      const env = {
        'invalid': undefined,
        '.invalid': 'value'
      };

      expect(parseNamespacedSettings(env)).toEqual({});
    });

    it('should handle nested namespaces', () => {
      const env = {
        'ns1.ns2.key': 'value',
        'ns1.key': 'value2'
      };

      const expected = {
        ns1: {
          'ns2.key': 'value',
          key: 'value2'
        }
      };

      expect(parseNamespacedSettings(env)).toEqual(expected);
    });

    it('should skip undefined values', () => {
      const env = {
        'ns1.key1': 'value1',
        'ns1.key2': undefined
      };

      expect(parseNamespacedSettings(env)).toEqual({
        ns1: {
          key1: 'value1'
        }
      });
    });
  });
});
