import { Field } from './field';

import type { CustomImportsForFieldType } from './types';
import type { NewInstanceArgumentsCallback, TCompareCallback, TOptionsCallback, ToStringCallback } from './utils';
import type { DatabaseAdapter } from '../../engine';
import type { AdapterFieldParser } from '../../engine/fields/field';

/**
 * Functional approach for the creation of a UuidField.
 *
 * A UuidField is a field that can hold Text values of any size. On Relational Databases that would be a
 * `TEXT` field.
 *
 * @example
 * ```ts
 * const textField = uuid();
 * ```
 *
 * @example
 * ```
 * const textField = uuid().default('test');
 * ```
 */
export function uuid(): UuidField<
  {
    create: string;
    read: string;
    update: string;
  },
  {
    unique: false;
    allowNull: false;
    dbIndex: false;
    underscored: true;
    autoGenerate: false;
    isPrimaryKey: false;
    auto: false;
    defaultValue: undefined;
    typeName: string;
    databaseName: undefined;
    engineInstance: DatabaseAdapter;
    customAttributes: any;
  }
> {
  return UuidField.new();
}

/**
 * A UuidField supports either true or false.
 *
 * @example
 * ```ts
 * const uuidField = UuidField.new();
 * ```
 *
 * @example
 * ```
 * const uuidField = UuidField.new().autoGenerate();
 * ```
 */
export class UuidField<
  TType extends { create: any; read: any; update: any } = {
    create: string;
    read: string;
    update: string;
  },
  TDefinitions extends {
    unique: boolean;
    auto: boolean;
    allowNull: boolean;
    autoGenerate: boolean;
    dbIndex: boolean;
    isPrimaryKey: boolean;
    defaultValue: undefined;
    underscored: boolean;
    typeName: string;
    databaseName: string | undefined;
    engineInstance: DatabaseAdapter;
    customAttributes: any;
  } = {
    unique: false;
    allowNull: false;
    autoGenerate: false;
    dbIndex: false;
    underscored: true;
    isPrimaryKey: false;
    auto: false;
    defaultValue: undefined;
    typeName: string;
    databaseName: undefined;
    engineInstance: DatabaseAdapter;
    customAttributes: any;
  }
> extends Field<TType, TDefinitions> {
  protected $$type = '$PUuidField';
  protected static __typeName = 'UuidField';
  protected static __inputParsers = new Map<string, Required<AdapterFieldParser>['inputParser']>();
  protected static __outputParsers = new Map<string, Required<AdapterFieldParser>['outputParser']>();
  protected static __compareCallback: TCompareCallback = (oldField, newField, defaultCompareCallback) => {
    const oldFieldAsUuidField = oldField as UuidField<any, any>;
    const newFieldAsUuidField = newField as UuidField<any, any>;
    const isAllowBlankEqual = oldFieldAsUuidField['__autoGenerate'] === newFieldAsUuidField['__autoGenerate'];
    const [isEqual, changedAttributes] = defaultCompareCallback(oldField, newField, defaultCompareCallback);

    if (!isAllowBlankEqual) changedAttributes.push('autoGenerate');
    return [isAllowBlankEqual && isEqual, changedAttributes];
  };
  protected static __optionsCallback: TOptionsCallback = (oldField, newField, defaultOptionsCallback) => {
    const oldFieldAsUuidField = oldField as UuidField<any, any>;
    const newFieldAsUuidField = newField as UuidField<any, any>;

    defaultOptionsCallback(oldFieldAsUuidField, newFieldAsUuidField, defaultOptionsCallback);
    newFieldAsUuidField['__autoGenerate'] = oldFieldAsUuidField['__autoGenerate'];
  };

  protected __autoGenerate: TDefinitions['autoGenerate'] = false;

  /**
   * Supposed to be used by library maintainers.
   *
   * When you custom create a field, you might want to take advantage of the builder pattern we already support.
   * This let's you create functions that can be chained together to create a new field. It should be used
   * alongside the `_setPartialAttributes` method like
   *
   * @example
   * ```ts
   * const customBigInt = UuidField.overrideType<
   *   { create: bigint; read: bigint; update: bigint },
   *   {
   *       customAttributes: { name: string };
   *       unique: boolean;
   *       auto: boolean;
   *       allowNull: true;
   *       dbIndex: boolean;
   *       isPrimaryKey: boolean;
   *       defaultValue: any;
   *       typeName: string;
   *       engineInstance: DatabaseAdapter;
   *   }
   * >({
   *   typeName: 'CustomBigInt'
   * });
   *
   * const customBuilder = <TParams extends { name: string }>(params: TParams) => {
   *   const field = customBigInt.new(params);
   *   return field._setNewBuilderMethods({
   *     test: <TTest extends { age: number }>(param: TTest) =>
   *        // This will union the type `string` with what already exists in the field 'create' type
   *        field._setPartialAttributes<{ create: string }, { create: 'union' }>(param)
   *   });
   * };
   *
   * // Then your user can use it like:
   *
   * const field = customBuilder({ name: 'test' }).test({ age: 2 });
   * ```
   *
   * **Important**: `customBuilder` will be used by the end user and you are responsible for documenting it.
   */
  _setNewBuilderMethods<const TFunctions extends InstanceType<any>>(
    functions?: TFunctions
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > &
    TFunctions {
    if (functions === undefined) return this as any;
    const propertiesOfBase = Object.getOwnPropertyNames(Object.getPrototypeOf(functions));
    for (const key of propertiesOfBase) {
      if (key === 'constructor') continue;
      (this as any)[key] = (functions as any)[key].bind(this);
    }

    return this as any;
  }

  /**
   * FOR LIBRARY MAINTAINERS ONLY
   *
   * Focused for library maintainers that want to support a custom field type not supported by palmares.
   * This let's them partially update the custom attributes of the field. By default setCustomAttributes
   * will override the custom attributes entirely.
   */
  _setPartialAttributes<
    TNewType extends { create?: any; read?: any; update?: any },
    TActions extends {
      create?: 'merge' | 'union' | 'replace';
      read?: 'merge' | 'union' | 'replace';
      update?: 'merge' | 'union' | 'replace';
    }
  >(): <const TCustomPartialAttributes>(partialCustomAttributes: TCustomPartialAttributes) => UuidField<
    {
      create: TActions['create'] extends 'merge'
        ? TType['create'] & TNewType['create']
        : TActions['create'] extends 'union'
          ? TType['create'] | TNewType['create']
          : TActions['create'] extends 'replace'
            ? TNewType['create']
            : TType['create'];
      read: TActions['read'] extends 'merge'
        ? TType['read'] & TNewType['read']
        : TActions['read'] extends 'union'
          ? TType['read'] | TNewType['read']
          : TActions['read'] extends 'replace'
            ? TNewType['read']
            : TType['read'];
      update: TActions['update'] extends 'merge'
        ? TType['update'] & TNewType['update']
        : TActions['update'] extends 'union'
          ? TType['update'] | TNewType['update']
          : TActions['update'] extends 'replace'
            ? TNewType['update']
            : TType['update'];
    },
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'] & TCustomPartialAttributes;
    }
  > {
    return (partialCustomAttributes) => {
      if (partialCustomAttributes !== undefined) {
        if ((this.__customAttributes as any) === undefined) this.__customAttributes = {} as any;
        this.__customAttributes = { ...this.__customAttributes, ...partialCustomAttributes };
      }
      return this as any;
    };
  }

  setCustomAttributes<
    const TCustomAttributes extends Parameters<
      TDefinitions['engineInstance']['fields']['uuidFieldParser']['translate']
    >[0]['customAttributes']
  >(
    customAttributes: TCustomAttributes
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TCustomAttributes;
    }
  > {
    (this.__customAttributes as any) = customAttributes as any;

    return this as unknown as any;
  }

  unique<TUnique extends boolean = true>(
    isUnique?: TUnique
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TUnique;
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.unique(isUnique) as unknown as any;
  }

  allowNull<TNull extends boolean = true>(
    isNull?: TNull
  ): UuidField<
    {
      create: TType['create'] | null | undefined;
      read: TType['read'] | null | undefined;
      update: TType['update'] | null | undefined;
    },
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TNull;
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.allowNull(isNull) as unknown as any;
  }

  autoGenerate<TIsAutoGenerate extends boolean = true>(
    isAutoGenerate?: TIsAutoGenerate
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      autoGenerate: TIsAutoGenerate;
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    if (isAutoGenerate === undefined) (isAutoGenerate as any) = true;
    this.__autoGenerate = isAutoGenerate as TIsAutoGenerate;
    return this as unknown as any;
  }

  /**
   * This method is used to create an index on the database for this field.
   */
  dbIndex<TDbIndex extends boolean = true>(
    isDbIndex: TDbIndex
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDbIndex;
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.dbIndex(isDbIndex) as unknown as UuidField<
      TType,
      {
        [TKey in Exclude<
          keyof TDefinitions,
          | 'underscored'
          | 'allowNull'
          | 'dbIndex'
          | 'unique'
          | 'isPrimaryKey'
          | 'auto'
          | 'defaultValue'
          | 'databaseName'
          | 'typeName'
          | 'engineInstance'
          | 'customAttributes'
        >]: TDefinitions[TKey];
      } & {
        unique: TDefinitions['unique'];
        allowNull: TDefinitions['allowNull'];
        dbIndex: TDbIndex;
        underscored: TDefinitions['underscored'];
        isPrimaryKey: TDefinitions['isPrimaryKey'];
        auto: TDefinitions['auto'];
        defaultValue: TDefinitions['defaultValue'];
        databaseName: TDefinitions['databaseName'];
        typeName: TDefinitions['typeName'];
        engineInstance: TDefinitions['engineInstance'];
        customAttributes: TDefinitions['customAttributes'];
      }
    >;
  }

  underscored<TUnderscored extends boolean = true>(
    isUnderscored?: TUnderscored
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TUnderscored;
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.underscored(isUnderscored) as unknown as UuidField<
      TType,
      {
        [TKey in Exclude<
          keyof TDefinitions,
          | 'underscored'
          | 'allowNull'
          | 'dbIndex'
          | 'unique'
          | 'isPrimaryKey'
          | 'auto'
          | 'defaultValue'
          | 'databaseName'
          | 'typeName'
          | 'engineInstance'
          | 'customAttributes'
        >]: TDefinitions[TKey];
      } & {
        unique: TDefinitions['unique'];
        allowNull: TDefinitions['allowNull'];
        dbIndex: TDefinitions['dbIndex'];
        underscored: TUnderscored;
        isPrimaryKey: TDefinitions['isPrimaryKey'];
        auto: TDefinitions['auto'];
        defaultValue: TDefinitions['defaultValue'];
        databaseName: TDefinitions['databaseName'];
        typeName: TDefinitions['typeName'];
        engineInstance: TDefinitions['engineInstance'];
        customAttributes: TDefinitions['customAttributes'];
      }
    >;
  }

  primaryKey<TIsPrimaryKey extends boolean = true>(
    isPrimaryKey?: TIsPrimaryKey
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TIsPrimaryKey;
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.primaryKey(isPrimaryKey) as unknown as UuidField<
      TType,
      {
        [TKey in Exclude<
          keyof TDefinitions,
          | 'underscored'
          | 'allowNull'
          | 'dbIndex'
          | 'unique'
          | 'isPrimaryKey'
          | 'auto'
          | 'defaultValue'
          | 'databaseName'
          | 'typeName'
          | 'engineInstance'
          | 'customAttributes'
        >]: TDefinitions[TKey];
      } & {
        unique: TDefinitions['unique'];
        allowNull: TDefinitions['allowNull'];
        dbIndex: TDefinitions['dbIndex'];
        underscored: TDefinitions['underscored'];
        isPrimaryKey: TIsPrimaryKey;
        auto: TDefinitions['auto'];
        defaultValue: TDefinitions['defaultValue'];
        databaseName: TDefinitions['databaseName'];
        typeName: TDefinitions['typeName'];
        engineInstance: TDefinitions['engineInstance'];
        customAttributes: TDefinitions['customAttributes'];
      }
    >;
  }

  auto<TIsAuto extends boolean = true>(
    isAuto?: TIsAuto
  ): UuidField<
    {
      create: TType['create'] | null | undefined;
      read: TType['read'];
      update: TType['update'] | null | undefined;
    },
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TIsAuto;
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.auto(isAuto) as any;
  }

  default<TDefault extends TType['create']>(
    defaultValue: TDefault
  ): UuidField<
    {
      create: TType['create'] | TDefault | null | undefined;
      read: TType['read'];
      update: TType['update'] | null | undefined;
    },
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefault;
      databaseName: TDefinitions['databaseName'];
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.default(defaultValue) as unknown as any;
  }

  databaseName<TDatabaseName extends string>(
    databaseName: TDatabaseName
  ): UuidField<
    TType,
    {
      [TKey in Exclude<
        keyof TDefinitions,
        | 'underscored'
        | 'allowNull'
        | 'dbIndex'
        | 'unique'
        | 'isPrimaryKey'
        | 'auto'
        | 'defaultValue'
        | 'databaseName'
        | 'typeName'
        | 'engineInstance'
        | 'customAttributes'
      >]: TDefinitions[TKey];
    } & {
      unique: TDefinitions['unique'];
      allowNull: TDefinitions['allowNull'];
      dbIndex: TDefinitions['dbIndex'];
      underscored: TDefinitions['underscored'];
      isPrimaryKey: TDefinitions['isPrimaryKey'];
      auto: TDefinitions['auto'];
      defaultValue: TDefinitions['defaultValue'];
      databaseName: TDatabaseName;
      typeName: TDefinitions['typeName'];
      engineInstance: TDefinitions['engineInstance'];
      customAttributes: TDefinitions['customAttributes'];
    }
  > {
    return super.databaseName(databaseName) as unknown as any;
  }

  /**
   * This method can be used to override the type of a field. This is useful for library
   * maintainers that want to support a custom field type not supported by palmares.
   *
   * ### Note
   * - Your library should provide documentation of the fields that are supported.
   * - This should be used alongside the `_setPartialAttributes` method and `_setNewBuilderMethods`.
   * Instead of making users type NameOfYourField.new(), you should create a function that calls .new and creates
   * a new instance of the field for them.
   * - TDefinitions exists on type-level only, in runtime, it's not a guarantee of nothing. If TDefinitions
   * sets unique to true, it's up to you to do `NameOfYourField.new().unique()`, because otherwise it will be false
   */
  static overrideType<
    const TNewType extends { create: any; update: any; read: any },
    const TDefinitions extends {
      customAttributes: any;
      unique: boolean;
      auto: boolean;
      allowNull: boolean;
      dbIndex: boolean;
      isPrimaryKey: boolean;
      defaultValue: any;
      typeName: string;
      engineInstance: DatabaseAdapter;
      autoGenerate: boolean;
    } & Record<string, any>
  >(args?: {
    typeName: string;
    toStringCallback?: ToStringCallback;
    compareCallback?: TCompareCallback;
    optionsCallback?: TOptionsCallback;
    newInstanceCallback?: NewInstanceArgumentsCallback;
    customImports?: CustomImportsForFieldType[];
  }): TDefinitions['customAttributes'] extends undefined
    ? {
        new: (...args: any[]) => UuidField<
          TNewType,
          {
            unique: TDefinitions['unique'];
            auto: TDefinitions['auto'];
            allowNull: TDefinitions['allowNull'];
            dbIndex: TDefinitions['dbIndex'];
            isPrimaryKey: TDefinitions['isPrimaryKey'];
            defaultValue: TDefinitions['defaultValue'];
            underscored: boolean;
            databaseName: string | undefined;
            engineInstance: TDefinitions['engineInstance'];
            customAttributes: TDefinitions['customAttributes'];
            typeName: TDefinitions['typeName'];
            autoGenerate: TDefinitions['autoGenerate'];
          }
        >;
      }
    : {
        new: (params: TDefinitions['customAttributes']) => UuidField<
          TNewType,
          {
            unique: TDefinitions['unique'];
            auto: TDefinitions['auto'];
            allowNull: TDefinitions['allowNull'];
            dbIndex: TDefinitions['dbIndex'];
            isPrimaryKey: TDefinitions['isPrimaryKey'];
            defaultValue: TDefinitions['defaultValue'];
            underscored: boolean;
            databaseName: string | undefined;
            engineInstance: TDefinitions['engineInstance'];
            customAttributes: TDefinitions['customAttributes'];
            typeName: TDefinitions['typeName'];
            autoGenerate: TDefinitions['autoGenerate'];
          }
        >;
      } {
    return super.overrideType(args) as unknown as TDefinitions['customAttributes'] extends undefined
      ? {
          new: (...args: any[]) => UuidField<
            TNewType,
            {
              unique: TDefinitions['unique'];
              auto: TDefinitions['auto'];
              allowNull: TDefinitions['allowNull'];
              dbIndex: TDefinitions['dbIndex'];
              isPrimaryKey: TDefinitions['isPrimaryKey'];
              defaultValue: TDefinitions['defaultValue'];
              underscored: boolean;
              databaseName: string | undefined;
              engineInstance: TDefinitions['engineInstance'];
              typeName: TDefinitions['typeName'];
              customAttributes: TDefinitions['customAttributes'];
              autoGenerate: TDefinitions['autoGenerate'];
            }
          >;
        }
      : {
          new: (params: TDefinitions['customAttributes']) => UuidField<
            TNewType,
            {
              unique: TDefinitions['unique'];
              auto: TDefinitions['auto'];
              allowNull: TDefinitions['allowNull'];
              dbIndex: TDefinitions['dbIndex'];
              isPrimaryKey: TDefinitions['isPrimaryKey'];
              defaultValue: TDefinitions['defaultValue'];
              underscored: boolean;
              databaseName: string | undefined;
              engineInstance: TDefinitions['engineInstance'];
              typeName: TDefinitions['typeName'];
              customAttributes: TDefinitions['customAttributes'];
              autoGenerate: TDefinitions['autoGenerate'];
            }
          >;
        };
  }

  static new(..._args: any[]): UuidField<
    {
      create: string;
      read: string;
      update: string;
    },
    {
      unique: false;
      allowNull: false;
      dbIndex: false;
      underscored: true;
      autoGenerate: false;
      isPrimaryKey: false;
      auto: false;
      defaultValue: undefined;
      typeName: string;
      databaseName: undefined;
      engineInstance: DatabaseAdapter;
      customAttributes: any;
    }
  > {
    return new this(..._args);
  }
}
