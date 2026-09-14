import { createApp } from 'vue';

import i18n from '@/../i18n/renderer';
import router from '@/router';
import pinia from '@/store';

import App from './App.vue';
import directives from './directive';

const app = createApp(App);

Object.keys(directives).forEach((key: string) => {
  app.directive(key, directives[key as keyof typeof directives]);
});

app.use(pinia);
app.use(router);
app.use(i18n as any);

const initialRoute = (window as any).__IKUN_INITIAL_ROUTE__;
const mountApp = () => app.mount('#app');

if (typeof initialRoute === 'string' && initialRoute) {
  router.replace(initialRoute).finally(mountApp);
} else {
  mountApp();
}
