import { Entity, ManyToOne, JoinColumn } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import {ClientEntity} from "../Client/ClientEntity";
import {ServiceEntity} from "../Service/ServiceEntity";

@Entity('invoice_service')
export class InvoiceServiceEntity extends AbstractEntity {
  // Relations
  @ManyToOne(() => ClientEntity)
  @JoinColumn({ name: 'invoice_id' })
  invoice: ClientEntity;

  @ManyToOne(() => ServiceEntity)
  @JoinColumn({ name: 'service_id' })
  service: ServiceEntity;
}
