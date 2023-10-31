import { getSettings, retrieveDomains } from '@palmares/core';
import { EventEmitter } from '@palmares/events';

import {
  DatabaseSettingsType,
  DatabaseConfigurationType,
  FoundModelType,
  InitializedModelsType,
  InitializedEngineInstancesType,
  InitializedEngineInstanceWithModelsType,
  OptionalMakemigrationsArgsType,
} from './types';
import { DatabaseDomainInterface } from './interfaces';
import DatabaseAdapter from './engine';
import { Model } from './models';
import Migrations from './migrations';
import model, { BaseModel } from './models/model';
import { databaseLogger } from './logging';
import { initializeModels } from './models/utils';

export default class Databases {
  settings!: DatabaseSettingsType;
  isInitializing = false;
  isInitialized = false;
  initializedEngineInstances: InitializedEngineInstancesType = {};
  obligatoryModels: ReturnType<typeof model>[] = [];
  #cachedModelsByModelName: {
    [modelName: string]: FoundModelType;
  } = {};
  private static __instance: Databases;

  constructor() {
    if (Databases.__instance) return Databases.__instance;
    Databases.__instance = this;
  }

  /**
   * This will lazy initialize the hole engine instance with all of the models before using it. Generally this is not needed but for example
   * on cases like serverless. We need to guarantee that the database will work without the need of the default domain lifecycle. That's because
   * on certain environments we can't guarantee that the hole domain lifecycle will be called and executed, this is why we need to lazy initialize
   * it.
   *
   * We initialize the hole engine AND NOT JUST THE MODELS because there is no way to know before hand about relations. Yeah we can guarantee direct
   * relations, for example `Post` that are related to a `User`. But we cannot guarantee indirect relations, for example, that `User` is related to
   * `Post`. This is because of the architecture that we choose to keep all relations in the models themselves. If we change this architecture we are
   * able to lazy load just certain models as well as their relations so it can be even more efficient. Right now we thinks that this is efficient
   * enough.
   *
   * @param engineName - The name of the engine that we want to lazy initialize.
   * @param settings - The settings that we want to use.
   * @param domains - The domains of the application.
   */
  async lazyInitializeEngine(engineName: string, settings: DatabaseSettingsType, domains: DatabaseDomainInterface[]) {
    if (this.isInitialized === false && this.isInitializing === false) {
      const isDatabaseDefined: boolean = settings.databases !== undefined && typeof settings.databases === 'object';

      const engineNameToUse: string | undefined =
        engineName === '' ? Object.keys(settings.databases || {})[0] : engineName;
      const isEngineNameDefined = engineNameToUse in (settings.databases || {});
      if (isDatabaseDefined && isEngineNameDefined) {
        const databaseSettings = settings.databases[engineNameToUse];
        await this.initializeDatabase(engineNameToUse, databaseSettings, domains);
      }
    }
  }

  /**
   * Initializes the database connection and load the models to their respective engines.
   *
   * @param settings - The settings object from the file itself.
   */
  async init(settings: DatabaseSettingsType, domains: DatabaseDomainInterface[]) {
    if (this.isInitialized === false && this.isInitializing === false) {
      this.settings = settings;
      this.isInitializing = true;
      const isDatabaseDefined: boolean =
        this.settings.databases !== undefined && typeof settings.databases === 'object';
      if (isDatabaseDefined) {
        const databaseEntries: [string, DatabaseConfigurationType][] = Object.entries(settings.databases);
        const existsEventEmitterForAllEngines =
          settings?.eventEmitter instanceof EventEmitter || (settings?.eventEmitter || {}) instanceof Promise;

        for (const [databaseName, databaseSettings] of databaseEntries) {
          const existsEventEmitterForSpecificEngine =
            databaseSettings?.events?.emitter instanceof EventEmitter ||
            databaseSettings?.events?.emitter instanceof Promise;

          if (existsEventEmitterForSpecificEngine === false && existsEventEmitterForAllEngines)
            databaseSettings.events = {
              emitter: settings.eventEmitter as EventEmitter | Promise<EventEmitter>,
            };
          await this.initializeDatabase(databaseName, databaseSettings, domains);
        }
        this.isInitialized = true;
      }
      this.isInitializing = false;
    }
  }

  /**
   * Responsible for handling the `makemigrations` command. For this command we must initialize the database first.
   * The user can pass --empty to create a new empty migration file.
   *
   * @param settings - The settings defined by the user in settings.js/ts file.
   * @param domains - The domains defined by the user so we can fetch all of the models and migrations.
   */
  async makeMigrations(
    settings: DatabaseSettingsType,
    domains: DatabaseDomainInterface[],
    optionalArgs: OptionalMakemigrationsArgsType
  ) {
    await this.init(settings, domains);
    const migrations = new Migrations(settings, domains);
    await migrations.makeMigrations(this.initializedEngineInstances, optionalArgs);
  }

  /**
   * Responsible for handling the `migrate` command. For this command we must initialize the database first.
   *
   * @param settings - The settings defined by the user in settings.js/ts file.
   * @param domains - The domains defined by the user so we can fetch all of the models and migrations.
   */
  async migrate(settings: DatabaseSettingsType, domains: DatabaseDomainInterface[]) {
    await this.init(settings, domains);
    const migrations = new Migrations(settings, domains);
    await migrations.migrate(this.initializedEngineInstances);
  }

  /**
   * Closes the database connection on all of the initialized engine instances.
   */
  async close(): Promise<void> {
    const initializedEngineEntries = Object.values(this.initializedEngineInstances);
    const promises = initializedEngineEntries.map(async ({ engineInstance }) => {
      databaseLogger.logMessage('DATABASE_CLOSING', {
        databaseName: engineInstance.connectionName,
      });
      if (engineInstance.close) await engineInstance.close(engineInstance);
    });

    await Promise.all(promises);
  }

  /**
   * Initializes the database connection and load the models to their respective engines.
   *
   * @param engineName - A custom name of the engine that we are using.
   * @param databaseSettings - The settings object for the database.
   */
  async initializeDatabase(
    engineName: string,
    databaseSettings: DatabaseConfigurationType,
    domains: DatabaseDomainInterface[]
  ) {
    let engineInstance: DatabaseAdapter;
    let argumentsToPassOnNew: any;
    const doesAnEngineInstanceAlreadyExist =
      engineName in this.initializedEngineInstances &&
      this.initializedEngineInstances[engineName].engineInstance !== undefined;
    const isProbablyAnEngineInstanceDefinedForDatabase = databaseSettings.engine !== undefined;

    if (doesAnEngineInstanceAlreadyExist) {
      engineInstance = this.initializedEngineInstances[engineName].engineInstance;
    } else {
      const maybeEngine = await Promise.resolve(databaseSettings.engine);
      if (Array.isArray(maybeEngine)) {
        argumentsToPassOnNew = maybeEngine[0];
        engineInstance = maybeEngine[1];
      } else {
        const awaitedEngineAndArgs = await Promise.resolve(maybeEngine.default);
        argumentsToPassOnNew = awaitedEngineAndArgs[0];
        engineInstance = awaitedEngineAndArgs[1];
      }

      const isAnEngineInstanceDefinedForDatabase = isProbablyAnEngineInstanceDefinedForDatabase
        ? engineInstance.constructor.prototype instanceof DatabaseAdapter
        : false;
      if (!isAnEngineInstanceDefinedForDatabase) throw new Error('You must define an engine for the database.');
    }
    engineInstance.__argumentsUsed = argumentsToPassOnNew;
    engineInstance.connectionName = engineName;
    engineInstance.databaseSettings = databaseSettings;

    const models: FoundModelType[] = Object.values(await this.getModels(domains));

    const onlyTheModelsFiltered: {
      [modelName: string]: ReturnType<typeof model>;
    } = {};
    const onlyTheModelsNotOnTheEngine: {
      [modelName: string]: ReturnType<typeof model>;
    } = {};
    const modelsFilteredForDatabase: FoundModelType[] = [];
    const promises = models.map(async (foundModel) => {
      const modelInstance = new foundModel.model();
      const isModelManagedByEngine =
        modelInstance.options?.managed !== false &&
        (Array.isArray(modelInstance.options?.databases) === false ||
          modelInstance.options?.databases?.includes(engineName) === true);
      const modelName =
        (foundModel.model as unknown as typeof BaseModel & typeof Model).getName() || modelInstance.constructor.name;

      if (isModelManagedByEngine) onlyTheModelsFiltered[modelName] = foundModel.model;
      else onlyTheModelsNotOnTheEngine[modelName] = foundModel.model;
      if (isModelManagedByEngine) modelsFilteredForDatabase.push(foundModel);
    });
    await Promise.all(promises);

    await new Promise((resolve) => {
      Promise.resolve(engineInstance.isConnected(engineInstance)).then((isDatabaseConnected) => {
        if (isDatabaseConnected) resolve(true);
        else {
          databaseLogger.logMessage('DATABASE_IS_NOT_CONNECTED', {
            databaseName: engineInstance.connectionName,
          });
          setTimeout(() => {}, 10);
        }
      });
    });
    const isDatabaseConnected = await Promise.resolve(engineInstance.isConnected(engineInstance));

    // Append all of the models to the engine instance.
    engineInstance.__modelsOfEngine = onlyTheModelsFiltered;
    engineInstance.__modelsFilteredOutOfEngine = onlyTheModelsNotOnTheEngine;

    if (isDatabaseConnected) {
      const { projectModels } = await this.initializeModels(engineInstance, modelsFilteredForDatabase);
      const mergedProjectModels = (this.initializedEngineInstances[engineName]?.projectModels || []).concat(
        projectModels
      );

      this.initializedEngineInstances[engineName] = {
        engineInstance,
        projectModels: mergedProjectModels,
      };
    } else {
      databaseLogger.logMessage('DATABASE_IS_NOT_CONNECTED', {
        databaseName: engineInstance.connectionName,
      });
      throw new Error(`The database engine ${engineName} was not able to connect to the database.`);
    }
  }

  /**
   * Initializes the models to the engine instance, the engine instance will convert the models to something it
   * can understand. For example on sequelize engine we will convert the models to a sequelize model. On a Prisma
   * engine for example we could interpret the models as a Prisma schema, and we could build the file after.
   *
   * @param engineInstance - The engine instance that we will be using.
   * @param projectModels - The models from the project (not the default ones that we create).
   *
   * @returns - Returns the engine instance that we are using to build run everything over returns the project models
   * and the internal models.
   */
  async initializeModels(
    engineInstance: DatabaseAdapter,
    projectModels: FoundModelType[]
  ): Promise<InitializedEngineInstanceWithModelsType> {
    const initializedProjectModels = await initializeModels(
      engineInstance,
      projectModels.map(({ domainPath, domainName, model }) => {
        model.domainName = domainName;
        model.domainPath = domainPath;
        return model;
      })
    );

    return {
      engineInstance,
      projectModels: initializedProjectModels,
    };
  }

  /**
   * Retrieves the models on all of the installed domains. By default we will look for the models
   * in the `models` file in the path of the domain. You can also define your domain app implementing
   * the `DatabaseDomainInterface` interface. With this type of domain you are able to export your models by defining
   * the `getModels` method. When this method is defined we bypass the lookup of the models in the `models`
   * file or folder, for complex projects you might want to use this method.
   *
   * @param domains - The domains where we want to retrieve the models from. Those are all of the
   * domains installed with INSTALLED_DOMAINS.
   *
   * @returns - Returns an array of models.
   */
  async getModels(domains?: DatabaseDomainInterface[]) {
    const settings = getSettings();
    if (domains === undefined && settings)
      domains = (await retrieveDomains(settings)).map((domainClass) => new domainClass() as DatabaseDomainInterface);
    const cachedFoundModels = Object.values(this.#cachedModelsByModelName);
    const existsCachedFoundModels = cachedFoundModels.length > 0;
    if (existsCachedFoundModels === false && domains) {
      const promises: Promise<void>[] = domains.map(async (domain) => {
        const hasGetModelsMethodDefined = typeof domain.getModels === 'function';
        if (hasGetModelsMethodDefined) {
          const models = await Promise.resolve(domain.getModels());
          if (Array.isArray(models)) {
            for (const model of models) {
              this.#cachedModelsByModelName[model.name] = {
                domainPath: domain.path,
                domainName: domain.name,
                model: model as typeof BaseModel & typeof model,
              };
            }
          } else {
            const modelEntries = Object.entries(models);
            for (const [modelName, modelKls] of modelEntries) {
              this.#cachedModelsByModelName[modelName] = {
                domainName: domain.path,
                domainPath: domain.path,
                model: modelKls as typeof BaseModel & typeof modelKls,
              };
            }
          }
        }
      });
      await Promise.all(promises);
    }
    return this.#cachedModelsByModelName;
  }
}
