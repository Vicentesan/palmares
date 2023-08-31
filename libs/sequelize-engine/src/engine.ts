import {
  Engine,
  DatabaseConfigurationType,
  ModelFields,
  TModel,
  EngineInitializedModels,
} from '@palmares/databases';
import {
  Sequelize,
  Dialect,
  Options,
  Op,
  Model,
  ModelCtor,
  Transaction,
} from 'sequelize';

import SequelizeEngineQuery from './query';
import SequelizeEngineFields from './fields';
import SequelizeMigrations from './migrations';
import SequelizeEngineGetQuery from './query/get';
import SequelizeEngineSetQuery from './query/set';
import SequelizeEngineRemoveQuery from './query/remove';
import SequelizeEngineSearchQuery from './query/search';
import SequelizeEngineModels from './model';
import SequelizeEngineFieldParser from './fields/field';
import SequelizeEngineAutoFieldParser from './fields/auto';
import SequelizeEngineBigAutoFieldParser from './fields/big-auto';
import SequelizeEngineBigIntegerFieldParser from './fields/big-integer';
import SequelizeEngineCharFieldParser from './fields/char';
import SequelizeEngineDecimalFieldParser from './fields/decimal';
import SequelizeEngineIntegerFieldParser from './fields/integer';
import SequelizeEngineTextFieldParser from './fields/text';
import SequelizeEngineUuidFieldParser from './fields/uuid';
import SequelizeEngineQueryOrdering from './query/ordering';
import SequelizeEngineForeignKeyFieldParser from './fields/foreign-key';
import SequelizeEngineDateFieldParser from './fields/date';

export default class SequelizeEngine<M extends TModel = any> extends Engine {
  #isConnected: boolean | null = null;
  initializedModels!: EngineInitializedModels<ModelCtor<Model<ModelFields<M>>>>;
  instance!: Sequelize | null;
  fields!: SequelizeEngineFields;

  ModelType!: ModelCtor<Model<ModelFields<M>>>;

  operations = {
    and: Op.and,
    or: Op.or,
    eq: Op.eq,
    ne: Op.ne,
    is: Op.is,
    not: Op.not,
    col: Op.col,
    gt: Op.gt,
    gte: Op.gte,
    lt: Op.lt,
    lte: Op.lte,
    between: Op.between,
    notBetween: Op.notBetween,
    all: Op.all,
    in: Op.in,
    notIn: Op.notIn,
    like: Op.like,
    notLike: Op.notLike,
    startsWith: Op.startsWith,
    endsWith: Op.endsWith,
    substring: Op.substring,
    iLike: Op.iLike,
    notILike: Op.notILike,
    regexp: Op.regexp,
    notRegexp: Op.notRegexp,
    iRegexp: Op.iRegexp,
    notIRegexp: Op.notIRegexp,
    any: Op.any,
    match: Op.match,
  };

  constructor(
    databaseName: string,
    databaseSettings: DatabaseConfigurationType<Dialect, Options>,
    sequelizeInstance: Sequelize
  ) {
    super(
      databaseName,
      databaseSettings,
      {
        fields: SequelizeEngineFields,
        field: SequelizeEngineFieldParser,
        auto: SequelizeEngineAutoFieldParser,
        bigAuto: SequelizeEngineBigAutoFieldParser,
        bigInteger: SequelizeEngineBigIntegerFieldParser,
        char: SequelizeEngineCharFieldParser,
        date: SequelizeEngineDateFieldParser,
        decimal: SequelizeEngineDecimalFieldParser,
        foreignKey: SequelizeEngineForeignKeyFieldParser,
        integer: SequelizeEngineIntegerFieldParser,
        text: SequelizeEngineTextFieldParser,
        uuid: SequelizeEngineUuidFieldParser,
      },
      {
        query: SequelizeEngineQuery,
        get: SequelizeEngineGetQuery,
        set: SequelizeEngineSetQuery,
        remove: SequelizeEngineRemoveQuery,
        search: SequelizeEngineSearchQuery,
        ordering: SequelizeEngineQueryOrdering,
      },
      SequelizeEngineModels,
      SequelizeMigrations
    );
    this.instance = sequelizeInstance;
  }

  static async new(
    databaseName: string,
    databaseSettings: DatabaseConfigurationType<Dialect, Options>
  ): Promise<Engine> {
    const isUrlDefined: boolean = typeof databaseSettings.url === 'string';
    if (isUrlDefined) {
      const databaseUrl: string = databaseSettings.url || '';
      const sequelizeInstance = new Sequelize(
        databaseUrl,
        databaseSettings.extraOptions
      );
      return new this(databaseName, databaseSettings, sequelizeInstance);
    }
    const sequelizeInstance = new Sequelize(
      databaseSettings.databaseName,
      databaseSettings.username,
      databaseSettings.password,
      {
        host: databaseSettings.host,
        port: databaseSettings.port,
        dialect: databaseSettings.dialect,
        ...databaseSettings.extraOptions,
      }
    );
    return new this(databaseName, databaseSettings, sequelizeInstance);
  }

  async isConnected(): Promise<boolean> {
    const isConnectedDefined: boolean = typeof this.#isConnected === 'boolean';
    if (isConnectedDefined) return this.#isConnected ? true : false;
    const isSequelizeInstanceDefined = this.instance instanceof Sequelize;

    if (isSequelizeInstanceDefined) {
      try {
        await this.instance?.authenticate();
        this.#isConnected = true;
      } catch (error) {
        this.#isConnected = false;
      }

      if (this.#isConnected) return this.#isConnected;
    }
    this.instance = null;
    return await super.isConnected();
  }

  async initializeModel(model: TModel): Promise<ModelCtor<Model> | undefined> {
    const modelInstance = await super.initializeModel(model);
    await this.fields.afterModelCreation(model.name);
    return modelInstance;
  }

  async transaction<P extends Array<any>, R>(
    callback: (transaction: Transaction, ...args: P) => R | Promise<R>,
    ...args: P
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      try {
        this.instance?.transaction(async (transaction) => {
          try {
            resolve(await callback(transaction, ...args));
          } catch (e) {
            reject(e);
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async close(): Promise<void> {
    await Promise.resolve(this.instance?.close());
  }
}
