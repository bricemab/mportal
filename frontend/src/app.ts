import { createApp } from "vue";
import App from "@/App.vue";
import Vue3Toastify, { type ToastContainerOptions } from 'vue3-toastify';
import 'vue3-toastify/dist/index.css';

const application = createApp(App);

application.use(
    Vue3Toastify,
    {
        toastClassName: "my-toast",
        bodyClassName: "my-toast-body",
        autoClose: 3000,
        theme: "light",
    } as ToastContainerOptions,);

export default application;