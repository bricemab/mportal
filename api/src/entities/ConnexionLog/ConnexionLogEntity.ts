import { Entity, Column } from "typeorm";
import AbstractEntity from "../AbstractEntity";
import { ConnexionLogStatus } from "./ConnexionLogStatus";

@Entity("connexion_log")
export class ConnexionLogEntity extends AbstractEntity {
  protected _keepHistory = false;

  @Column({ name: "email", type: "varchar", nullable: false })
  email: string;

  @Column({ name: "ip", type: "varchar", nullable: false })
  ip: string;

  @Column({ name: "user_agent", type: "varchar", nullable: false })
  userAgent: string;

  @Column({ name: "failed_attempts", type: "int", default: 0 })
  failedAttempts: number;

  @Column({ name: "blocked_until", type: "timestamp", nullable: true })
  blockedUntil: Date | null;
}
