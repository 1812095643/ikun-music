import { computed, shallowRef } from 'vue';

const expected = shallowRef<string[]>([]);
const completed = shallowRef<string[]>([]);
export const homeDataReady = computed(
  () => expected.value.length > 0 && expected.value.every((key) => completed.value.includes(key))
);
export const beginHomeStartup = (mobile: boolean) => {
  expected.value = mobile ? ['hero', 'songs'] : ['hero', 'songs', 'playlists', 'artists', 'albums'];
  completed.value = [];
};
export const markHomeReady = (key: string) => {
  if (!completed.value.includes(key)) completed.value = [...completed.value, key];
};
