import { Entity, ManyToOne, JoinColumn, Column } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { ClientEntity } from "../Client/ClientEntity";
import { ServiceEntity } from "../Service/ServiceEntity";
import { InvoiceEntity } from "../Invoice/InvoiceEntity";

@Entity("invoice_service")
export class InvoiceServiceEntity extends AbstractEntity {
  @Column({ name: "quantity", type: "integer", nullable: false })
  quantity: number;

  @Column({ name: "amount", type: "integer", nullable: false })
  amount: number;

  @Column({ name: "archived", type: "tinyint", default: 0 })
  archived: boolean;

  // Relations
  @ManyToOne(() => InvoiceEntity)
  @JoinColumn({ name: "invoice_id" })
  invoice: InvoiceEntity;

  @ManyToOne(() => ServiceEntity)
  @JoinColumn({ name: "service_id" })
  service: ServiceEntity;
}
