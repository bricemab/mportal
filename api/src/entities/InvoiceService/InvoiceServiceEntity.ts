import { Entity, ManyToOne, JoinColumn, Column } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { ClientEntity } from "../Client/ClientEntity";
import { ServiceEntity } from "../Service/ServiceEntity";

@Entity("invoice_service")
export class InvoiceServiceEntity extends AbstractEntity {
  @Column({ name: "quantity", type: "integer", nullable: false })
  quantity: number;

  @Column({ name: "amount", type: "integer", nullable: false })
  amount: number;

  // Relations
  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: "invoice_id" })
  invoice: ClientEntity;

  @ManyToOne(() => ServiceEntity)
  @JoinColumn({ name: "service_id" })
  service: ServiceEntity;
}
