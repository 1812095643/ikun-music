import { type MaybeRefOrGetter, readonly, shallowRef, toValue, watch } from 'vue';

/** 加载播放器封面；返回已确认可显示的地址和状态，切歌及卸载时清理旧任务。 */
export const usePlayerArtwork = (source: MaybeRefOrGetter<string>) => {
  const loadedUrl = shallowRef('');
  const status = shallowRef<'empty' | 'loading' | 'ready' | 'error'>('empty');
  const retryVersion = shallowRef(0);
  watch(
    [() => toValue(source), retryVersion],
    ([url], _previous, onCleanup) => {
      loadedUrl.value = '';
      status.value = url ? 'loading' : 'empty';
      if (!url) return;
      const image = new Image();
      let active = true;
      const finish = (success: boolean) => {
        if (!active) return;
        active = false;
        clearTimeout(timeout);
        image.onload = image.onerror = null;
        loadedUrl.value = success ? url : '';
        status.value = success ? 'ready' : 'error';
      };
      // 根因：CSS background-image 没有错误事件，坏链会留下空白或旧海报。
      // 确认图片加载成功后才展示，超过八秒回到稳定背景；旧歌曲的晚到结果不能回写。
      const timeout = setTimeout(() => finish(false), 8000);
      image.onload = () => finish(true);
      image.onerror = () => finish(false);
      image.src = url;
      onCleanup(() => {
        active = false;
        clearTimeout(timeout);
        image.onload = image.onerror = null;
      });
    },
    { immediate: true }
  );
  return {
    loadedUrl: readonly(loadedUrl),
    status: readonly(status),
    retry: () => retryVersion.value++
  };
};
