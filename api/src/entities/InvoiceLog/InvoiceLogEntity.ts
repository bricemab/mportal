import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { InvoiceLogCode } from "./InvoiceLogCode";
import { InvoiceEntity } from "../Invoice/InvoiceEntity";
import { ClientEntity } from "../Client/ClientEntity";

@Entity("invoice_log")
export class InvoiceLogEntity extends AbstractEntity {
  @Column({ name: "code", type: "varchar", nullable: false })
  code: InvoiceLogCode;

  @Column({ name: "details", type: "varchar", nullable: true })
  details: string;

  // Relations
  @ManyToOne(() => InvoiceEntity)
  @JoinColumn({ name: "invoice_id" })
  invoice: InvoiceEntity;

  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: "client_id" })
  client: ClientEntity;
}
