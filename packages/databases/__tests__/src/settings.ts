import CoreDomain, { defineSettings } from '@palmares/core';
import TestsDomain from '@palmares/tests';
import DrizzleEngine from '@palmares/drizzle-engine';
import JestTestAdapter from '@palmares/jest-tests';

import NodeStd from '@palmares/node-std';
import LoggingDomain from '@palmares/logging';
import ConsoleLogging from '@palmares/console-logging';
import DatabasesDomain from '@palmares/databases';

import TestDomain from './test';
import { dirname, resolve } from 'path';
import Database from 'better-sqlite3';
//import * as schema from '../.drizzle/schema';
import { drizzle } from 'drizzle-orm/better-sqlite3';

const database = new Database('sqlite.db');

const args = DrizzleEngine.new({
  output: './.drizzle',
  type: 'better-sqlite3',
  drizzle: drizzle(database, {  })
})
export const db = args[1].instance.instance

export default defineSettings({
  basePath: dirname(resolve(__dirname)),
  settingsLocation: __filename,
  std: NodeStd,
  installedDomains: [
    [
      LoggingDomain,
      {
        logger: ConsoleLogging,
      },
    ],
    // Domain Core, required for palmares to work
    [
      CoreDomain,
      {
        appName: 'example',
      },
    ],
    [
      TestsDomain,
      {
        testAdapter: JestTestAdapter,
      }
    ],
    [
      DatabasesDomain,
      {
        databases: {
          default: {
            engine: args
          }
        }
      }
    ],
    // We have just created this custom domain, and it defines our routes.
    TestDomain,
  ],
});
