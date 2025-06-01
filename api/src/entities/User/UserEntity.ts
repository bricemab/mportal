import { Entity, Column } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { ExcludeFromJson } from "../ExcludeFromJson";

@Entity("user")
export class UserEntity extends AbstractEntity {
  @Column({ name: "lastname", type: "varchar", nullable: false })
  lastname: string;

  @Column({ name: "firstname", type: "varchar", nullable: false })
  firstname: string;

  @Column({ name: "email", type: "varchar", nullable: false })
  email: string;

  @Column({ name: "password", type: "varchar", nullable: false })
  @ExcludeFromJson
  password: string;

  @Column({ name: "last_connexion_at", type: "datetime", nullable: true })
  lastConnexionAt: Date;
}
