import app from '@/app';
import router from '@/router.ts'
import { createPinia } from 'pinia'
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';

import 'flowbite';
import '@/assets/styles/tailwind.css';
import './assets/styles/main.scss'
import VueDatePicker from '@vuepic/vue-datepicker';
import '@vuepic/vue-datepicker/dist/main.css'


const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.component('VueDatePicker', VueDatePicker);
app.use(pinia)
app.use(router);
app.mount('#app')

app.config.errorHandler = (err, vm, info) => {
  // todo: handle error globally
  console.log(err, vm, info);
}

navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data && event.data.action === "navigate" && event.data.url) {
    window.location.href = event.data.url;
  }
});
