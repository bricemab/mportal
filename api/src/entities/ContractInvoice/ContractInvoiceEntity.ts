import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { InvoiceEntity } from "../Invoice/InvoiceEntity";
import { MaintenanceContractEntity } from "../MaintenanceContract/MaintenanceContractEntity";

@Entity("contract_invoice")
export class ContractInvoiceEntity extends AbstractEntity {
  // Relations
  @ManyToOne(() => MaintenanceContractEntity, {
    nullable: false,
    cascade: true,
  })
  @JoinColumn({ name: "contract_id" })
  contract: MaintenanceContractEntity;

  @ManyToOne(() => InvoiceEntity, { nullable: false })
  @JoinColumn({ name: "invoice_id" })
  invoice: InvoiceEntity;
}
