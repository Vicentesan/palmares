import {
  AllOptionalModelFields,
  AllRequiredModelFields,
  EngineQuery,
  ModelFields,
  TModel,
  models,
  IncludesRelatedModels,
} from '@palmares/databases';

import {
  ModelCtor,
  Model,
  Attributes,
  WhereOptions,
  CreationAttributes,
  Includeable,
  // eslint-disable-next-line import/no-unresolved
} from 'sequelize/types';
// eslint-disable-next-line import/no-unresolved
import { Col, Fn, Literal } from 'sequelize/types/utils';

export default class SequelizeEngineQuery extends EngineQuery {
  /**
   * This is a recursive function used to retrieve the includes of the queries.
   * What we try to do is to not enable recursive calls. For example:
   *
   * If we have a model user and this model user refers to itself we will not be able to retrieve the relations.
   * for this relation with itself. The same apply for other models.
   *
   * Usually a relation is tied Both ways, this means that, if we have the model User and Post.
   * and we attach each user to a post. Then from the User we will be able to retrieve all of the Posts
   * and from each Post we will be able to retrieve the attached user.
   *
   * Suppose that we are trying to retrieve the posts of the user. That's fine, but trying to retrieve the user from
   * each Post will lead to a circular relation which will lead to a recursion, this is not supported from Sequelize
   * so we do not support this here.
   *
   * About the explanation above: Each user will retrieve N posts, but each post will retrieve a user, but each user
   * will retrieve N posts,... That's what makes it recursive.
   *
   * @param model - The model we want to retrieve the associations from.
   * @param includes - The models that we are wanting to include.
   * @param includeStatement - An array. Remember that it's passed by reference so we can pass it over
   * inside of the recursion and it's reference will be updated.
   * @param modelAlreadyParsed - Those are the models that were already parsed, we need this so we can
   * prevent recursive/circular includes like we explained above.
   *
   * @returns - Returns an array, this array is the include statement to be used inside of the query.
   */
  async getIncludeStatement<M extends TModel>(
    model: ModelCtor<Model<ModelFields<M>>>,
    includes: ModelCtor<Model<ModelFields<M>>>[],
    includeStatement: Includeable[] = [],
    modelAlreadyParsed: ModelCtor<Model<ModelFields<M>>>[] = []
  ) {
    modelAlreadyParsed.push(model);
    const associationsOfModel = Object.entries(model.associations);
    for (const [associationName, association] of associationsOfModel) {
      const hasNotParsedModelYet =
        modelAlreadyParsed.includes(association.target) === false;
      const includesInIncludeStatement = includes.includes(association.target);
      if (hasNotParsedModelYet && includesInIncludeStatement) {
        const nextInclude = [] as Includeable[];
        const includeObject: Includeable = {
          model: association.target,
          as: associationName,
        };
        await this.getIncludeStatement(
          association.target,
          includes.map((include) =>
            include === association.target ? model : include
          ),
          nextInclude,
          modelAlreadyParsed
        );
        if (nextInclude.length > 0) includeObject.include = nextInclude;
        includeStatement.push(includeObject);
      }
    }
    return includeStatement;
  }

  override async get<
    M extends TModel,
    I extends readonly ReturnType<typeof models.Model>[] | undefined
  >(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    instance: ModelCtor<Model<ModelFields<M>>>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    args?: {
      includes?: ModelCtor<Model<ModelFields<M>>>[];
      search?: AllOptionalModelFields<M>;
    }
  ): Promise<IncludesRelatedModels<AllRequiredModelFields<M>, M, I>[]> {
    const include = await this.getIncludeStatement(
      instance,
      args?.includes || [],
      [],
      []
    );
    try {
      return instance.findAll({
        where: args?.search,
        include: include,
        raw: true,
        nest: true,
      }) as unknown as Promise<
        IncludesRelatedModels<AllRequiredModelFields<M>, M, I>[]
      >;
    } catch {
      return [];
    }
  }

  async set<
    M extends TModel,
    S extends AllOptionalModelFields<M> | undefined | null = undefined
  >(
    instance: ModelCtor<Model<ModelFields<M>>>,
    data: S extends undefined ? ModelFields<M> : AllOptionalModelFields<M>,
    search?: S
  ): Promise<
    S extends undefined | null ? AllRequiredModelFields<M> | undefined : boolean
  > {
    type SequelizeModel = Model<ModelFields<M>>;
    type SequelizeAttributes = Attributes<SequelizeModel>;
    type UpdateValueType = {
      [key in keyof SequelizeAttributes]?:
        | SequelizeAttributes[key]
        | Fn
        | Col
        | Literal;
    };
    type SearchType = WhereOptions<SequelizeAttributes>;

    try {
      if (search) {
        await instance.update<Model<ModelFields<M>>>(data as UpdateValueType, {
          where: search as SearchType,
        });
        return true as S extends undefined | null
          ? AllRequiredModelFields<M> | undefined
          : boolean;
      }
      return (await instance.create(
        data as CreationAttributes<SequelizeModel>
      )) as unknown as S extends undefined | null
        ? AllRequiredModelFields<M> | undefined
        : boolean;
    } catch (e) {
      if (search) {
        return false as S extends undefined | null
          ? AllRequiredModelFields<M> | undefined
          : boolean;
      }
      return undefined as S extends undefined | null
        ? AllRequiredModelFields<M> | undefined
        : boolean;
    }
  }

  async remove<M extends TModel>(
    instance: ModelCtor<Model<ModelFields<M>>>,
    search?: AllOptionalModelFields<M>
  ): Promise<boolean> {
    try {
      await instance.destroy({
        where: search,
      });
      return true;
    } catch {
      return false;
    }
  }
}
