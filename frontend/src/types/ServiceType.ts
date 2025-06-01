export enum ServiceType {
  YEARLY = "YEARLY",
  MONTHLY = "MONTHLY",
  UNIQUE = "UNIQUE",
}

export interface Service {
  name: string;
  description: string;
  serviceType: ServiceType;
}

