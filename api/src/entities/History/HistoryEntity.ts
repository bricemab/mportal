// src/entities/HistoryEntity.ts
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { UserEntity } from "../User/UserEntity";
import {HistoryChangeType} from "./HistoryChangeType";

@Entity('history')
export class HistoryEntity { // Does not extend AbstractEntity to not be listened by HistorySubscriber
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'table_name', type: 'varchar' })
  tableName: string;

  @Column({ name: 'table_id', type: 'integer' })
  tableId: number;

  @Column({name: 'value', type: 'json', nullable: true })
  value: any;

  @Column({name: 'changes', type: 'json', nullable: true })
  changes: any;

  @Column({ name: 'create_at', type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ name: 'type', type: 'varchar', nullable: false })
  type: HistoryChangeType;


  // Relations
  @ManyToOne(() => UserEntity)
  @JoinColumn({ name: 'user_id' })
  userId: UserEntity

}
