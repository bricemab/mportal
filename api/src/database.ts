// dataSource.ts
import {
  DataSource,
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from "typeorm";
import config from "./config/config";
import GlobalStore from "./utils/GlobalStore";
import AbstractEntity from "./entities/AbstractEntity";
import { RequestContext } from "./utils/RequestContext";
import { HistoryEntity } from "./entities/History/HistoryEntity";
import { HistoryChangeType } from "./entities/History/HistoryChangeType";
import { UserEntity } from "./entities/User/UserEntity";

@EventSubscriber()
export class HistorySubscriber
  implements EntitySubscriberInterface<AbstractEntity>
{
  listenTo() {
    return AbstractEntity;
  }

  /*
      It's better to listen to 'after' events as it won't be triggered if
      a mysql error happens beforehand, and the id is set for insert event (which
      is not the case with 'before' event)
   */

  afterInsert(event: InsertEvent<AbstractEntity>) {
    console.log("After insert", event.entity.constructor.name);

    HistorySubscriber.saveHistory(
      // No await : don't block the request for that
      HistoryChangeType.CREATE,
      event.entity,
    );
  }

  afterUpdate(event: UpdateEvent<AbstractEntity>) {
    /*
        event.entity is the updated entity (marked as ObjectLiteral but is really
        an instance of AbstractEntity)

        event.databaseEntity is the old value
     */

    if (event.entity && event.entity instanceof AbstractEntity) {
      console.log("After update", event.databaseEntity.constructor.name);

      const entity = event.entity;
      const changes: Record<string, any> = {};

      // Add columns changes
      event.updatedColumns.forEach((column) => {
        const columnName = column.propertyName as keyof AbstractEntity;

        if (
          entity[columnName] &&
          !["createdAt", "updatedAt"].includes(columnName)
        )
          changes[columnName] = entity[columnName];
      });

      // Add relations changes
      event.updatedRelations.forEach((relation) => {
        const relationName = relation.propertyName as keyof AbstractEntity;

        if (
          entity[relationName] instanceof AbstractEntity &&
          !["createdAt", "updatedAt"].includes(relationName)
        )
          changes[`${relationName}Id`] = entity[relationName].id;
      });

      if (Object.keys(changes).length > 0) {
        // Saving an entity without changes will result in a change of 'updatedAt', but we don't want to save that in history
        HistorySubscriber.saveHistory(
          // No await : don't block the request for that
          HistoryChangeType.UPDATE,
          entity,
          changes,
        );
      }
    }
  }

  afterRemove(event: RemoveEvent<AbstractEntity>) {
    console.log("After remove", event.databaseEntity.constructor.name);

    HistorySubscriber.saveHistory(
      // No await : don't block the request for that
      HistoryChangeType.DELETE,
      event.databaseEntity,
    );
  }

  /**
   * Insert entity changes in history tables
   *
   * IMPORTANT: Must be executed within a RequestContext !
   *
   * Note: Does nothing if entity has keepHistory set to false
   *
   * @throws RequestContextError when called out of a request context
   */
  static async saveHistory(
    type: HistoryChangeType,
    entity: AbstractEntity,
    changes?: Record<string, any>,
  ) {
    if (!entity.keepHistory()) return;

    const authorId = RequestContext.getUserId(); // May throw RequestContextError

    const changeType = type;
    const author = await GlobalStore.getORM()
      .getRepository(UserEntity)
      .findOneBy({ id: authorId });

    if (changeType && author) {
      const history = new HistoryEntity();

      history.tableName = GlobalStore.getORM().getRepository(
        entity.constructor,
      ).metadata.tableName;
      history.type = changeType;
      history.userId = author;
      history.tableId = entity.id;
      history.value = entity.toJSON();
      history.changes = changes;

      await GlobalStore.getORM().getRepository(HistoryEntity).save(history);
    } else {
      console.warn(`Error while saving history`, type, entity, changes);

      if (!changeType)
        console.warn(`Unable to find HistoryChangeTypeEntity ${type}`);
      if (!author) console.warn(`Unable to find UserEntity ${authorId}`);
    }
  }
}

export const AppDataSource = new DataSource({
  type: "mysql",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.database,
  synchronize: true,
  subscribers: [HistorySubscriber],
  entities: [__dirname + "/entities/**/*Entity{.js,.ts}"],
});

export const initializeDatabase = async () => {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    GlobalStore.addItem("orm", AppDataSource);
    console.log("DataSource orm initialisée");
  }
};
