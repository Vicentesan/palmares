import {
  adapterGetQuery,
  adapterOrderingQuery,
  adapterQuery,
  adapterRemoveQuery,
  adapterSearchQuery,
  adapterSetQuery
} from '@palmares/databases';
import {
  and,
  asc,
  between,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  not,
  notBetween,
  notIlike,
  notInArray,
  notLike,
  or
} from 'drizzle-orm';

const getQuery = adapterGetQuery({
  // eslint-disable-next-line ts/require-await
  queryData: async (engine, args) => {
    const selectArgs =
      Array.isArray(args.fields) && args.fields.length > 0
        ? [args.fields.reduce((acc, field) => ({ ...acc, [field]: args.modelOfEngineInstance[field] }), {})]
        : [];
    let query = engine.instance.instance.select(...selectArgs).from(args.modelOfEngineInstance);

    if (args.search) {
      const searchAsObjectValues = Object.values(args.search) as any;
      if (searchAsObjectValues.length > 0) query = query.where(and(...searchAsObjectValues));
    }
    if (typeof args.limit === 'number') query = query.limit(args.limit);
    if (typeof args.offset === 'number') query = query.offset(args.offset);
    if ((args.ordering || []).length > 0) query = query.orderBy(...(args.ordering || []));
    return query;
  }
});

const setQuery = adapterSetQuery({
  queryData: async (engine, args) => {
    const engineInstanceOrTransaction = args.transaction || engine.instance.instance;
    if (args.search && Object.keys(args.search).length > 0) {
      if (engine.instance.mainType === 'sqlite' || engine.instance.mainType === 'postgres') {
        return (
          (await engineInstanceOrTransaction
            .update(args.modelOfEngineInstance)
            .set(args.data[0])
            .where(and(...(Object.values(args.search) as any)))
            .returning()) || ([] as any)
        ).map((data: any) => [false, data]);
      } else {
        await engineInstanceOrTransaction
          .update(args.modelOfEngineInstance)
          .set(args.data[0])
          .where(and(...(Object.values(args.search) as any)));
        const search = await engineInstanceOrTransaction
          .select()
          .from(args.modelOfEngineInstance)
          .where(and(...(Object.values(args.search) as any)));
        return search.map((each: any) => [false, each]);
      }
    }
    const inserts = await Promise.all(
      args.data.map(async (eachData: any) => {
        if (engine.instance.mainType === 'sqlite' || engine.instance.mainType === 'postgres') {
          return [
            true,
            (await engineInstanceOrTransaction.insert(args.modelOfEngineInstance).values(eachData).returning())[0]
          ];
        }

        const results = await engineInstanceOrTransaction
          .insert(args.modelOfEngineInstance)
          .values(eachData)
          .$returningId();
        const insertedData = results?.[0];
        if (!insertedData) return undefined;
        const primaryKey = Object.keys(insertedData)[0];
        const primaryKeyValue = insertedData[primaryKey];
        const searchForInsertedData = eq(args.modelOfEngineInstance[primaryKey], primaryKeyValue);
        const searchResult = await engineInstanceOrTransaction
          .select()
          .from(args.modelOfEngineInstance)
          .where(searchForInsertedData);

        if ((searchResult?.length || []) <= 0) return undefined;
        return [true, searchResult[0]];
      })
    );
    return inserts.filter((insert) => Array.isArray(insert));
  }
});

const removeQuery = adapterRemoveQuery({
  queryData: async (engine, args) => {
    const engineInstanceOrTransaction = args.transaction || engine.instance.instance;

    if (engine.instance.mainType === 'sqlite' || engine.instance.mainType === 'postgres')
      return engineInstanceOrTransaction
        .delete(args.modelOfEngineInstance)
        .where(and(...(Object.values(args.search) as any)))
        .returning();

    const dataToBeDeleted = await engine.instance.instance
      .select()
      .from(args.modelOfEngineInstance)
      .where(and(...(Object.values(args.search) as any)));

    await engineInstanceOrTransaction
      .delete(args.modelOfEngineInstance)
      .where(and(...(Object.values(args.search) as any)));
    return dataToBeDeleted;
  }
});

const order = adapterOrderingQuery({
  // eslint-disable-next-line ts/require-await
  parseOrdering: async (model, ordering) => {
    return ordering.map((order) => {
      const isDescending = order.startsWith('-');
      return isDescending ? desc(model[order.slice(1)]) : asc(model[order]);
    });
  }
});

const search = adapterSearchQuery({
  // eslint-disable-next-line ts/require-await
  parseSearchFieldValue: async (operationType, key, model, value: any, result: any, options: any) => {
    switch (operationType) {
      case 'like': {
        if (options?.ignoreCase) result[key] = ilike(model[key], value as string);
        else if (options?.isNot && options.ignoreCase) result[key] = notIlike(model[key], value as string);
        else if (options?.isNot) result[key] = notLike(model[key], value as string);
        else result[key] = like(model[key], value as string);
        return;
      }
      case 'is':
        if (value === null && options?.isNot) {
          result[key] = isNotNull(model[key]);
          return;
        } else if (value === null) {
          result[key] = isNull(model[key]);
          return;
        } else if (options?.isNot) result[key] = not(eq(model[key], value));
        else result[key] = eq(model[key], value);
        return;
      case 'in':
        if (options?.isNot) result[key] = notInArray(model[key], value as any[]);
        else result[key] = inArray(model[key], value as any[]);
        return;
      case 'between':
        if (options?.isNot) result[key] = notBetween(model[key], value, value);
        else result[key] = between(model[key], value, value);
        return;
      case 'and':
        result[key] = and(eq(model[key], value), eq(model[key], value));
        return;
      case 'or':
        result[key] = or(eq(model[key], value), eq(model[key], value));
        return;
      case 'greaterThan':
        if (options?.equals) result[key] = gte(model[key], value);
        else result[key] = gt(model[key], value);
        return;
      case 'lessThan':
        if (options?.equals) result[key] = lte(model[key], value);
        else result[key] = lt(model[key], value);
        return;
      default:
        result[key] = eq(model[key], value);
    }
  }
});

export const query = adapterQuery({
  search: new search(),
  ordering: new order(),
  get: new getQuery(),
  set: new setQuery(),
  remove: new removeQuery()
});
