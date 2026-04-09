import { createApp } from 'vue';

import App from './App.vue';
import router from './router';
import { setupStore } from './store';

import '@/styles/index.scss';
import SvgIcon from './icons'; // icon
import './permission'; // permission control

const app = createApp(App);
setupStore(app);
app.use(router);
app.component('svg-icon', SvgIcon);

app.mount('#app');
