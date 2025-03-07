import { domain } from '@palmares/core';

import { makeMigrations, migrate } from './commands';
import { Databases } from './databases';
import { defaultMigrations, defaultModels } from './defaults';
import { defaultSettings } from './settings';

import type { DatabaseAdapter } from '.';
import type { DatabaseDomainInterface } from './interfaces';
import type { model as BaseModel } from './models';
import type { DatabaseSettingsType } from './types';
import type { DomainHandlerFunctionArgs, DomainReadyFunctionArgs, SettingsType2 } from '@palmares/core';

declare global {
  // eslint-disable-next-line no-var
  var $PDatabases: Databases | undefined;
  // eslint-disable-next-line no-var
  var $PCachedDatabaseDomains: DatabaseDomainInterface[] | undefined;
}
export function loadDatabases(databaseDomains?: DatabaseDomainInterface[]) {
  if (Array.isArray(databaseDomains)) globalThis.$PCachedDatabaseDomains = databaseDomains;
  if (!globalThis.$PDatabases) globalThis.$PDatabases = new Databases();
  return [globalThis.$PDatabases, globalThis.$PCachedDatabaseDomains] as const;
}

const databaseDomainModifier = domain<{
  getModels: (
    engineInstance: DatabaseAdapter<any>
  ) =>
    | Promise<Record<string, ReturnType<typeof BaseModel>> | ReturnType<typeof BaseModel>[]>
    | Record<string, ReturnType<typeof BaseModel>>
    | ReturnType<typeof BaseModel>[];
  getMigrations: () => Promise<any> | any;
}>('@palmares/database', '', {});

export { databaseDomainModifier };

export const databasesDomain = domain('@palmares/database', '', {
  modifiers: [databaseDomainModifier] as const,
  commands: {
    makemigrations: {
      description: 'Create the migrations automatically based on your created models',
      positionalArgs: undefined,
      keywordArgs: {
        empty: {
          description: 'Creates an empty migration',
          hasFlag: true,
          type: 'string',
          canBeMultiple: true
        }
      },
      handler: async (options: DomainHandlerFunctionArgs) => {
        const [databases] = loadDatabases();
        await makeMigrations(databases, options);
      }
    },
    migrate: {
      description: 'Run the pending migrations on your database',
      positionalArgs: undefined,
      keywordArgs: undefined,
      handler: async (options: DomainHandlerFunctionArgs) => {
        const [databases] = loadDatabases();
        await migrate(databases, options);
      }
    },
    ['load-models']: {
      description: 'Load the databases. For some engines, it will just create the models locally',
      positionalArgs: undefined,
      keywordArgs: undefined,
      handler: async (options: DomainHandlerFunctionArgs) => {
        const settingsAsDatabaseSettings = options.settings as DatabaseSettingsType & SettingsType2;
        const [databases] = loadDatabases();
        const settingsWithDefault = defaultSettings(settingsAsDatabaseSettings);
        await databases.init(settingsWithDefault, options.domains as DatabaseDomainInterface[]);
        // eslint-disable-next-line ts/no-unnecessary-condition
        if (databases) await Promise.all([databases.close()]);
      }
    }
  },
  // eslint-disable-next-line ts/require-await
  load: async (_: DatabaseSettingsType) => {
    // eslint-disable-next-line ts/require-await
    return async (options: DomainReadyFunctionArgs<DatabaseSettingsType, any>) => {
      const databaseDomains = options.domains as DatabaseDomainInterface[];
      loadDatabases(databaseDomains);
    };
  },
  ready: async (options: DomainReadyFunctionArgs<DatabaseSettingsType, any>) => {
    const [databases, databaseDomains] = loadDatabases();
    const settingsWithDefault = defaultSettings(options.settings);
    // eslint-disable-next-line ts/no-unnecessary-condition
    if (databases && databaseDomains) await databases.init(settingsWithDefault, databaseDomains);
  },
  close: async () => {
    const [databases] = loadDatabases();
    // eslint-disable-next-line ts/no-unnecessary-condition
    if (databases) await Promise.all([databases.close()]);
  },
  // eslint-disable-next-line ts/require-await
  getMigrations: async () => defaultMigrations,
  // eslint-disable-next-line ts/require-await
  getModels: async (engineInstance: DatabaseAdapter<any>) => {
    if (engineInstance.migrations) return defaultModels as any;
    else return [];
  }
});
