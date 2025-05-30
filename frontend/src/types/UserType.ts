import type { Dayjs } from 'dayjs'

export interface UserType {
  id: number;
  lastname: string;
  firstname: string;
  email: string;
  createdAt: Dayjs;
  updatedAt: Dayjs;
}

export interface UserSession {
  id: number;
  lastname: string;
  firstname: string;
  email: string;
}

