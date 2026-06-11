<template>
  <n-drawer
    v-model:show="showDrawer"
    :width="isMobile ? '100%' : '800px'"
    :height="isMobile ? '100%' : '100%'"
    :placement="isMobile ? 'bottom' : 'right'"
    @after-leave="handleDrawerClose"
    :z-index="999999999"
    :mask-closable="false"
  >
    <n-drawer-content
      title="欢迎使用 ikun音乐"
      closable
      :native-scrollbar="false"
      class="mac-style-drawer"
    >
      <div class="drawer-container">
        <div class="warning-content">
          <div class="warning-message">
            <h3>获取完整体验</h3>
            <p class="platform-support">
              <span> <i class="ri-window-line mr-1"></i>Windows 10+ </span>
              <span> <i class="ri-apple-line mr-1"></i>macOS </span>
              <span> <i class="ri-ubuntu-line mr-1"></i>Linux </span>
              <span> <i class="ri-android-line mr-1"></i>Android </span>
            </p>
            <p class="description">
              下载桌面应用以获得最佳音乐体验，包含完整功能与更高音质。
              目前无iOS版本，请使用安卓应用或网页版。
            </p>
          </div>

          <div class="action-links">
            <a
              href="https://mp.weixin.qq.com/s/9pr1XQB36gShM_-TG2LBdg"
              target="_blank"
              class="doc-link"
            >
              <i class="ri-file-text-line mr-1"></i> 查看使用文档
            </a>
            <a href="#" target="_blank" class="download-link">
              <i class="ri-download-2-line mr-1"></i> 立即下载
            </a>
          </div>

          <div class="qrcode-section">
            <img class="qrcode" src="@/assets/gzh.png" alt="公众号" />
            <p>关注公众号获取最新版本与更新信息</p>
          </div>

          <div class="support-section">
            <h4>支持项目</h4>
            <p class="support-desc">您的支持是我们持续改进的动力</p>
            <div class="payment-options">
              <div class="payment-option">
                <div class="payment-icon wechat">
                  <img src="@/assets/wechat.png" alt="微信支付" />
                </div>
                <span>微信支付</span>
              </div>
              <div class="payment-option">
                <div class="payment-icon alipay">
                  <img src="@/assets/alipay.png" alt="支付宝" />
                </div>
                <span>支付宝</span>
              </div>
            </div>
          </div>

          <div class="drawer-actions">
            <n-button secondary class="action-button" @click="markAsDonated">已支持</n-button>
            <n-button type="primary" class="action-button primary" @click="remindLater"
              >稍后提醒</n-button
            >
          </div>
        </div>
      </div>
    </n-drawer-content>
  </n-drawer>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { isMobile } from '@/utils';

// 控制抽屉显示状态
const showDrawer = ref(false);

// 处理抽屉关闭后的操作
const handleDrawerClose = () => {
  // 抽屉关闭后的逻辑
};

// 一天后提醒
const remindLater = () => {
  const now = new Date();
  localStorage.setItem('trafficDonated4RemindLater', now.toISOString());
  showDrawer.value = false;
};

// 标记为已捐赠（永久不再提示）
const markAsDonated = () => {
  localStorage.setItem('trafficDonated4Never', '1');
  showDrawer.value = false;
};
// 组件挂载时检查是否需要显示
onMounted(() => {
  // 优先判断是否永久不再提示
  if (localStorage.getItem('trafficDonated4Never')) return;

  // 判断一天后提醒
  const remindLaterTime = localStorage.getItem('trafficDonated4RemindLater');
  if (remindLaterTime) {
    const lastRemind = new Date(remindLaterTime);
    const now = new Date();
    const hoursDiff = (now.getTime() - lastRemind.getTime()) / (1000 * 60 * 60);
    if (hoursDiff < 24) return;
  }

  // 延迟20秒显示
  setTimeout(() => {
    showDrawer.value = true;
  }, 20000);
});
</script>

<style scoped lang="scss">
.traffic-warning-trigger {
  display: inline-block;

  .mac-style-button {
    border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
    border-radius: 10px;
    background: var(--qqm-surface, #ffffff);
    color: var(--qqm-text, #1f2329);
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;

    &:hover {
      border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
      background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
      color: var(--qqm-primary, #22c55e);
    }
  }
}

.mac-style-drawer {
  position: relative;
  overflow: hidden;
  border-left: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  border-radius: 10px 0 0 10px;
  background: var(--qqm-bg, #f7f8fa);
}

.drawer-container {
  display: flex;
  height: 100%;
  flex-direction: column;
  padding: 22px;
}

.warning-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 22px;
}

.app-icon {
  width: 88px;
  height: 88px;
  margin-bottom: 8px;

  img {
    width: 100%;
    height: 100%;
    border-radius: 14px;
    object-fit: contain;
  }
}

.warning-message {
  max-width: 520px;
  text-align: center;

  h3 {
    margin-bottom: 14px;
    color: var(--qqm-text, #1f2329);
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -0.02em;
  }

  .platform-support {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    margin-bottom: 14px;

    span {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
      border-radius: 999px;
      padding: 5px 10px;
      background: var(--qqm-surface, #ffffff);
      color: var(--qqm-muted, #7a828c);
      font-size: 13px;
      font-weight: 500;
    }
  }

  .description {
    margin: 0 auto;
    color: color-mix(in srgb, var(--qqm-text, #1f2329) 72%, transparent);
    font-size: 14px;
    line-height: 1.7;
  }
}

.action-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12px;
  margin: 2px 0;

  a {
    display: inline-flex;
    align-items: center;
    border-radius: 10px;
    padding: 9px 16px;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    transition:
      background-color 0.18s ease,
      border-color 0.18s ease,
      color 0.18s ease;

    &.doc-link {
      border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
      background: var(--qqm-surface, #ffffff);
      color: var(--qqm-text, #1f2329);

      &:hover {
        border-color: color-mix(in srgb, var(--qqm-primary, #22c55e) 24%, var(--qqm-border));
        background: color-mix(in srgb, var(--qqm-primary, #22c55e) 6%, var(--qqm-surface));
        color: var(--qqm-primary, #22c55e);
      }
    }

    &.download-link {
      color: #fff;
      background-color: var(--qqm-primary, #22c55e);

      &:hover {
        background-color: var(--qqm-primary-strong, #16a34a);
      }
    }
  }
}

.qrcode-section {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  text-align: center;

  .qrcode {
    width: 168px;
    height: 168px;
    border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
    border-radius: 12px;
    padding: 10px;
    background: var(--qqm-surface, #ffffff);
    box-shadow: none;
  }

  p {
    margin-top: 10px;
    color: var(--qqm-primary, #22c55e);
    font-size: 13px;
    font-weight: 600;
  }
}

.support-section {
  width: 100%;
  text-align: center;

  h4 {
    margin-bottom: 6px;
    color: var(--qqm-text, #1f2329);
    font-size: 20px;
    font-weight: 650;
  }

  .support-desc {
    margin-bottom: 16px;
    color: var(--qqm-muted, #7a828c);
    font-size: 13px;
  }
}

.payment-options {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 48px;
  padding-bottom: 92px;
}

.payment-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;

  .payment-icon {
    width: 190px;
    height: 190px;
    overflow: hidden;
    border: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
    border-radius: 12px;
    background: var(--qqm-surface, #ffffff);
    box-shadow: none;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  }

  span {
    color: var(--qqm-muted, #7a828c);
    font-size: 13px;
    font-weight: 500;
  }
}

.drawer-actions {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: 999999999;
  display: flex;
  width: 100%;
  justify-content: center;
  gap: 12px;
  border-top: 1px solid var(--qqm-border, rgba(15, 23, 42, 0.08));
  padding: 12px;
  background: color-mix(in srgb, var(--qqm-surface, #ffffff) 92%, transparent);
  backdrop-filter: blur(12px) saturate(1.08);

  .action-button {
    min-width: 104px;
    border-radius: 10px;
    padding: 8px 16px;
    font-size: 14px;
    font-weight: 600;

    &.primary {
      background-color: var(--qqm-primary, #22c55e);
      color: white;

      &:hover {
        background-color: var(--qqm-primary-strong, #16a34a);
      }
    }
  }
}

@media (max-width: 768px) {
  .warning-message {
    h3 {
      font-size: 20px;
    }

    .platform-support {
      gap: 8px;
    }

    .description {
      font-size: 13px;
    }
  }

  .app-icon {
    width: 64px;
    height: 64px;
  }

  .qrcode-section {
    .qrcode {
      width: 140px;
      height: 140px;
    }
  }

  .payment-options {
    gap: 18px;
  }

  .payment-option {
    .payment-icon {
      width: 170px;
      height: 170px;
    }
  }

  .drawer-actions {
    position: fixed;
    flex-wrap: wrap;

    .action-button {
      flex: 1 0 auto;
    }
  }
}
</style>
