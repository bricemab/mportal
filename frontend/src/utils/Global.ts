import axios from "axios";
import config from "@/config/config";
import { useUserStore } from '@/stores/user.ts'


const instanceAxios = axios.create({
  baseURL: config.api.endpoint,
  headers: {
    "x-access-token": config.api.secretKey,
  },
})

instanceAxios.interceptors.request.use((config) => {
  const authStore = useUserStore();
  const token = authStore.getJwt();
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

export default {
  instanceAxios,
};
