export enum ServiceTypeType {
  YEARLY = 'YEARLY',
  MONTHLY = 'MONTHLY',
  UNIQUE = 'UNIQUE',
}

export interface ServiceType {
  id: number
  name: string
  description: string
  type: ServiceTypeType
}
