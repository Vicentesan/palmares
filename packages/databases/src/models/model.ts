/* eslint-disable @typescript-eslint/ban-types */
import DatabaseAdapter from '../engine';
import {
  ModelFieldsType,
  ModelOptionsType,
  ManagersOfInstanceType,
  onSetFunction,
  onRemoveFunction,
  ModelType,
} from './types';
import {
  ModelCircularAbstractError,
  ModelInvalidAbstractFieldError,
  ModelInvalidAbstractManagerError,
  ModelNoUniqueFieldsError,
} from './exceptions';
import Manager, { DefaultManager } from './manager';
import { getUniqueCustomImports, hashString } from '../utils';
import { CustomImportsForFieldType, ON_DELETE } from './fields/types';
import { AutoField, CharField, Field, ForeignKeyField, IntegerField, UuidField } from './fields';
import { defaultModelOptions, indirectlyRelatedModels, factoryFunctionForModelTranslate } from './utils';

export class BaseModel {
  className: string = this.constructor.name;
  stringfiedArgumentsOfEvents = new Set<string>();
  #eventsUnsubscribers: (() => Promise<void>)[] = [];

  static isState = false;

  // It would be kinda bad on performance if we always looped through all of the fields of a model to parse them. So we store the fields that have parsers here and we will
  // loop through it here.
  static fieldParsersByEngine = new Map<
    string,
    {
      input: string[];
      output: string[];
    }
  >();
  static associations: {
    [modelName: string]: ForeignKeyField<any, any, any, any, any, any, any, any, any>[];
  } = {};
  // This model uses other models as ForeignKey
  static directlyRelatedTo: { [modelName: string]: string[] } = {};
  // Other models use this model as ForeignKey
  static indirectlyRelatedTo: { [modelName: string]: string[] } = {};
  static indirectlyRelatedModels = indirectlyRelatedModels;
  static primaryKeys: string[] = [];
  static domainName: string;
  static domainPath: string;

  static __lazyFields: ModelFieldsType = {};
  protected static __cachedHashedName: string;
  protected static __cachedName: string;
  protected static __cachedOriginalName: string;
  protected static __cachedFields: ModelFieldsType | undefined = undefined;
  protected static __cachedOptions: ModelOptionsType<any> | undefined = undefined;
  protected static __cachedManagers: ManagersOfInstanceType | undefined = undefined;
  protected static __hasLoadedAbstracts = false;
  protected static __instance: Model & BaseModel;
  static _initialized: { [engineName: string]: any } = {};

  constructor() {
    const baseModelConstructor = this.constructor as typeof BaseModel & typeof Model;
    if (baseModelConstructor.__instance) return baseModelConstructor.__instance;

    const newInstance = this as unknown as Model & BaseModel;
    if (newInstance.options?.abstract) newInstance.options.managed = false;
    baseModelConstructor.__instance = newInstance;
    return newInstance;
  }

  async #initializeManagers(
    engineInstance: DatabaseAdapter,
    modelInstance: Model & BaseModel,
    translatedModelInstance: any
  ) {
    const modelConstructor = this.constructor as ModelType;
    const managers: ManagersOfInstanceType = modelConstructor.__getManagers(modelConstructor);
    const managerValues = Object.values(managers);

    for (const manager of managerValues) {
      manager._setModel(engineInstance.connectionName, modelInstance);
      manager._setInstance(engineInstance.connectionName, translatedModelInstance);
      manager._setEngineInstance(engineInstance.connectionName, engineInstance);
    }
  }

  /**
   * This will add event listeners to the model. So when an event like `.set` or `.remove` is triggered, we will call
   * the event handler that was defined in the model using the `onSet` or `onRemove` options.
   *
   * By default we will take care to prevent the same data being triggered twice. So we stringify the data and compare it, so for example
   * if a model is trying to save the same data it received through an event it will not trigger the event again by default.
   *
   * @param engineInstance - The current engine instance we are initializing this model instance
   */
  async #initializeEvents(engineInstance: DatabaseAdapter) {
    if (!engineInstance) return;
    if (!engineInstance.databaseSettings?.events?.emitter) return;

    const existingEngineInstanceName = engineInstance.connectionName;
    const modelInstance = this as unknown as Model & BaseModel;
    const modelConstructor = this.constructor as typeof Model & typeof BaseModel;

    if (!modelInstance.options) return;

    for (const operationType of ['onSet', 'onRemove'] as const) {
      const eventHandler =
        typeof modelInstance.options[operationType] === 'function'
          ? modelInstance.options[operationType]
          : typeof modelInstance.options[operationType] === 'object'
          ? (modelInstance.options[operationType] as any).handler
          : undefined;
      if (!eventHandler) continue;

      const isToPreventCallerToBeTheHandled =
        typeof modelInstance.options[operationType] === 'function'
          ? true
          : typeof modelInstance.options[operationType] === 'object'
          ? (modelInstance.options[operationType] as any).preventCallerToBeTheHandled
          : undefined;

      const eventNameToUse = `${modelConstructor.hashedName()}.${operationType}`;
      const eventEmitter = await Promise.resolve(engineInstance.databaseSettings.events.emitter);
      this.#eventsUnsubscribers.push(
        await eventEmitter.addEventListenerWithoutResult(
          eventNameToUse,
          async (engineInstanceName: string, args: Parameters<onSetFunction | onRemoveFunction>) => {
            const isCallerDifferentThanHandler = engineInstanceName !== existingEngineInstanceName;
            const argsAsString = JSON.stringify(args);
            // This will prevent the event to be triggered twice for the same set of arguments.
            this.stringfiedArgumentsOfEvents.add(argsAsString);

            if (isToPreventCallerToBeTheHandled && isCallerDifferentThanHandler)
              await Promise.resolve(eventHandler(args as any));
            else if (!isToPreventCallerToBeTheHandled) await Promise.resolve(eventHandler(args as any));

            this.stringfiedArgumentsOfEvents.delete(argsAsString);
          }
        )
      );
    }
  }

  /**
   * Initializes the model and returns the model instance for the current engine instance that is being used.
   */
  static async _init(
    engineInstance: DatabaseAdapter,
    domainName: string,
    domainPath: string,
    lazyLoadFieldsCallback: (field: Field, translatedField: any) => void
  ) {
    if (this._initialized[engineInstance.connectionName]) return this._initialized[engineInstance.connectionName];

    const currentPalmaresModelInstance = new this() as Model & BaseModel;

    this.domainName = domainName;
    this.domainPath = domainPath;

    let translatedModelInstance = null;
    const modelName = this.getName();
    const functionToCallToTranslateModel = factoryFunctionForModelTranslate(
      engineInstance,
      currentPalmaresModelInstance,
      lazyLoadFieldsCallback
    );
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [initializedModelInstance, _] = await Promise.all([
      functionToCallToTranslateModel(),
      currentPalmaresModelInstance.#initializeEvents(engineInstance),
    ]);
    translatedModelInstance = initializedModelInstance;

    await currentPalmaresModelInstance.#initializeManagers(
      engineInstance,
      currentPalmaresModelInstance,
      initializedModelInstance
    );
    (this.constructor as typeof BaseModel)._initialized = {
      [engineInstance.connectionName]: translatedModelInstance,
    };
    return translatedModelInstance;
  }

  /**
   * Compare this and another model to see if they are equal so we can create the migrations automatically for them. You see
   * that we do not compare the fields, for the fields we have a hole set of `CRUD` operations if something changes there.
   * So it doesn't matter if two models don't have the same set of fields, if the options are equal, then they are equal.
   *
   * @param model - The model to compare to the current model.
   *
   * @returns - Returns true if the models are equal and false otherwise.
   */
  async _compareModels(model: Model & BaseModel): Promise<boolean> {
    const currentModel = this as unknown as Model & BaseModel;
    return (
      currentModel.options?.abstract === model.options?.abstract &&
      currentModel.options?.underscored === model.options?.underscored &&
      currentModel.options?.tableName === model.options?.tableName &&
      JSON.stringify(currentModel.options?.ordering) === JSON.stringify(model.options?.ordering) &&
      JSON.stringify(currentModel.options?.indexes) === JSON.stringify(model.options?.indexes) &&
      JSON.stringify(currentModel.options?.databases) === JSON.stringify(model.options?.databases) &&
      JSON.stringify(currentModel.options?.customOptions) === JSON.stringify(model.options?.customOptions)
    );
  }

  /**
   * Retrieves the managers from the model constructor.
   *
   * This is useful for getting the managers from an abstract model class.
   */
  static __getManagers(modelConstructor: typeof Model) {
    if (this.__cachedManagers === undefined) {
      const managers: ManagersOfInstanceType = {};
      let prototype = modelConstructor;

      while (prototype) {
        if (!(prototype.prototype instanceof Model)) break;
        const propertyNamesOfModel = Object.getOwnPropertyNames(prototype);
        for (const propName of propertyNamesOfModel) {
          const value = (prototype as any)[propName];
          if (value instanceof Manager) managers[propName] = value;
        }
        prototype = Object.getPrototypeOf(prototype);
      }
      this.__cachedManagers = managers;
    }
    return this.__cachedManagers;
  }

  /**
   * This will load all of the abstract instances of the model. The abstracts will append 3 types of
   * data in the current model:
   * fields, options, managers and other abstracts
   *
   * So for fields we will just accept the ones not already defined in the field, if there is any clash we will throw an error.
   * For options, we will only add them if the options are not already defined for the model.
   * Managers are similar to fields, we will not accept clashing managers with the same manager name.
   *
   * @param abstractInstance - The model class that we are instantiating.
   * @param composedAbstracts - We can have an abstract with an abstract and so on, for that a recursive approach
   * seems a good solution, this is an array with all of the abstracts that were already loaded for the current model.
   */
  protected static __loadAbstract(abstractConstructor: typeof Model & typeof BaseModel, composedAbstracts: string[]) {
    const abstractInstance = new abstractConstructor() as Model & BaseModel;
    const modelInstance = new this() as Model & BaseModel;
    const modelConstructor = this as typeof Model & typeof BaseModel;
    const abstractInstanceName = abstractConstructor.name;

    if (composedAbstracts.includes(abstractInstanceName))
      throw new ModelCircularAbstractError(this.constructor.name, abstractInstanceName);

    // Handle the abstracts and the managers from the abstract
    const abstractManagers: [string, Manager][] = Object.entries(this.__getManagers(abstractConstructor));
    const abstractFieldEntries = Object.entries(abstractInstance.fields);
    abstractInstance.abstracts.forEach((abstractKlsFromAbstract) =>
      this.__loadAbstract(abstractKlsFromAbstract as typeof Model & typeof BaseModel, composedAbstracts)
    );

    for (const [fieldName, field] of abstractFieldEntries) {
      if (abstractInstance.fields[fieldName])
        throw new ModelInvalidAbstractFieldError(this.constructor.name, abstractInstanceName, fieldName);
      modelInstance.fields[fieldName] = field;
    }

    // Handle options of the abstract
    const areAbstractInstanceOptionsDefined = Object.keys(abstractInstance.options || {}).length > 1;
    if (modelInstance.options === undefined && areAbstractInstanceOptionsDefined) {
      modelInstance.options = abstractInstance.options;
      if (modelInstance.options) modelInstance.options.abstract = false;
    }

    for (const [managerName, managerInstance] of abstractManagers) {
      if (modelConstructor[managerName])
        throw new ModelInvalidAbstractManagerError(this.constructor.name, abstractInstanceName, managerName);
      modelConstructor[managerName] = managerInstance;
    }
  }

  /**
   * Initializes all of the abstract classes of the model and loads them to the current model.
   *
   * With this we will have the model with all of the fields, options and managers as the other abstracts.
   */
  protected static __initializeAbstracts() {
    if (this.__hasLoadedAbstracts) return;
    const modelInstance = new this() as Model & BaseModel;
    const alreadyComposedAbstracts = [this.constructor.name];

    for (const abstractModelConstructor of modelInstance.abstracts)
      this.__loadAbstract(abstractModelConstructor as typeof Model & typeof BaseModel, alreadyComposedAbstracts);
    this.__hasLoadedAbstracts = true;
  }

  /**
   * This setups the indirect relations to the model. What we are doing is that we are setting the relatedTo
   * property of the model in the engineInstance._indirectlyRelatedModels. By doing this when we update the value on this
   * array it will update the `relatedTo` array inside of this model as well. With this we are able to know which models
   * relates to this model.
   */
  protected static __initializeRelatedToModels() {
    const originalModelName = this.originalName();
    if (originalModelName in this.indirectlyRelatedModels)
      this.indirectlyRelatedTo = this.indirectlyRelatedModels[originalModelName];
  }

  static _options() {
    // this and typeof Model means pretty much the same thing here.
    const modelInstance = new this() as Model & BaseModel;
    this.__initializeAbstracts();

    if (this.__cachedOptions === undefined) {
      const keysOfDefaultOptions = Object.keys(defaultModelOptions);
      for (const defaultModelOptionKey of keysOfDefaultOptions) {
        if (defaultModelOptionKey in (modelInstance.options || {}) === false)
          (modelInstance.options as any)[defaultModelOptionKey] = (defaultModelOptions as any)[defaultModelOptionKey];
      }
      this.__cachedOptions = modelInstance.options;
    }
    return this.__cachedOptions;
  }

  static _fields() {
    // 'this' and typeof Model means pretty much the same thing here.
    const modelInstance = new this() as Model & BaseModel;
    this.__initializeAbstracts();

    if (this.__cachedFields === undefined) {
      let modelHasNoUniqueFields = true;
      let fieldsDefinedOnModel = modelInstance.fields;
      if (this.__lazyFields) fieldsDefinedOnModel = { ...fieldsDefinedOnModel, ...this.__lazyFields };
      const allFields = Object.entries(fieldsDefinedOnModel);

      for (const [fieldName, field] of allFields) {
        if (field.unique) modelHasNoUniqueFields = false;
        field.init(fieldName, this as ModelType);
      }

      if (modelHasNoUniqueFields) throw new ModelNoUniqueFieldsError(this.constructor.name);

      this.__cachedFields = fieldsDefinedOnModel;
    }
    this.__initializeRelatedToModels();

    return this.__cachedFields;
  }

  static originalName() {
    if (typeof this.__cachedOriginalName === 'string') return this.__cachedOriginalName;

    if (this.isState) this.__cachedOriginalName = this.name;
    else this.__cachedOriginalName = (typeof this.originalName === 'string' ? this.originalName : this.name) as string;
    return this.__cachedOriginalName;
  }

  /**
   * We use this so the name of the models does not clash with the original ones during migration. During migration we will have 2 instances of the same model running at the
   * same time:
   *
   * 1. The state model, built from the migration files.
   * 2. The original model.
   */
  static getName() {
    if (typeof this.__cachedName === 'string') return this.__cachedName;

    if (this.isState) this.__cachedName = `State${this.name}`;
    else this.__cachedName = this.name;

    return this.__cachedName;
  }

  /**
   * We use the original model name to create a hash name of the model, a hash name of the model is used so we can send events back and forth for the model between
   * multiple palmares instances.
   *
   * @returns - The hashed name of the model.
   */
  static hashedName() {
    const originalModelName = this.originalName();
    if (this.__cachedHashedName === undefined) {
      this.__cachedHashedName = hashString(originalModelName);
    }
    return this.__cachedHashedName;
  }

  static async _fieldsToString(
    indentation = 0,
    fields: ModelFieldsType
  ): Promise<{ asString: string; customImports: CustomImportsForFieldType[] }> {
    const customImportsOfModel: CustomImportsForFieldType[] = [];
    const allFields = Object.entries(fields);
    const ident = '  '.repeat(indentation);
    const fieldsIdent = '  '.repeat(indentation + 1);

    const stringifiedFields = [];
    for (let i = 0; i < allFields.length; i++) {
      const fieldName = allFields[i][0];
      const field = allFields[i][1];
      const isLastField = i === allFields.length - 1;
      const customImportsOfField = await field.customImports();
      stringifiedFields.push(
        `${fieldsIdent}${fieldName}: ${(await field.toString(indentation + 1)).replace(
          new RegExp(`^${fieldsIdent}`),
          ''
        )},${isLastField ? '' : '\n'}`
      );
      getUniqueCustomImports(customImportsOfField, customImportsOfModel);
    }
    return {
      asString: `${ident}{\n` + `${stringifiedFields.join('')}` + `\n${ident}}`,
      customImports: customImportsOfModel,
    };
  }

  static async _optionsToString(indentation = 0, options: ModelOptionsType) {
    const ident = '  '.repeat(indentation);
    const optionsIndent = '  '.repeat(indentation + 1);

    const newOptions = {
      ...defaultModelOptions,
      ...options,
    };
    return (
      `${ident}{\n` +
      `${optionsIndent}abstract: ${newOptions.abstract},\n` +
      `${optionsIndent}underscored: ${newOptions.underscored},\n` +
      `${optionsIndent}tableName: ${
        typeof newOptions.tableName === 'string' ? `"${newOptions.tableName}"` : newOptions.tableName
      },\n` +
      `${optionsIndent}managed: ${newOptions.managed},\n` +
      `${optionsIndent}ordering: [${
        newOptions.ordering ? newOptions.ordering?.map((field) => `"${field as string}"`) : ''
      }],\n` +
      `${optionsIndent}indexes: [${
        newOptions.indexes
          ? newOptions.indexes?.map(
              (dbIndex, i) =>
                `{ unique: ${dbIndex.unique}, fields: ${dbIndex.fields.map((field) => `"${field}"`)} }` +
                `${i === (newOptions.indexes?.length || 1) - 1 ? '' : ','}`
            )
          : ''
      }],\n` +
      `${optionsIndent}databases: [${
        newOptions.databases ? newOptions.databases?.map((database) => `"${database}"`) : ''
      }],\n` +
      `${optionsIndent}customOptions: ${JSON.stringify(newOptions.customOptions)}\n` +
      `${ident}}`
    );
  }
}

const BaseModelWithoutMethods = BaseModel as unknown as { new (): Pick<BaseModel, never> };

/**
 * This class is used for initializing a model. This will work similar to django except that instead of
 * `objects` we use `instance` to make queries. So in other words, if you want to make queries directly
 * you will need to use. Also the instance will hold the actual instance of the model.
 *
 * >>> (await ModelName.getInstance()).findOne()
 * or
 * >>> (await ModelName.getInstance()).create()
 *
 * and so on.
 *
 * For creating Models it is simple, you've got 4 objects: `attributes`, `objects`, `managers` and `abstracts`
 *
 * The first one is obligatory, the rest is optional.
 * For `attributes` it is simple, just define the attributes of your model there as you would in sequelize
 * normally:
 *
 * Example:
 * In sequelize we define like:
 * >>> sequelize.define('User', {
 *      firstName: {
 *          type: DataTypes.STRING,
 *          allowNull: false
 *      },
 *      lastName: {
 *          type: DataTypes.STRING
 *      }
 * }, {
 *      tableName: 'user'
 * })
 *
 * Notice that 'User' is the name of the model, the second argument of the `.define()` function is the attributes,
 * it is exactly this object we will put in the attributes parameter. The second argument of the function is the
 * sequelize `options` sequelize parameter where we can define indexes, tableName and many other configuration.
 * You might want to check sequelize documentation for this: https://sequelize.org/master/manual/model-basics.html
 *
 * Okay so how do we rewrite this to something more concise and readable?
 * class User extends Model {
 *      attributes = {
 *          firstName: new model.fields.CharField(),
 *          lastName: new model.fields.CharField()
 *      }
 *
 *      options = {
 *          tableName: 'user'
 *      }
 *
 *      getFullName() {
 *          return this.firstName + this.lastName
 *      }
 *
 *      custom = new CustomManager()
 * }
 *
 * Simple and elegant. You will notice the `attributes` is defined, the options is optional, so instead of defining an
 * empty object you can totally omit it if you want.
 *
 * The `.getFullName` function is an instance function it will be appended to the instance so you can make a query like
 * and then it will return an User model, this model will have the method.
 *
 * >>> const response = await User.instance.findOne()
 * >>> response.getFullName()
 *
 * We underline many stuff from sequelize so you, the programmer, don't need to worry about tooling, it will just work.
 *
 * Take a notice at manager. Manager is for building custom managers similar to django managers.
 * Instead of making queries through your code you can keep all of your queries inside of managers and just
 * define them in your model.
 *
 * For the CustomManager, this will be our definition of a custom manager
 * >>> class CustomManager extends Manager {
 *         createUser(firstName, lastName) {
 *              return this.instance.create({ firstName: firstName, lastName: lastName })
 *         }
 *     }
 *
 * Okay so now we don't need to create a new user calling `.create` directly, instead we can use
 *
 * User.custom.createUser('Jane', 'Doe')
 *
 * This way we can keep queries more concise and representative by just making functions. Also
 * you can have the hole power of linting VSCode and other IDEs give you.
 */
export class Model extends BaseModelWithoutMethods {
  static [managers: string]: Manager | ((...args: any) => any) | ModelFieldsType;
  fields: ModelFieldsType = {};
  options: ModelOptionsType<any> | undefined = undefined;
  abstracts: readonly (typeof Model | ReturnType<typeof model>)[] = [] as const;
}

/**
 * This function is needed so we can add the type to the DefaultManager. This will help keeping the API simple for the
 * end user without complicating too much stuff.
 */
export default function model<TModel>() {
  let defaultManagerInstance: any = null;

  const classToReturn = class DefaultModel extends Model {
    static get default() {
      if (defaultManagerInstance === null) {
        defaultManagerInstance = new DefaultManager<TModel extends DefaultModel ? TModel : any>();
        defaultManagerInstance.modelKls = this;
      }
      return defaultManagerInstance as DefaultManager<TModel extends DefaultModel ? TModel : any>;
    }

    /**
     * This will append fields to the current model. It is useful for extending the models so you can lazy load the fields. It
     */
    static appendFields<TOtherFields extends ModelFieldsType>(fields: TOtherFields) {
      const modelConstructor = this as unknown as typeof Model & typeof BaseModel;
      const allFieldEntries = Object.entries(fields);
      for (const [fieldName, field] of allFieldEntries) modelConstructor.__lazyFields[fieldName] = field;

      return this as unknown as ReturnType<typeof model<TModel & { fields: TOtherFields }>> & {
        new (): TModel & { fields: TOtherFields };
      };
    }
  };

  return classToReturn;
}

/**
 * Used for creating a model from a function instead of needing to define a class.
 */
export function initialize<TFields extends ModelFieldsType, TAbstracts extends readonly (typeof Model)[]>(
  modelName: string,
  args: {
    fields: TFields;
    abstracts?: TAbstracts;
    options?: ModelOptionsType<{ fields: TFields; abstracts: TAbstracts }>;
  }
) {
  class ModelConstructor extends model<ModelConstructor>() {
    static __cachedName = modelName;
    static __cachedOriginalName = modelName;

    fields = args.fields as TFields;
    options = args.options as ModelOptionsType<any>;
    abstracts = args.abstracts as TAbstracts;
  }

  return ModelConstructor as unknown as ReturnType<
    typeof model<{
      fields: TFields;
      abstracts: TAbstracts;
      options: ModelOptionsType<{ fields: TFields; abstracts: TAbstracts }>;
    }>
  >;
}
/*
//class Profile
export class Contract extends model<Contract>() {
  fields = {
    id: AutoField.new(),
    status: EnumField.new({ isAuto: true, allowNull: true, choices: ['new', 'in_progress', 'terminated'] }),
    contractorId: ForeignKeyField.new({
      relatedTo: Profile,
      onDelete: ON_DELETE.CASCADE,
      toField: 'id',
      relatedName: 'contractorContracts',
      relationName: 'contractor',
    }),
    clientId: ForeignKeyField.new({
      relatedTo: Profile,
      onDelete: ON_DELETE.CASCADE,
      toField: 'id',
      relatedName: 'clientContracts',
      relationName: 'client',
    }),
  };

  options = {
    tableName: 'contract' as const,
  } satisfies ModelOptionsType<Contract>;
}

// Aqui é meu manager, onde armazeno as minhas queries
class CustomProfileManager extends Manager<Profile> {
  async getById(id: number) {
    return this.get({ search: { id: id } });
  }
}

export class Profile extends model<Profile>() {
  fields = {
    id: AutoField.new(),
    type: EnumField.new({ isAuto: true, choices: ['client', 'contractor'] }),
  };

  options = {
    tableName: 'profile' as const,
  } satisfies ModelOptionsType<Profile>;

  static custom = new CustomProfileManager();
}

const ExtendedProfile = Profile.appendFields({
  profileId: ForeignKeyField.new({
    relatedTo: Profile,
    onDelete: ON_DELETE.CASCADE,
    toField: 'id',
    relatedName: 'extendedProfiles',
    relationName: 'profile',
  }),
});

ExtendedProfile.default.get({
  search: {
    extendedProfiles: {
      id: {},
    },
  },
  includes: [
    {
      model: ExtendedProfile,
    },
  ],
});*/
