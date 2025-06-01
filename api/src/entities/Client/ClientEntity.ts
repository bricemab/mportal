import { Entity, Column, OneToMany } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { InvoiceLogEntity } from "../InvoiceLog/InvoiceLogEntity";
import { InvoiceEntity } from "../Invoice/InvoiceEntity";

@Entity("client")
export class ClientEntity extends AbstractEntity {
  @Column({ name: "name", type: "varchar", nullable: false })
  name: string;

  @Column({ name: "lastname", type: "varchar", nullable: false })
  lastname: string;

  @Column({ name: "firstname", type: "varchar", nullable: false })
  firstname: string;

  @Column({ name: "email", type: "varchar", nullable: true })
  email: string;

  @Column({ name: "phone_umber", type: "varchar", nullable: true })
  phoneNumber: string;

  @Column({ name: "remark", type: "text", nullable: true })
  remark: string;

  @Column({ name: "archived", type: "tinyint", default: 0 })
  archived: boolean;

  // Relations
  @OneToMany(() => InvoiceLogEntity, (il) => il.client)
  invoiceLogs: InvoiceLogEntity[];

  @OneToMany(() => InvoiceEntity, (i) => i.client)
  invoices: InvoiceEntity[];
}
