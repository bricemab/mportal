import { Entity, Column, OneToOne, JoinColumn } from "typeorm";
import AbstractEntity from "../AbstractEntity";

@Entity('service')
export class ServiceEntity extends AbstractEntity {
  @Column({ name: 'name', type: 'varchar', nullable: false })
  name: string;
}
