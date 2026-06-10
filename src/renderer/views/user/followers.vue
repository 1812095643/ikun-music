<template>
  <div
    class="user-followers-page h-full w-full bg-white dark:bg-neutral-900 transition-colors duration-200"
  >
    <n-scrollbar class="h-full">
      <div class="w-full pb-32">
        <!-- Loading State -->
        <div v-if="followerListLoading && followerList.length === 0">
          <div class="page-padding-x pt-8">
            <div class="h-8 w-48 mb-6 skeleton-shimmer rounded-lg" />
            <div
              class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            >
              <div v-for="i in 12" :key="i" class="flex flex-col items-center space-y-3">
                <div class="h-20 w-20 skeleton-shimmer rounded-lg" />
                <div class="h-4 w-16 skeleton-shimmer rounded-lg" />
                <div class="h-3 w-24 skeleton-shimmer rounded-lg" />
              </div>
            </div>
          </div>
        </div>

        <!-- Main Content -->
        <template v-else>
          <!-- Header Section -->
          <section class="page-padding-x pt-6 md:pt-8 pb-4">
            <h1
              ref="titleElRef"
              class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight"
            >
              <template v-if="targetUserName">
                {{ targetUserName + t('user.follower.userFollowersTitle') }}
              </template>
              <template v-else>
                {{ t('user.follower.myFollowersTitle') }}
              </template>
            </h1>
          </section>

          <!-- Empty State -->
          <div v-if="followerList.length === 0" class="qqm-follow-empty">
            <i class="ri-user-heart-line text-5xl mb-4 opacity-50" />
            <p>{{ t('user.follower.noFollowers') }}</p>
          </div>

          <!-- User Grid -->
          <section v-else class="page-padding-x">
            <div
              class="follow-grid grid grid-cols-2 gap-3 gap-y-5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
            >
              <div
                v-for="item in followerList"
                :key="item.userId"
                class="user-card group cursor-pointer"
                @click="viewUserDetail(item.userId, item.nickname)"
              >
                <!-- Avatar -->
                <div class="follow-avatar-wrap relative mx-auto w-fit">
                  <div class="follow-avatar h-20 w-20 overflow-hidden rounded-lg md:h-24 md:w-24">
                    <img
                      :src="getImgUrl(item.avatarUrl, '100y100')"
                      :alt="item.nickname"
                      class="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <!-- Artist Badge -->
                  <div
                    v-if="isArtist(item)"
                    class="artist-badge absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-md"
                  >
                    <i class="ri-verified-badge-fill text-primary text-sm" />
                  </div>
                </div>

                <!-- Info -->
                <div class="follow-info mt-3 text-center">
                  <h3
                    class="truncate px-1 text-sm font-medium text-neutral-800 transition-colors group-hover:text-primary dark:text-neutral-100"
                  >
                    {{ item.nickname }}
                  </h3>
                  <p class="mt-1 line-clamp-1 px-1 text-xs text-neutral-400 dark:text-neutral-500">
                    {{ item.signature || t('user.follow.noSignature') }}
                  </p>
                </div>
              </div>
            </div>

            <!-- Loading More -->
            <div v-if="followerListLoading" class="flex items-center justify-center gap-2 py-8">
              <div
                class="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin"
              />
              <span class="text-sm text-neutral-400 dark:text-neutral-500">
                {{ t('common.loading') }}
              </span>
            </div>

            <!-- Load More Button -->
            <div v-else-if="hasMoreFollowers" class="flex justify-center py-8">
              <button
                class="follow-load-more rounded-lg px-6 py-2.5 text-sm font-medium transition-colors duration-200"
                @click="loadMoreFollowers"
              >
                {{ t('user.follower.loadMore') }}
              </button>
            </div>

            <!-- No More -->
            <div
              v-else-if="followerList.length > 0"
              class="text-center text-sm text-neutral-400 dark:text-neutral-500 py-8"
            >
              — {{ t('common.noMore') || '没有更多了' }} —
            </div>
          </section>
        </template>
      </div>
    </n-scrollbar>

    <play-bottom />
  </div>
</template>

<script lang="ts" setup>
import { useMessage } from 'naive-ui';
import { computed, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';

import { getUserFollowers } from '@/api/user';
import PlayBottom from '@/components/common/PlayBottom.vue';
import { useScrollTitle } from '@/hooks/useScrollTitle';
import { useUserStore } from '@/store/modules/user';
import type { IUserFollow } from '@/types/user';
import { getImgUrl } from '@/utils';
import { checkLoginStatus as checkAuthStatus } from '@/utils/auth';

defineOptions({
  name: 'UserFollowers'
});

const { t } = useI18n();
const userStore = useUserStore();
const router = useRouter();
const message = useMessage();
const route = useRoute();

// 粉丝列表相关
const followerList = ref<IUserFollow[]>([]);
const followerOffset = ref(0);
const followerLimit = ref(30);
const hasMoreFollowers = ref(false);
const followerListLoading = ref(false);
const targetUserId = ref<number | null>(null);
const targetUserName = ref<string>('');

const user = computed(() => userStore.user);

const titleElRef = ref<HTMLElement | null>(null);
const followersTitle = computed(() =>
  targetUserName.value
    ? targetUserName.value + t('user.follower.userFollowersTitle')
    : t('user.follower.myFollowersTitle')
);
useScrollTitle(followersTitle, titleElRef);

const checkTargetUser = () => {
  const uid = route.query.uid;
  const name = route.query.name;

  if (uid && typeof uid === 'string') {
    targetUserId.value = parseInt(uid);
    targetUserName.value = typeof name === 'string' ? name : '';
    return true;
  }

  return checkLoginStatus();
};

const checkLoginStatus = () => {
  const loginInfo = checkAuthStatus();
  if (!loginInfo.isLoggedIn) {
    router.push('/login');
    return false;
  }
  if (!userStore.user && loginInfo.user) {
    userStore.setUser(loginInfo.user);
  }
  return true;
};

// 加载粉丝列表
const loadFollowerList = async () => {
  const userId = targetUserId.value || user.value?.userId;
  if (!userId) return;

  try {
    followerListLoading.value = true;
    const { data } = await getUserFollowers(userId, followerLimit.value, followerOffset.value);

    if (!data?.followeds) {
      hasMoreFollowers.value = false;
      return;
    }

    const newFollowers = data.followeds as IUserFollow[];
    followerList.value = [...followerList.value, ...newFollowers];
    hasMoreFollowers.value = newFollowers.length >= followerLimit.value;
  } catch (error) {
    console.error('加载粉丝列表失败:', error);
    message.error(t('common.loadFailed'));
  } finally {
    followerListLoading.value = false;
  }
};

const loadMoreFollowers = async () => {
  followerOffset.value += followerLimit.value;
  await loadFollowerList();
};

const viewUserDetail = (userId: number, nickname: string) => {
  router.push({
    path: `/user/detail/${userId}`,
    query: { name: nickname }
  });
};

const isArtist = (user: IUserFollow) => {
  return user.userType === 4 || user.userType === 2 || user.accountType === 2;
};

onMounted(() => {
  if (checkTargetUser()) {
    loadFollowerList();
  }
});

watch(
  () => route.query,
  (newQuery) => {
    if (newQuery.uid && newQuery.uid !== targetUserId.value?.toString()) {
      followerList.value = [];
      followerOffset.value = 0;
      checkTargetUser();
      loadFollowerList();
    }
  }
);
</script>

<style lang="scss" scoped>
.user-card {
  border: 1px solid transparent;
  border-radius: 12px;
  padding: 12px 8px 14px;
  animation: fadeInSoft 0.22s ease-out backwards;
  transition:
    background-color 0.18s ease,
    border-color 0.18s ease;
}

.user-card:hover {
  border-color: color-mix(in srgb, var(--qqm-primary) 14%, transparent);
  background: color-mix(in srgb, var(--qqm-primary-soft) 22%, transparent);
}

.follow-avatar {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2);
  transition: border-color 0.18s ease;
}

.user-card:hover .follow-avatar {
  border-color: color-mix(in srgb, var(--qqm-primary) 24%, var(--qqm-border));
}

.artist-badge {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface);
}

.follow-load-more {
  border: 1px solid var(--qqm-border);
  background: var(--qqm-surface-2);
  color: var(--qqm-text);
}

.follow-load-more:hover {
  border-color: color-mix(in srgb, var(--qqm-primary) 20%, var(--qqm-border));
  background: color-mix(in srgb, var(--qqm-primary-soft) 28%, var(--qqm-surface-2));
  color: var(--qqm-primary);
}

.qqm-follow-empty {
  display: flex;
  min-height: 260px;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--qqm-text-muted);
  font-size: 13px;
}

.qqm-follow-empty i {
  display: grid;
  width: 46px;
  height: 46px;
  place-items: center;
  border: 1px solid var(--qqm-border);
  border-radius: 50%;
  background: color-mix(in srgb, var(--qqm-primary-soft) 34%, transparent);
  color: var(--qqm-primary);
  font-size: 23px;
  opacity: 1;
}

@keyframes fadeInSoft {
  from {
    opacity: 0;
    transform: translateY(3px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

button:focus-visible {
  outline: none;
  box-shadow: none;
  outline: 1px solid color-mix(in srgb, var(--qqm-primary, #22c55e) 32%, transparent);
  outline-offset: 2px;
}
</style>
