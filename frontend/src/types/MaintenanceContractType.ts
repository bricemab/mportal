import type { ContractHourType } from '@/types/ContractHourType.ts'

export interface MaintenanceContractType {
  id: number
  name: string
  client: {
    id: number
    name: string
    firstname: string
    lastname: string
  }
  totalHours: number
  remainingHours: number
  price: number
  path: string
  startAt: string
  endAt: string
  createdAt: string
  updatedAt: string
  contractHours: ContractHourType[]
}

export interface MaintenanceHourType {
  id: number
  contractId: number
  description: string
  hours: number
  date: string
  createdAt: string
}

export interface MaintenanceContractPage extends MaintenanceContractType {
  hours: MaintenanceHourType[]
}
