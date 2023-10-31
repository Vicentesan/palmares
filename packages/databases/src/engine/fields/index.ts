import Adapter from '..';
import { Field } from '../../models/fields';
import AdapterFieldParser from './field';
import AdapterAutoFieldParser from './auto';
import AdapterBigAutoFieldParser from './big-auto';
import AdapterBigIntegerFieldParser from './big-integer';
import AdapterDateFieldParser from './date';
import AdapterForeignKeyFieldParser from './foreign-key';
import AdapterIntegerFieldParser from './integer';
import AdapterUuidFieldParser from './uuid';
import AdapterDecimalFieldParser from './decimal';
import AdapterCharFieldParser from './char';
import AdapterTextFieldParser from './text';
import AdapterEnumFieldParser from './enum';
import AdapterBooleanFieldParser from './boolean';
import { NotImplementedAdapterFieldsException } from '../exceptions';

/**
 * Functional approach to create a custom {@link AdapterFields} class.
 */
export function adapterFields<
  TFieldsParser extends AdapterFieldParser,
  TAutoFieldParser extends AdapterAutoFieldParser,
  TBigAutoFieldParser extends AdapterBigAutoFieldParser,
  TBigIntegerFieldParser extends AdapterBigIntegerFieldParser,
  TCharFieldParser extends AdapterCharFieldParser,
  TDateFieldParser extends AdapterDateFieldParser,
  TDecimalFieldParser extends AdapterDecimalFieldParser,
  TForeignKeyFieldParser extends AdapterForeignKeyFieldParser,
  TIntegerFieldParser extends AdapterIntegerFieldParser,
  TTextFieldParser extends AdapterTextFieldParser,
  TUuidFieldParser extends AdapterUuidFieldParser,
  TEnumFieldParser extends AdapterEnumFieldParser,
  TBooleanFieldParser extends AdapterBooleanFieldParser,
  TLazyEvaluateField extends AdapterFields['lazyEvaluateField'],
  TTranslateField extends AdapterFields['translateField'],
>(args: {
  /** An {@link AdapterFieldParser}, it allows you to have a default translate function for all fields. By default, the translate function will receive the fields parser */
  fieldsParser: TFieldsParser;
  autoFieldParser: TAutoFieldParser;
  bigAutoFieldParser: TBigAutoFieldParser;
  bigIntegerFieldParser: TBigIntegerFieldParser;
  charFieldParser: TCharFieldParser;
  dateFieldParser: TDateFieldParser;
  decimalFieldParser: TDecimalFieldParser;
  foreignKeyFieldParser: TForeignKeyFieldParser;
  integerFieldParser: TIntegerFieldParser;
  textFieldParser: TTextFieldParser;
  uuidFieldParser: TUuidFieldParser;
  enumFieldParser: TEnumFieldParser;
  booleanFieldParser: TBooleanFieldParser;
  /**
   * Stuff like `foreignKeys` can be a little cumbersome to implement. Specially when you are doing a translation from one ORM to another. We don't really know how your ORM
   * handles stuff. So instead of you trying to get around our implementation, we already offer you a way to define your own custom implementation of lazy evaluation of fields.
   *
   * This is used alongside the `lazyEvaluate` parameter on the `translate` method of your field parser.
   *
   * ### Some examples
   *
   * On Sequelize you need to define relations using the `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` methods. You do not define foreign keys directly on the model.
   *
   * So what you need to do is:
   * @example
   * ```ts
   * // First, on your FieldParser you need to call the `lazyEvaluate` function, what you pass to it, will be passed to this method on `_fieldTranslated`.
   *
   * export default class SequelizeAdapterForeignKeyFieldParser extends AdapterForeignKeyFieldParser {
   *   async translate(args: {
   *     Adapter: SequelizeAdapter;
   *     field: ForeignKeyField;
   *     fieldParser: SequelizeAdapterFieldParser;
   *     modelName: string;
   *     model: InstanceType<ReturnType<typeof Model>>;
   *     lazyEvaluate: (translatedField: TranslatedFieldToEvaluateAfterType) => void;
   *   }): Promise<undefined> {
   *     const defaultOptions = await args.fieldParser.translate(args);
   *
   *     args.lazyEvaluate({
   *       fieldAttributes: defaultOptions;
   *       type: 'foreign-key',
   *      } as TranslatedFieldToEvaluateAfterType);
   *   }
   * }
   *
   * // Then, on your AdapterFields you need to implement the `lazyEvaluateField` method.
   *
   * export default class SequelizeAdapterFields extends AdapterFields {
   *   async lazyEvaluateField(
   *     Adapter: SequelizeAdapter,
   *     _modelName: string,
   *     translatedModel: ModelCtor<Model>,
   *     field: Field,
   *     fieldTranslated: TranslatedFieldToEvaluateAfterType
   *   ): Promise<any> {
   *     switch (fieldTranslated.type) {
   *       case 'foreign-key':
   *         handleRelatedField(Adapter, field as ForeignKeyField, fieldTranslated);
   *         break;
   *       case 'date':
   *         translatedModel.addHook('beforeSave', `${field.fieldName}AutoNow`, (instance: Model) => {
   *           // eslint-disable-next-line @typescript-eslint/ban-ts-comment
   *           // @ts-ignore
   *           instance[updateDateHook] = new Date();
   *         });
   *         break;
   *     }
   *     return translatedModel;
   *   }
   * }
   * ```
   *
   * So as you can see, you can use the `lazyEvaluate` function to pass any data you want to the `lazyEvaluateField` method. This method already gives you the model translated
   * so if you want to do any custom logic with the model, you can do it here.
   *
   * @param Adapter - The Adapter that is being used. That's your own custom Adapter implementation.
   * @param modelName - The name of the model that is being translated.
   * @param translatedModel - The model translated to something that the ORM can understand.
   * @param field - The field of the model that is being translated.
   * @param fieldTranslated - The data that is sent when you call `lazyEvaluate` on the `translate` method of your {@link AdapterFieldParser}.
   *
   * @returns - Should return the model translated and modified, even if you do not modify the model, you should return the translated model.
   */
  lazyEvaluateField: TLazyEvaluateField;
  /**
   * This method is completely optional, by default we offer a default implementation that is able to bypass that and calls the `translate` methods directly.
   *
   * This method is used to retrieve the field translated to something that your custom ORM can understand.
   *
   * For drizzleORM, that would be something like this: `integer('int1').default(10)` or `integer('int2').default(sql`'10'::int`)`
   * (It's on their docs: https://orm.drizzle.team/docs/column-types/pg#integer).
   *
   * So you are pretty much translating the Palmares model Field to your own ORM field.
   *
   * - **If you want to bypass our custom implementation and do everything by your own:**
   *
   * @example
   * ```ts
   * async translateField(Adapter: Adapter, field: Field, defaultTranslateFieldCallback: (field: Field) => Promise<any>) {
   *   switch (field.typeName) {
   *      case 'IntegerField':
   *         return integer(field.name).default(field.defaultValue);
   *      case 'CharField':
   *          return char(field.name, { length: field.maxLength }).default(field.defaultValue);
   *    }
   * }
   * ```
   *
   * - **If you want to call the `translate` methods on each field parser. But you do not want to call the `translate` method by hand you can use the `defaultTranslateFieldCallback`:**
   *
   * @example
   * ```ts
   * async translateField(Adapter: Adapter, field: Field, defaultTranslateFieldCallback: (field: Field) => Promise<any>) {
   *    const translatedField = await defaultTranslateFieldCallback(field);
   *
   *    // Do any custom logic that you want to do with the translated field. Or translated other field types we do not support by default.
   *    translatedField.default(field.defaultValue);
   *    return translatedField;
   * }
   * ```
   *
   * _Note_: **Last but not least, you can also opt to not implement this function and we will handle that for you.**
   *
   * @param Adapter - The Adapter that is being used. That's your own custom Adapter implementation.
   * @param field - The field of the model that is being translated.
   * @param defaultTranslateFieldCallback - The default callback that you can call to translate the field. It will use the `translate` method of the field parser.
   *
   * @returns The field translated to something that the ORM can understand.
   */
  translateField?: TTranslateField;
}) {
  class CustomAdapterFields extends AdapterFields {
    fieldsParser = args.fieldsParser as TFieldsParser;
    autoFieldParser = args.autoFieldParser as TAutoFieldParser;
    bigAutoFieldParser = args.bigAutoFieldParser as TBigAutoFieldParser;
    bigIntegerFieldParser = args.bigIntegerFieldParser as TBigIntegerFieldParser;
    charFieldParser = args.charFieldParser as TCharFieldParser;
    dateFieldParser = args.dateFieldParser as TDateFieldParser;
    decimalFieldParser = args.decimalFieldParser as TDecimalFieldParser;
    foreignKeyFieldParser = args.foreignKeyFieldParser as TForeignKeyFieldParser;
    integerFieldParser = args.integerFieldParser as TIntegerFieldParser;
    textFieldParser = args.textFieldParser as TTextFieldParser;
    uuidFieldParser = args.uuidFieldParser as TUuidFieldParser;
    enumFieldParser = args.enumFieldParser as TEnumFieldParser;
    booleanFieldParser = args.booleanFieldParser as TBooleanFieldParser;
    lazyEvaluateField = args.lazyEvaluateField as TLazyEvaluateField;
    translateField = args.translateField as TTranslateField;
  }

  return CustomAdapterFields as typeof AdapterFields & {
    new (): AdapterFields & {
      fieldsParser: TFieldsParser;
      autoFieldParser: TAutoFieldParser;
      bigAutoFieldParser: TBigAutoFieldParser;
      bigIntegerFieldParser: TBigIntegerFieldParser;
      charFieldParser: TCharFieldParser;
      dateFieldParser: TDateFieldParser;
      decimalFieldParser: TDecimalFieldParser;
      foreignKeyFieldParser: TForeignKeyFieldParser;
      integerFieldParser: TIntegerFieldParser;
      textFieldParser: TTextFieldParser;
      uuidFieldParser: TUuidFieldParser;
      enumFieldParser: TEnumFieldParser;
      booleanFieldParser: TBooleanFieldParser;
      lazyEvaluateField: TLazyEvaluateField;
      translateField: TTranslateField;
    };
  };
}

/**
 * This works as a storage and transformer for all of the fields. First we have the `set` method
 * that will store all of the fields in the object and then we have the `get` method that will return
 * the fields translated to a way that the ORM can understand.
 */
export default class AdapterFields {
  /** An {@link AdapterFieldParser}, it allows you to have a default translate function for all fields. By default, the translate function will receive the fields parser */
  fieldsParser: AdapterFieldParser = new AdapterFieldParser();
  autoFieldParser: AdapterAutoFieldParser = new AdapterAutoFieldParser();
  bigAutoFieldParser: AdapterBigAutoFieldParser = new AdapterBigAutoFieldParser();
  bigIntegerFieldParser: AdapterBigIntegerFieldParser = new AdapterBigIntegerFieldParser();
  charFieldParser: AdapterCharFieldParser = new AdapterCharFieldParser();
  dateFieldParser: AdapterDateFieldParser = new AdapterDateFieldParser();
  decimalFieldParser: AdapterDecimalFieldParser = new AdapterDecimalFieldParser();
  foreignKeyFieldParser: AdapterForeignKeyFieldParser = new AdapterForeignKeyFieldParser();
  integerFieldParser: AdapterIntegerFieldParser = new AdapterIntegerFieldParser();
  textFieldParser: AdapterTextFieldParser = new AdapterTextFieldParser();
  uuidFieldParser: AdapterUuidFieldParser = new AdapterUuidFieldParser();
  enumFieldParser: AdapterEnumFieldParser = new AdapterEnumFieldParser();
  booleanFieldParser: AdapterBooleanFieldParser = new AdapterBooleanFieldParser();

  /**
   * Stuff like `foreignKeys` can be a little cumbersome to implement. Specially when you are doing a translation from one ORM to another. We don't really know how your ORM
   * handles stuff. So instead of you trying to get around our implementation, we already offer you a way to define your own custom implementation of lazy evaluation of fields.
   *
   * This is used alongside the `lazyEvaluate` parameter on the `translate` method of your field parser.
   *
   * ### Some examples
   *
   * On Sequelize you need to define relations using the `hasOne`, `hasMany`, `belongsTo`, `belongsToMany` methods. You do not define foreign keys directly on the model.
   *
   * So what you need to do is:
   * @example
   * ```ts
   * // First, on your FieldParser you need to call the `lazyEvaluate` function, what you pass to it, will be passed to this method on `_fieldTranslated`.
   *
   * export default class SequelizeAdapterForeignKeyFieldParser extends AdapterForeignKeyFieldParser {
   *   async translate(args: {
   *     Adapter: SequelizeAdapter;
   *     field: ForeignKeyField;
   *     fieldParser: SequelizeAdapterFieldParser;
   *     modelName: string;
   *     model: InstanceType<ReturnType<typeof Model>>;
   *     lazyEvaluate: (translatedField: TranslatedFieldToEvaluateAfterType) => void;
   *   }): Promise<undefined> {
   *     const defaultOptions = await args.fieldParser.translate(args);
   *
   *     args.lazyEvaluate({
   *       fieldAttributes: defaultOptions;
   *       type: 'foreign-key',
   *      } as TranslatedFieldToEvaluateAfterType);
   *   }
   * }
   *
   * // Then, on your AdapterFields you need to implement the `lazyEvaluateField` method.
   *
   * export default class SequelizeAdapterFields extends AdapterFields {
   *   async lazyEvaluateField(
   *     Adapter: SequelizeAdapter,
   *     _modelName: string,
   *     translatedModel: ModelCtor<Model>,
   *     field: Field,
   *     fieldTranslated: TranslatedFieldToEvaluateAfterType
   *   ): Promise<any> {
   *     switch (fieldTranslated.type) {
   *       case 'foreign-key':
   *         handleRelatedField(Adapter, field as ForeignKeyField, fieldTranslated);
   *         break;
   *       case 'date':
   *         translatedModel.addHook('beforeSave', `${field.fieldName}AutoNow`, (instance: Model) => {
   *           // eslint-disable-next-line @typescript-eslint/ban-ts-comment
   *           // @ts-ignore
   *           instance[updateDateHook] = new Date();
   *         });
   *         break;
   *     }
   *     return translatedModel;
   *   }
   * }
   * ```
   *
   * So as you can see, you can use the `lazyEvaluate` function to pass any data you want to the `lazyEvaluateField` method. This method already gives you the model translated
   * so if you want to do any custom logic with the model, you can do it here.
   *
   * @param Adapter - The Adapter that is being used. That's your own custom Adapter implementation.
   * @param modelName - The name of the model that is being translated.
   * @param translatedModel - The model translated to something that the ORM can understand.
   * @param field - The field of the model that is being translated.
   * @param fieldTranslated - The data that is sent when you call `lazyEvaluate` on the `translate` method of your {@link AdapterFieldParser}.
   *
   * @returns - Should return the model translated and modified, even if you do not modify the model, you should return the translated model.
   */
  async lazyEvaluateField(
    _Adapter: Adapter,
    _modelName: string,
    _translatedModel: any,
    _field: Field,
    _fieldTranslated: any
  ): Promise<any> {
    throw new NotImplementedAdapterFieldsException('lazyEvaluateField');
  }

  /**
   * This method is completely optional, by default we offer a default implementation that is able to bypass that and calls the `translate` methods directly.
   *
   * This method is used to retrieve the field translated to something that your custom ORM can understand.
   *
   * For drizzleORM, that would be something like this: `integer('int1').default(10)` or `integer('int2').default(sql`'10'::int`)`
   * (It's on their docs: https://orm.drizzle.team/docs/column-types/pg#integer).
   *
   * So you are pretty much translating the Palmares model Field to your own ORM field.
   *
   * - **If you want to bypass our custom implementation and do everything by your own:**
   *
   * @example
   * ```ts
   * async translateField(Adapter: Adapter, field: Field, defaultTranslateFieldCallback: (field: Field) => Promise<any>) {
   *   switch (field.typeName) {
   *      case 'IntegerField':
   *         return integer(field.name).default(field.defaultValue);
   *      case 'CharField':
   *          return char(field.name, { length: field.maxLength }).default(field.defaultValue);
   *    }
   * }
   * ```
   *
   * - **If you want to call the `translate` methods on each field parser. But you do not want to call the `translate` method by hand you can use the `defaultTranslateFieldCallback`:**
   *
   * @example
   * ```ts
   * async translateField(Adapter: Adapter, field: Field, defaultTranslateFieldCallback: (field: Field) => Promise<any>) {
   *    const translatedField = await defaultTranslateFieldCallback(field);
   *
   *    // Do any custom logic that you want to do with the translated field. Or translated other field types we do not support by default.
   *    translatedField.default(field.defaultValue);
   *    return translatedField;
   * }
   * ```
   *
   * _Note_: **Last but not least, you can also opt to not implement this function and we will handle that for you.**
   *
   * @param Adapter - The Adapter that is being used. That's your own custom Adapter implementation.
   * @param field - The field of the model that is being translated.
   * @param defaultTranslateFieldCallback - The default callback that you can call to translate the field. It will use the `translate` method of the field parser.
   *
   * @returns The field translated to something that the ORM can understand.
   */
  async translateField?(
    _Adapter: Adapter,
    _field: Field,
    _defaultTranslateFieldCallback: (_field: Field) => Promise<any>
  ): Promise<any> {
    throw new NotImplementedAdapterFieldsException('translateField');
  }
}
