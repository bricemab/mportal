import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { InvoiceEntity } from "../Invoice/InvoiceEntity";
import { ClientEntity } from "../Client/ClientEntity";
import { InvoiceState } from "../Invoice/InvoiceState";
import { MaintenanceContractEntity } from "../MaintenanceContract/MaintenanceContractEntity";

@Entity("contract_hour")
export class ContractHourEntity extends AbstractEntity {
  @Column({ name: "description", type: "varchar", nullable: false })
  description: string;

  @Column({ name: "hours", type: "double", nullable: false })
  hours: number;

  @Column({ name: "date", type: "datetime", nullable: false })
  date: string;

  // Relations
  @ManyToOne(() => MaintenanceContractEntity)
  @JoinColumn({ name: "contract_id" })
  contract: MaintenanceContractEntity;
}
