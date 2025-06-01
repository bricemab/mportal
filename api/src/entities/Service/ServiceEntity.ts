import { Entity, Column } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { ServiceType } from "./ServiceType";

@Entity("service")
export class ServiceEntity extends AbstractEntity {
  @Column({ name: "name", type: "varchar", nullable: false })
  name: string;

  @Column({ name: "description", type: "varchar", nullable: false })
  description: string;

  @Column({ name: "type", type: "varchar", nullable: false })
  type: ServiceType;
}
