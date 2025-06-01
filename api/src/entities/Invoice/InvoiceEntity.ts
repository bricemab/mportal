import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { ClientEntity } from "../Client/ClientEntity";
import { InvoiceState } from "./InvoiceState";
import { InvoiceServiceEntity } from "../InvoiceService/InvoiceServiceEntity";
import { InvoiceLogEntity } from "../InvoiceLog/InvoiceLogEntity";

@Entity("invoice")
export class InvoiceEntity extends AbstractEntity {
  @Column({ name: "name", type: "varchar", nullable: false })
  name: string;

  @Column({ name: "number", type: "varchar", nullable: false, unique: true })
  number: string;

  @Column({ name: "state", type: "varchar", nullable: false })
  state: InvoiceState;

  @Column({ name: "archived", type: "tinyint", default: 0 })
  archived: boolean;

  // Relations
  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: "client_id" })
  client: ClientEntity;

  @OneToMany(() => InvoiceServiceEntity, (is) => is.invoice)
  invoiceServices: InvoiceServiceEntity[];

  @OneToMany(() => InvoiceLogEntity, (il) => il.invoice)
  invoiceLogs: InvoiceLogEntity[];
}
