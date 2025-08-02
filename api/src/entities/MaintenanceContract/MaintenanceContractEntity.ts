import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { ClientEntity } from "../Client/ClientEntity";
import { InvoiceLogEntity } from "../InvoiceLog/InvoiceLogEntity";
import { ContractHourEntity } from "../ContractHour/ContractHourEntity";
import { ContractInvoiceEntity } from "../ContractInvoice/ContractInvoiceEntity";

@Entity("maintenance_contract")
export class MaintenanceContractEntity extends AbstractEntity {
  @Column({ name: "name", type: "varchar", nullable: false })
  name: string;

  @Column({ name: "total_hours", type: "int", nullable: false })
  totalHours: number;

  @Column({ name: "remaining_hours", type: "int", nullable: false })
  remainingHours: number;

  @Column({ name: "price", type: "double", nullable: false })
  price: number;

  @Column({ name: "path", type: "varchar", nullable: true })
  path: string | null;

  @Column({ name: "start_at", type: "datetime", nullable: false })
  startAt: string;

  @Column({ name: "end_at", type: "datetime", nullable: false })
  endAt: string;

  // Relations
  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: "client_id" })
  client: ClientEntity;

  @OneToMany(() => ContractHourEntity, (entity) => entity.contract, {
    cascade: true,
  })
  contractHours: ContractHourEntity[];

  @OneToMany(() => ContractInvoiceEntity, (il) => il.invoice, { cascade: true })
  contractInvoices: ContractInvoiceEntity[];
}
