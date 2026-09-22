<script setup lang="ts">
import { computed, shallowRef, watch } from 'vue';

import { getImgUrl } from '@/utils';

export interface LibraryCollection {
  id: number | string;
  name: string;
  cover?: string;
  description?: string;
}
const props = defineProps<{
  items: LibraryCollection[];
  removable?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}>();
const emit = defineEmits<{ open: [id: number | string]; remove: [id: number | string] }>();
const query = shallowRef('');
const failed = shallowRef(new Set<string | number>());
const shown = shallowRef(40);
const filtered = computed(() =>
  props.items.filter((item) =>
    `${item.name} ${item.description || ''}`
      .toLocaleLowerCase()
      .includes(query.value.trim().toLocaleLowerCase())
  )
);
watch(query, () => {
  shown.value = 40;
});
function imageFailed(id: number | string) {
  failed.value = new Set([...failed.value, id]);
}
</script>

<template>
  <section class="library-collections">
    <div class="collection-toolbar">
      <span>{{ query ? `找到 ${filtered.length} 张` : `共 ${items.length} 张` }}</span
      ><label
        ><i class="ri-search-line" aria-hidden="true" /><input
          v-model="query"
          aria-label="搜索歌单或专辑"
          placeholder="搜索此列表"
      /></label>
    </div>
    <div class="collection-scroll">
      <div v-if="filtered.length" class="collection-grid">
        <article v-for="item in filtered.slice(0, shown)" :key="item.id" class="collection-card">
          <button
            class="collection-open"
            :aria-label="`打开 ${item.name}`"
            @click="emit('open', item.id)"
          >
            <span class="collection-cover"
              ><img
                v-if="item.cover && !failed.has(item.id)"
                :src="getImgUrl(item.cover, '300y300')"
                alt=""
                loading="lazy"
                @error="imageFailed(item.id)" /><i
                v-else
                class="ri-disc-line"
                aria-hidden="true" /><span class="collection-go"
                ><i class="ri-arrow-right-line" /></span
            ></span>
            <strong>{{ item.name }}</strong
            ><span class="collection-description">{{ item.description }}</span>
          </button>
          <button
            v-if="removable"
            class="collection-remove"
            :aria-label="`移除记录 ${item.name}`"
            @click="emit('remove', item.id)"
          >
            <i class="ri-close-line" />
          </button>
        </article>
      </div>
      <div v-else class="collection-empty">
        <i class="ri-play-list-2-line" aria-hidden="true" />
        <h2>{{ query ? '没有找到相关内容' : emptyTitle || '这里还没有记录' }}</h2>
        <p>{{ query ? '换一个关键词试试。' : emptyDescription || '听过的音乐，会在这里留下。' }}</p>
        <slot name="empty-action" />
      </div>
      <button v-if="shown < filtered.length" class="collection-more" @click="shown += 40">
        继续查看
      </button>
    </div>
  </section>
</template>

<style scoped>
.library-collections {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.collection-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  padding: 22px 0;
  color: var(--qqm-muted);
  font-size: 12px;
}
.collection-toolbar label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: var(--qqm-surface-muted);
  border-radius: 20px;
}
.collection-toolbar input {
  width: 150px;
  background: transparent;
  border: 0;
  outline: none;
  color: var(--qqm-text);
}
.collection-toolbar label:focus-within {
  box-shadow: 0 0 0 1px var(--qqm-primary);
}
.collection-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  scrollbar-width: thin;
  padding-bottom: 25px;
}
.collection-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(156px, 1fr));
  gap: 28px 24px;
}
.collection-card {
  position: relative;
  min-width: 0;
}
.collection-open {
  width: 100%;
  text-align: left;
}
.collection-cover {
  display: grid;
  place-items: center;
  position: relative;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 10px;
  overflow: hidden;
  background: var(--qqm-surface-muted);
  color: var(--qqm-muted);
}
.collection-cover > img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 220ms ease;
}
.collection-cover > i {
  font-size: 44px;
  opacity: 0.5;
}
.collection-go {
  display: grid;
  place-items: center;
  position: absolute;
  right: 12px;
  bottom: 12px;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--qqm-surface);
  color: var(--qqm-text);
  opacity: 0;
  transform: translateY(5px);
  transition:
    opacity 150ms,
    transform 150ms;
}
.collection-open:hover .collection-go,
.collection-open:focus-visible .collection-go {
  opacity: 1;
  transform: none;
}
.collection-open:hover img {
  transform: scale(1.025);
}
.collection-open strong {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 14px;
  line-height: 1.6;
  font-weight: 500;
  margin-top: 12px;
}
.collection-open:hover strong {
  color: var(--qqm-primary-strong);
}
.collection-description {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--qqm-muted);
  margin-top: 5px;
}
.collection-remove {
  position: absolute;
  right: 8px;
  top: 8px;
  background: rgba(0, 0, 0, 0.45);
  color: white;
  width: 27px;
  height: 27px;
  border-radius: 50%;
  opacity: 0;
}
.collection-card:hover .collection-remove,
.collection-card:focus-within .collection-remove {
  opacity: 1;
}
.collection-empty {
  min-height: 280px;
  display: flex;
  align-items: center;
  flex-direction: column;
  justify-content: center;
  gap: 12px;
  text-align: center;
  padding: 25px;
}
.collection-empty > i {
  font-size: 44px;
  color: color-mix(in srgb, var(--qqm-primary-strong) 45%, var(--qqm-border));
}
.collection-empty h2 {
  font-size: 17px;
  font-weight: 500;
  margin: 7px 0 0;
}
.collection-empty p {
  color: var(--qqm-muted);
  font-size: 12px;
  max-width: 420px;
  line-height: 1.8;
  margin: 0;
}
.collection-more {
  margin: 22px auto 0;
  display: block;
  color: var(--qqm-muted);
  font-size: 12px;
}
@media (max-width: 650px) {
  .collection-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 22px 16px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .collection-cover > img,
  .collection-go {
    transition: none;
  }
}
</style>
