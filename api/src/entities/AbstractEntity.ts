import dayjs from "dayjs";
import {
  BaseEntity,
  Column,
  getMetadataArgsStorage,
  PrimaryGeneratedColumn,
  Repository,
} from "typeorm";
import GlobalStore from "../utils/GlobalStore";

export default abstract class AbstractEntity extends BaseEntity {
  @PrimaryGeneratedColumn({ type: "integer" })
  public id: number;

  @Column({
    name: "created_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  public createdAt: string;

  @Column({
    name: "updated_at",
    type: "datetime",
    default: () => "CURRENT_TIMESTAMP",
  })
  public updatedAt: string;

  public async save(): Promise<this> {
    console.log("saving: " + this.constructor.name);
    this.updatedAt = dayjs().format("YYYY-MM-DD HH:mm:ss");
    return await super.save();
  }

  private static __excludedProps: string[] = [];

  // Méthode pour ajouter des propriétés à la liste des exclusions pour une entité spécifique
  public static addExcludedPropsForEntity(
    entity: typeof AbstractEntity,
    props: string[],
  ): void {
    // Ajout des propriétés au tableau statique __excludedProps
    (entity as typeof AbstractEntity).__excludedProps.push(...props);
  }

  /**
   * Récupère récursivement toutes les relations d'une entité
   * @param entity - L'entité cible
   * @param prefix - Chaîne de préfixe utilisée pour construire les relations imbriquées
   * @param depth - Profondeur actuelle de la récursion
   * @param maxDepth - Profondeur maximale de la récursion
   * @returns Liste des relations à charger
   */
  getRelationsRecursive(
    entity: any,
    prefix = "",
    depth = 0,
    maxDepth = 2,
  ): string[] {
    if (depth >= maxDepth) {
      return [];
    }

    const relations = getMetadataArgsStorage()
      .relations.filter((rel) => rel.target === entity)
      .map((rel) => ({
        propertyName: rel.propertyName,
        type: rel.type,
      }));

    let result: string[] = [];

    for (const rel of relations) {
      const relationPath = prefix
        ? `${prefix}.${rel.propertyName}`
        : rel.propertyName;
      result.push(relationPath);
      // Incrémenter la profondeur lors de la récursion
      result = result.concat(
        this.getRelationsRecursive(rel.type, relationPath, depth + 1, maxDepth),
      );
    }

    return result;
  }

  /**
   * Charge une entité avec toutes ses relations récursivement
   * @param repository - Repository TypeORM
   * @param entity - L'entité cible
   * @param id - ID de l'entité à charger
   * @returns L'entité avec toutes ses relations chargées
   */
  async findWithRelationsRecursive(
    repository: Repository<any>,
    entity: any,
    id: any,
  ): Promise<any> {
    const relations = this.getRelationsRecursive(entity);

    return repository.findOne({
      where: { id },
      relations,
    });
  }

  public toJSON(): Record<string, any> {
    const repo = GlobalStore.getORM().getRepository(this.constructor);
    const metadata = repo.metadata;
    const plainObject: Record<string, any> = {};

    const excludedProps =
      (this.constructor as typeof AbstractEntity).__excludedProps || [];

    for (const column of metadata.columns) {
      if (
        !column.relationMetadata &&
        !excludedProps.includes(column.propertyName)
      ) {
        plainObject[column.propertyName] = (this as any)[column.propertyName];
      }
    }
    for (const relation of metadata.relations.filter(
      (r) => r.relationType === "many-to-one",
    )) {
      if ((this as any)[relation.propertyName]) {
        plainObject[`${relation.propertyName}Id`] = (this as any)[
          relation.propertyName
        ].id;
      } else {
        plainObject[`${relation.propertyName}Id`] = null;
      }
    }

    return plainObject;
  }

  /**
   * true = changes are saved in history table
   *
   * NOTE: Access this property through keepHistory and setKeepHistory methods
   */
  protected _keepHistory = true;

  /**
   * true = changes are saved in history table
   */
  public keepHistory(): boolean {
    return this._keepHistory;
  }

  /**
   * true = changes are saved in history table
   */
  public setKeepHistory(keepHistory: boolean): void {
    this._keepHistory = keepHistory;
  }

  public async remove(): Promise<this> {
    const repository = GlobalStore.getORM().getRepository(this.constructor);
    const archivedColumn = repository.metadata.columns.find(
      (column) => column.propertyName === "archived",
    );

    if (archivedColumn) {
      (this as any)["archived"] = true;
      return await repository.save(this);
    } else {
      return await super.remove();
    }
  }
}
