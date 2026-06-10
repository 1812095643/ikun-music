<template>
  <div>
    <!-- menu -->
    <div class="app-menu" :class="{ 'app-menu-expanded': settingsStore.setData.isMenuExpanded }">
      <div class="app-menu-header">
        <div class="app-menu-logo" @click="toggleMenu">
          <img :src="icon" class="w-9 h-9" alt="logo" />
        </div>
      </div>
      <div class="app-menu-list">
        <div v-for="(item, index) in menus" :key="item.path" class="app-menu-item">
          <n-tooltip
            :delay="200"
            :disabled="settingsStore.setData.isMenuExpanded || isMobile"
            placement="bottom"
          >
            <template #trigger>
              <router-link
                class="app-menu-item-link"
                :to="item.path"
                :aria-label="t(item.meta.title)"
              >
                <span
                  class="app-menu-item-icon"
                  :class="{ 'app-menu-item-icon--active': isChecked(index) }"
                  v-html="getMenuIcon(item.path)"
                />
                <span
                  v-if="settingsStore.setData.isMenuExpanded"
                  class="app-menu-item-text ml-3"
                  :class="isChecked(index) ? 'text-green-500' : ''"
                  >{{ t(item.meta.title) }}</span
                >
              </router-link>
            </template>
            <div v-if="!settingsStore.setData.isMenuExpanded">{{ t(item.meta.title) }}</div>
          </n-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute } from 'vue-router';

import icon from '@/assets/icon.png';
import { useSettingsStore } from '@/store';
import { isMobile } from '@/utils';

const props = defineProps({
  size: {
    type: String,
    default: '26px'
  },
  color: {
    type: String,
    default: '#aaa'
  },
  selectColor: {
    type: String,
    default: '#22c55e'
  },
  menus: {
    type: Array as any,
    default: () => []
  }
});

const route = useRoute();
const path = ref(route.path);
const settingsStore = useSettingsStore();
watch(
  () => route.path,
  async (newParams) => {
    path.value = newParams;
  }
);

const { t } = useI18n();

const isChecked = (index: number) => {
  return path.value === props.menus[index].path;
};

const menuIcons: Record<string, string> = {
  '/': '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10.8 12 4l8 6.8v7.7a1.5 1.5 0 0 1-1.5 1.5h-4.2v-5.7H9.7V20H5.5A1.5 1.5 0 0 1 4 18.5v-7.7Z"/></svg>',
  '/search':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m18.5 18.5-4-4m2-4.6a6.6 6.6 0 1 1-13.2 0 6.6 6.6 0 0 1 13.2 0Z"/></svg>',
  '/list':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5h12M6 10.5h12M6 15.5h7.5M17 15v4l3-1.9V13l-3 2Z"/></svg>',
  '/album':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm0 4.8a2.7 2.7 0 1 1 0 5.4 2.7 2.7 0 0 1 0-5.4Z"/></svg>',
  '/toplist':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 18V9.5m7 8.5V5.5m7 12.5v-6.5"/></svg>',
  '/mv':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7.5h10.5A2.5 2.5 0 0 1 18 10v4a2.5 2.5 0 0 1-2.5 2.5H5V7.5Zm13 3 3-2v7l-3-2"/></svg>',
  '/podcast':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5a3 3 0 0 0 3-3V8a3 3 0 0 0-6 0v3.5a3 3 0 0 0 3 3Zm-6-3a6 6 0 0 0 12 0M12 17.5V21"/></svg>',
  '/history':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v6l4 2M4.8 8.2A8 8 0 1 1 4 12"/></svg>',
  '/local-music':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5h6l1.7 2H19.5v8a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5v-10Z"/></svg>',
  '/user':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 7a7 7 0 0 1 14 0"/></svg>',
  '/set':
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Zm7.2-3.2a7 7 0 0 0-.1-1.1l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-1.9-1.1L14.5 3h-5l-.4 2.9A7.6 7.6 0 0 0 7.2 7l-2.4-1-2 3.4 2 1.5a7 7 0 0 0 0 2.2l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 1.9 1.1l.4 2.9h5l.4-2.9a7.6 7.6 0 0 0 1.9-1.1l2.4 1 2-3.4-2-1.5c.1-.4.1-.7.1-1.1Z"/></svg>'
};

const getMenuIcon = (menuPath: string) => {
  return menuIcons[menuPath] || menuIcons['/'];
};

const toggleMenu = () => {
  settingsStore.setSetData({
    isMenuExpanded: !settingsStore.setData.isMenuExpanded
  });
};
</script>

<style lang="scss" scoped>
.app-menu {
  width: 56px;
  height: 100%;
  padding: 8px 6px 14px;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: width 0.22s ease;
}

.app-menu-header {
  width: 100%;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 8px;
}

.app-menu-logo {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.app-menu-logo img {
  width: 24px;
  height: 24px;
  border-radius: 6px;
}

.app-menu-list {
  width: 100%;
  max-height: calc(100vh - 70px);
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: none;
}

.app-menu-list::-webkit-scrollbar {
  display: none;
}

.app-menu-expanded {
  width: 154px;
}

.app-menu-item {
  width: 100%;
  margin: 2px 0;
}

.app-menu-item-link {
  position: relative;
  width: 100%;
  height: 38px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  color: #8b929c;
  transition:
    background-color 0.24s cubic-bezier(0.2, 0.9, 0.2, 1),
    color 0.24s cubic-bezier(0.2, 0.9, 0.2, 1),
    transform 0.24s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.app-menu-expanded .app-menu-item-link {
  justify-content: flex-start;
  padding: 0 14px;
}

.app-menu-item-link:hover {
  background: rgba(24, 28, 34, 0.04);
  color: #1f242b;
}

.app-menu-item-link.router-link-active {
  background: rgba(30, 207, 115, 0.1);
  color: #13c76b;
}

.app-menu-item-link.router-link-active::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 50%;
  width: 3px;
  height: 17px;
  border-radius: 999px;
  background: #22c55e;
  box-shadow: none;
  transform: translateY(-50%) scaleY(1);
  transform-origin: center;
  animation: activeIndicatorSpring 420ms cubic-bezier(0.16, 1.25, 0.32, 1) both;
}

@keyframes activeIndicatorSpring {
  0% {
    opacity: 0;
    transform: translateY(-50%) translateX(-5px) scaleY(0.35);
  }
  58% {
    opacity: 1;
    transform: translateY(-50%) translateX(1px) scaleY(1.14);
  }
  78% {
    transform: translateY(-50%) translateX(0) scaleY(0.94);
  }
  100% {
    opacity: 1;
    transform: translateY(-50%) translateX(0) scaleY(1);
  }
}

.app-menu-item-icon {
  width: 19px;
  height: 19px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: currentColor;
}

.app-menu-item-icon :deep(svg) {
  width: 19px;
  height: 19px;
  display: block;
}

.app-menu-item-icon :deep(path) {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.app-menu-item-icon--active :deep(path) {
  stroke-width: 1.9;
}

.app-menu-item-text {
  max-width: 90px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
  font-weight: 500;
}

:global(.dark) .app-menu-item-link:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #f4f7f8;
}

.mobile {
  .app-menu {
    max-width: 100%;
    width: 100vw;
    position: relative;
    bottom: 0;
    left: 0;
    z-index: 99999;
    @apply bg-white dark:bg-black border-none border-neutral-200 dark:border-neutral-800;

    &-header {
      display: none;
    }

    &-list {
      @apply flex justify-between px-4;
      max-height: none !important;
      overflow: visible !important;
    }

    &-item-link {
      width: auto !important;
      margin-top: 8px;
      margin-bottom: 8px;
      padding: 0 8px;
    }

    &-expanded {
      @apply w-full;
    }
  }
}
</style>
