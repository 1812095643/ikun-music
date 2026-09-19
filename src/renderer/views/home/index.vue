<template>
  <div class="home-container h-full w-full transition-colors duration-200">
    <n-scrollbar class="h-full">
      <div class="home-content w-full pb-32 page-padding">
        <!-- Hero Section -->
        <home-hero />

        <!-- Main Content Sections -->
        <div class="content-sections space-y-10 md:space-y-8 lg:space-y-12">
          <!-- Recommended Playlists (Grid Section) -->
          <home-playlist-section
            v-if="!isAndroidRuntime"
            :title="t('comp.recommendSonglist.title')"
            :limit="18"
          />

          <!-- Hot Artists (Horizontal Scroll Section) -->
          <home-artists
            v-if="!isAndroidRuntime"
            :title="t('comp.recommendSinger.title')"
            :limit="15"
          />

          <!-- New Albums (NEW - 新碟上架) -->
          <home-album-section
            v-if="!isAndroidRuntime"
            :title="t('comp.newAlbum.title')"
            :limit="6"
            :columns="5"
            :rows="1"
            @more="router.push('/album')"
          />

          <!-- New Songs (Compact Grid Section) -->
          <home-new-songs :title="t('comp.recommendNewMusic.title')" :limit="20" />
        </div>
      </div>
    </n-scrollbar>
  </div>
</template>

<script lang="ts" setup>
import { NScrollbar } from 'naive-ui';
import { defineAsyncComponent } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRouter } from 'vue-router';

import { beginHomeStartup } from '@/services/startupReadiness';
import { isAndroidRuntime } from '@/utils';

import HomeHero from './components/HomeHero.vue';
import HomeNewSongs from './components/HomeNewSongs.vue';

const HomeAlbumSection = defineAsyncComponent(() => import('./components/HomeAlbumSection.vue'));
const HomeArtists = defineAsyncComponent(() => import('./components/HomeArtists.vue'));
const HomePlaylistSection = defineAsyncComponent(
  () => import('./components/HomePlaylistSection.vue')
);

defineOptions({
  name: 'Home'
});

beginHomeStartup(isAndroidRuntime);
const { t } = useI18n();
const router = useRouter();
</script>

<style lang="scss" scoped>
.home-container {
  background: var(--qqm-bg, #f7f8fa);
  position: relative;
}
</style>
