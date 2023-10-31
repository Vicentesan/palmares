import { EngineSetQuery, DatabaseAdapter } from '@palmares/databases';
import { Model, ModelCtor, Transaction } from 'sequelize';

export default class SequelizeEngineSetQuery extends EngineSetQuery {
  async queryData(
    _: DatabaseAdapter,
    args: {
      modelOfEngineInstance: ModelCtor<Model>;
      search: any;
      data?: any;
      transaction?: Transaction;
    }
  ): Promise<[boolean, any][]> {
    return Promise.all(
      args.data.map(async (eachData: any) => {
        if (args.search === undefined)
          return [
            true,
            (
              await args.modelOfEngineInstance.create(eachData, {
                transaction: args.transaction,
              })
            ).toJSON(),
          ];
        const [instance, hasCreated] = await args.modelOfEngineInstance.upsert(eachData, {
          transaction: args.transaction,
          returning: true,
        });
        return [hasCreated ? hasCreated : false, instance.toJSON()];
      })
    );
  }
}
