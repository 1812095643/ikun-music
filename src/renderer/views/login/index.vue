<template>
  <div class="login-page">
    <div class="phone-login">
      <div class="bg"></div>
      <div class="content">
        <!-- Tab导航 -->
        <div class="login-tabs">
          <div
            v-for="tab in loginTabs"
            :key="tab.key"
            class="tab-item"
            :class="{ active: activeMode === tab.key }"
            @click="switchToMode(tab.key)"
          >
            {{ tab.label }}
          </div>
        </div>

        <!-- 登录内容区域 -->
        <div class="login-content">
          <!-- 过渡动画包装器 -->
          <transition name="login-content" mode="out-in">
            <!-- 二维码登录组件 -->
            <div v-if="activeMode === LoginMode.QR && !isTransitioning" key="qr" class="phone">
              <qr-login @login-success="handleLoginSuccess" @login-error="handleLoginError" />
            </div>

            <!-- 手机号登录 -->
            <div
              v-else-if="activeMode === LoginMode.PHONE && !isTransitioning"
              key="phone"
              class="phone"
            >
              <div class="login-title">{{ t('login.title.phone') }}</div>
              <div class="phone-page">
                <input
                  v-model="phone"
                  class="phone-input"
                  type="text"
                  :placeholder="t('login.placeholder.phone')"
                />
                <input
                  v-model="password"
                  class="phone-input"
                  type="password"
                  :placeholder="t('login.placeholder.password')"
                />
              </div>
              <div class="text">{{ t('login.phoneTip') }}</div>
              <n-button class="btn-login" @click="loginPhone()">{{
                t('login.button.login')
              }}</n-button>
            </div>

            <!-- UID登录组件 -->
            <div
              v-else-if="activeMode === LoginMode.UID && !isTransitioning"
              key="uid"
              class="phone"
            >
              <uid-login @login-success="handleLoginSuccess" @login-error="handleLoginError" />
            </div>

            <!-- Cookie登录组件 -->
            <div
              v-else-if="activeMode === LoginMode.COOKIE && !isTransitioning"
              key="token"
              class="phone"
            >
              <cookie-login @login-success="handleLoginSuccess" @login-error="handleLoginError" />
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { loginByCellphone } from '@/api/login';
import CookieLogin from '@/components/login/CookieLogin.vue';
import QrLogin from '@/components/login/QrLogin.vue';
import UidLogin from '@/components/login/UidLogin.vue';
import { useUserStore } from '@/store/modules/user';

defineOptions({
  name: 'Login'
});

// 登录模式枚举
enum LoginMode {
  QR = 'qr',
  PHONE = 'phone',
  UID = 'uid',
  COOKIE = 'cookie'
}

const { t } = useI18n();
const message = useMessage();
const router = useRouter();
const userStore = useUserStore();

// 当前激活的登录模式
const activeMode = ref<LoginMode>(LoginMode.QR);
// 用于控制内容切换动画
const isTransitioning = ref(false);

// 登录选项配置
const loginTabs = computed(() => [
  { key: LoginMode.QR, label: t('login.title.qr') },
  { key: LoginMode.COOKIE, label: t('login.title.cookie') },
  { key: LoginMode.UID, label: t('login.title.uid') }
]);

// 手机号登录
const phone = ref('');
const password = ref('');
const loginPhone = async () => {
  try {
    if (!phone.value.trim()) {
      message.error(t('login.message.phoneRequired'));
      return;
    }
    if (!password.value.trim()) {
      message.error(t('login.message.passwordRequired'));
      return;
    }

    const { data } = await loginByCellphone(phone.value, password.value);
    if (data.code === 200) {
      message.success(t('login.message.loginSuccess'));
      userStore.setUser(data.profile);
      localStorage.setItem('token', data.cookie);
      setTimeout(() => {
        router.push('/user');
      }, 1000);
    } else {
      message.error(t('login.message.phoneLoginFailed'));
    }
  } catch (error) {
    message.error(t('login.message.phoneLoginFailed'));
    console.error(t('login.message.loginFailed') + ':', error);
  }
};

// 切换登录模式（带动画效果）
const switchToMode = (mode: LoginMode) => {
  if (mode === activeMode.value) return;

  isTransitioning.value = true;
  setTimeout(() => {
    activeMode.value = mode;
    setTimeout(() => {
      isTransitioning.value = false;
    }, 50);
  }, 150);
};

// 通用登录成功处理
const handleLoginSuccess = (userProfile: any, loginType: string) => {
  // 更新 userStore（这会同时更新 store 状态和 localStorage 中的用户数据）
  userStore.setUser(userProfile);

  // 设置登录类型到 userStore 和 localStorage
  userStore.setLoginType(loginType as any);

  // 设置其他相关状态
  const token = loginType !== 'uid' ? localStorage.getItem('token') : undefined;

  if (token) {
    localStorage.setItem('token', token);
  }

  if (loginType === 'uid') {
    localStorage.setItem('uidLogin', 'true');
  }

  setTimeout(() => {
    router.push('/user');
  }, 1000);
};

// 通用登录错误处理
const handleLoginError = (error: string) => {
  console.error(t('login.message.loginFailed') + ':', error);
};
</script>

<style lang="scss" scoped>
.login-page {
  @apply flex flex-col items-center justify-center;
  @apply bg-light dark:bg-black;
  min-height: 100%;
  position: relative;
  overflow: hidden;
}

.login-page::before {
  content: '';
  position: absolute;
  inset: 8% 12% auto auto;
  width: 360px;
  height: 260px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(34, 197, 94, 0.14), transparent 68%);
  pointer-events: none;
}

.login-title {
  @apply mb-5 text-2xl font-bold;
  color: #111827;
}

.text {
  @apply mt-4 text-xs;
  color: #737373;
}

.phone-login {
  position: relative;
  width: min(460px, calc(100vw - 48px));
  height: 550px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--qqm-border) 78%, transparent);
  border-radius: 12px;
  background:
    linear-gradient(135deg, rgba(34, 197, 94, 0.055), transparent 42%),
    color-mix(in srgb, #ffffff 96%, var(--qqm-primary, #22c55e) 4%);
  box-shadow: none;
  animation-duration: 0.35s;

  .bg {
    position: absolute;
    inset: 0;
    background:
      linear-gradient(90deg, transparent 0%, rgba(34, 197, 94, 0.055) 100%),
      radial-gradient(circle at 82% 22%, rgba(34, 197, 94, 0.16), transparent 32%);
    opacity: 1;
  }

  .content {
    @apply absolute flex h-full w-full flex-col items-center text-center;
    padding: 16px 18px 22px;

    .login-tabs {
      @apply mb-8 flex rounded-lg p-1;
      width: min(320px, 100%);
      border: 1px solid color-mix(in srgb, var(--qqm-border) 72%, transparent);
      background: rgba(255, 255, 255, 0.78);
      animation-duration: 0.25s;
      animation-delay: 0.05s;

      .tab-item {
        @apply flex-1 cursor-pointer rounded-lg px-3 py-2 text-center text-sm transition-colors duration-200;
        color: #525252;
        transform: translateY(0);

        &:hover {
          color: var(--qqm-primary, #22c55e);
          background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, transparent);
          transform: translateY(0);
        }

        &.active {
          @apply font-medium;
          background-color: var(--qqm-primary, #22c55e);
          color: #ffffff;
          transform: translateY(0);
          box-shadow: none;
        }
      }
    }

    .login-content {
      @apply flex flex-1 items-center justify-center;
      min-height: 300px;
      width: 100%;
    }

    .phone {
      animation-duration: 0.2s;
      width: 100%;
      max-width: 300px;

      &-page {
        @apply overflow-hidden rounded-lg;
        width: 250px;
        margin: 0 auto;
        border: 1px solid color-mix(in srgb, var(--qqm-border) 78%, transparent);
        background: rgba(255, 255, 255, 0.95);
      }

      &-input {
        height: 40px;
        @apply w-full bg-transparent px-4 outline-none;
        border-bottom: 1px solid var(--qqm-border);
        @apply text-neutral-900 placeholder-neutral-400;
        transition:
          border-color 0.2s ease,
          color 0.2s ease,
          transform 0.2s ease;

        &:focus {
          border-color: var(--qqm-primary, #22c55e);
          transform: translateY(0);
        }
      }
    }

    .btn-login {
      width: 250px;
      height: 40px;
      @apply mt-9 rounded-lg text-white;
      @apply transition-colors duration-200;
      background-color: var(--qqm-primary, #22c55e);
      transform: translateY(0);

      &:hover {
        transform: translateY(0);
        box-shadow: none;
      }
    }
  }
}

.dark {
  .login-title {
    color: #f5f5f5;
  }

  .text {
    color: #a3a3a3;
  }

  .phone-login {
    border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, transparent);
    background:
      linear-gradient(135deg, rgba(34, 197, 94, 0.08), transparent 42%),
      color-mix(in srgb, #050505 92%, var(--qqm-primary, #22c55e) 8%);

    .content {
      .login-tabs {
        border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 16%, transparent);
        background: rgba(18, 18, 18, 0.88);

        .tab-item {
          color: #a3a3a3;
        }
      }

      .phone-page {
        border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 14%, transparent);
        background: rgba(10, 10, 10, 0.95);
      }

      .phone-input {
        @apply border-neutral-800 text-neutral-100 placeholder-neutral-500;
      }
    }
  }
}

/* 登录内容切换保持克制，只用透明度避免页面上下跳动。 */
.login-content-enter-active,
.login-content-leave-active {
  transition: opacity 0.16s ease;
}

.login-content-enter-from,
.login-content-leave-to {
  opacity: 0;
}

.mobile {
  .login-page {
    @apply pt-0;
  }

  .phone-login {
    width: 90vw;
    max-width: 350px;
    height: 500px;
  }
}
</style>
