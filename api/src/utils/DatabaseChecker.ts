import { DataSource, EntityTarget, In, Repository } from "typeorm";
import AbstractEntity from "../entities/AbstractEntity";


export enum CheckEnumType {
  DB_EQUALS_ENUM, // default
  DB_INCLUDES_ENUM
}

export default class DatabaseChecker {
  dataSource: DataSource;
  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   *
   * @param entityClass Classe de l'entité (ex: TaskTypeEntity)
   * @param enumType Enum à comparer (ex: TaskTypeType)
   * @param dbKey Clé à comparer en DB (ex: "name")
   * @param checkType (optionel) Défini si l'enum doit contenir toutes les clés défini en DB
   *
   * @throws Error Quand l'enum ne correspond pas à la DB
   */
  public async checkEnum<E>(
    entityClass: { new (): E },
    enumType: object,
    dbKey: keyof E,
    checkType = CheckEnumType.DB_EQUALS_ENUM
  ): Promise<boolean> {
    let isChecked = true;

    const repository: Repository<AbstractEntity> = this.dataSource.getRepository(entityClass as EntityTarget<AbstractEntity>);
    const dbRecords: AbstractEntity[] = await repository.findBy(
      checkType === CheckEnumType.DB_INCLUDES_ENUM ? { id: In(Object.values(enumType)) } : {}
    );

    const enumEntries = Object.entries(enumType)
      .filter(([key, value]) => typeof value === "number") as [string, number][];
    const enumMap = new Map(enumEntries.map(([key, value]) => [value, key]));

    for (const record of dbRecords) {
      const recordId = (record as any).id;
      const recordValue = (record as any)[dbKey];

      if (!enumMap.has(recordId) || enumMap.get(recordId) !== recordValue) {
        console.error(`⚠️ Incohérence détectée : ID ${recordId} => ${recordValue} (DB) ≠ ${enumMap.get(recordId)} (Enum)`);
        isChecked = false;
      }
    }

    if (dbRecords.length !== enumEntries.length) {
      console.error(`⚠️ Incohérence détectée sur ${entityClass.name} : Il y a ${dbRecords.length} éléments en DB, mais l'Enum en contient ${enumEntries.length}.`);
      isChecked = false;
    }

    if (isChecked) {
      console.log(`✅ Tous les éléments de ${entityClass.name} correspondent bien à l'Enum.`);
    } else {
      throw new Error(`❌ Certains éléments de ${entityClass.name} ne correspondent pas à l'Enum.`);
    }

    return isChecked;
  }
}
