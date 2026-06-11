<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { onBeforeUnmount, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';

import { getUserDetail } from '@/api/login';
import { isElectron } from '@/utils';

defineOptions({
  name: 'CookieLogin'
});

// Emits
interface Emits {
  (e: 'loginSuccess', userProfile: any, loginType: string): void;
  (e: 'loginError', error: string): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n();
const message = useMessage();

const token = ref('');

// Token登录
const loginByToken = async () => {
  if (!token.value.trim()) {
    const errorMsg = t('login.message.tokenRequired');
    message.error(errorMsg);
    emit('loginError', errorMsg);
    return;
  }

  try {
    // 直接设置token到localStorage
    localStorage.setItem('token', token.value.trim());

    // 获取用户信息验证token有效性
    const user = await getUserDetail();
    if (user.data && user.data.profile) {
      const successMsg = t('login.message.tokenLoginSuccess');
      message.success(successMsg);
      emit('loginSuccess', user.data.profile, 'cookie');
    } else {
      // token无效，清除localStorage
      localStorage.removeItem('token');
      const errorMsg = t('login.message.tokenInvalid');
      message.error(errorMsg);
      emit('loginError', errorMsg);
    }
  } catch (error) {
    // token无效，清除localStorage
    localStorage.removeItem('token');
    const errorMsg = t('login.message.tokenInvalid');
    message.error(errorMsg);
    emit('loginError', errorMsg);
    console.error('Token登录失败:', error);
  }
};

// 自动获取Cookie
const autoGetCookie = () => {
  if (!isElectron) {
    message.error('此功能仅在桌面版中可用');
    return;
  }

  message.info(t('login.message.autoGetCookieTip'));
  window.electron.ipcRenderer.send('open-login');
};

// 监听Cookie接收
const handleCookieReceived = async (_event: any, cookieValue: string) => {
  try {
    // 设置Cookie到localStorage
    localStorage.setItem('token', cookieValue);

    // 验证Cookie有效性
    const user = await getUserDetail();
    if (user.data && user.data.profile) {
      const successMsg = t('login.message.autoGetCookieSuccess');
      message.success(successMsg);
      emit('loginSuccess', user.data.profile, 'cookie');
    } else {
      localStorage.removeItem('token');
      const errorMsg = t('login.message.autoGetCookieFailed');
      message.error(errorMsg);
      emit('loginError', errorMsg);
    }
  } catch (error) {
    localStorage.removeItem('token');
    const errorMsg = t('login.message.autoGetCookieFailed');
    message.error(errorMsg);
    emit('loginError', errorMsg);
    console.error('自动获取Cookie失败:', error);
  }
};

// 在组件挂载时添加监听器
onMounted(() => {
  if (isElectron) {
    window.electron.ipcRenderer.on('send-cookies', handleCookieReceived);
  }
});

// 在组件卸载时移除监听器
onBeforeUnmount(() => {
  if (isElectron) {
    window.electron.ipcRenderer.removeAllListeners('send-cookies');
  }
});
</script>

<template>
  <div class="cookie-login">
    <div class="login-title">{{ t('login.title.cookie') }}</div>
    <div class="phone-page">
      <textarea
        v-model="token"
        class="token-input"
        :placeholder="t('login.placeholder.cookie')"
        rows="4"
      />
    </div>
    <div class="text">{{ t('login.tokenTip') }}</div>
    <n-button class="btn-login" @click="loginByToken()">{{
      t('login.button.cookieLogin')
    }}</n-button>
    <n-button v-if="isElectron" class="btn-auto-cookie" @click="autoGetCookie()">
      {{ t('login.button.autoGetCookie') }}
    </n-button>
  </div>
</template>

<style lang="scss" scoped>
.cookie-login {
  animation-duration: 0.2s;
  @apply flex flex-col items-center;
}

.login-title {
  @apply mb-5 text-2xl font-bold;
  color: var(--qqm-text, #111827);
}

.text {
  @apply mt-4 text-xs;
  color: var(--qqm-muted, #737373);
}

.phone-page {
  border: 1px solid var(--qqm-border);
  background: color-mix(in srgb, var(--qqm-surface) 95%, transparent);
  width: 250px;
  @apply rounded-lg overflow-hidden;
  padding: 0;
  border: none;
}

.token-input {
  @apply w-full outline-none resize-none;
  @apply text-neutral-900 dark:text-neutral-100 bg-transparent;
  @apply placeholder-neutral-400 dark:placeholder-neutral-500;
  font-family: monospace;
  font-size: 12px;
  line-height: 1.4;
  min-height: 100px;
  padding: 16px;
  margin: 0;
  border: none;
  border-radius: inherit;
  box-sizing: border-box;

  &:focus {
    @apply outline-none;
    box-shadow: none;
    border: none;
  }

  &::placeholder {
    @apply text-neutral-400 dark:text-neutral-500;
  }

  /* 移除浏览器默认样式 */
  &::-webkit-scrollbar {
    width: 4px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: rgba(156, 163, 175, 0.3);
    border-radius: 2px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: rgba(156, 163, 175, 0.5);
  }
}

.btn-login {
  width: 250px;
  height: 40px;
  @apply mt-10 text-white rounded-lg;
  @apply transition-colors duration-200;
  background-color: var(--qqm-primary, #22c55e);
}

.btn-auto-cookie {
  width: 250px;
  height: 40px;
  @apply mt-4 rounded-lg;
  @apply transition-colors duration-200;
  border: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 22%, transparent);
  background: color-mix(in srgb, #ffffff 94%, var(--qqm-primary, #22c55e) 6%);
  color: color-mix(in srgb, var(--qqm-primary, #22c55e) 72%, #262626 28%);
}

.btn-auto-cookie:hover {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 34%, transparent);
  background: color-mix(in srgb, #ffffff 88%, var(--qqm-primary, #22c55e) 12%);
  color: var(--qqm-primary, #22c55e);
}

.dark .btn-auto-cookie {
  border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, transparent);
  background: color-mix(in srgb, #050505 86%, var(--qqm-primary, #22c55e) 14%);
  color: color-mix(in srgb, var(--qqm-primary, #22c55e) 82%, #f5f5f5 18%);
}
</style>
