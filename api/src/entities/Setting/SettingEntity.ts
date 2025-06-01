import { Entity, Column, OneToMany } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { InvoiceLogEntity } from "../InvoiceLog/InvoiceLogEntity";
import { InvoiceEntity } from "../Invoice/InvoiceEntity";
import { SettingKey } from "./SettingType";

@Entity("setting")
export class SettingEntity extends AbstractEntity {
  @Column({ name: "key", type: "varchar", nullable: false })
  key: SettingKey;

  @Column({ name: "value", type: "varchar", nullable: false })
  value: string;
}
