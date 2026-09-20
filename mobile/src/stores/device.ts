import { computed, shallowRef } from 'vue';

import { readStorage, writeStorage } from './library';

export type DeviceMode = 'phone' | 'tablet' | 'car';
export type DisplayMode = 'auto' | DeviceMode;
export const displayMode = shallowRef<DisplayMode>(readStorage('displayMode', 'auto'));
export const viewport = shallowRef({ width: 390, height: 844 });
const nativeKind = shallowRef<DeviceMode | null>(null);
export const modeNames = { auto: '自动适配', phone: '手机', tablet: '平板', car: '车机' };
export const detectedMode = computed<DeviceMode>(
  () =>
    nativeKind.value ||
    (Math.min(viewport.value.width, viewport.value.height) >= 600 ? 'tablet' : 'phone')
);
export const deviceMode = computed(() =>
  displayMode.value === 'auto' ? detectedMode.value : displayMode.value
);
export const wideLayout = computed(() => viewport.value.width >= 720);
export const showSpectrum = computed(() => deviceMode.value !== 'phone');
let initialized = false;

function measure() {
  const info = uni.getSystemInfoSync();
  viewport.value = { width: info.windowWidth, height: info.windowHeight };
  // 横屏手机仍然是手机；优先使用系统设备类型和车载模式，避免仅凭宽高误判。
  if (info.deviceType === 'pad') nativeKind.value = 'tablet';
  // #ifdef APP-PLUS
  nativeKind.value =
    info.deviceType === 'pad' || Math.min(info.screenWidth, info.screenHeight) >= 600
      ? 'tablet'
      : 'phone';
  if (plus.os.name === 'Android') {
    try {
      const activity: any = plus.android.runtimeMainActivity();
      const manager = activity.getSystemService('uimode');
      const packageManager = activity.getPackageManager();
      if (
        plus.android.invoke(manager, 'getCurrentModeType') === 3 ||
        plus.android.invoke(packageManager, 'hasSystemFeature', 'android.hardware.type.automotive')
      )
        nativeKind.value = 'car';
    } catch {
      // 一些改装车机不报告硬件类型，可在设置中手动选择并保留。
    }
  }
  // #endif
}
export function initializeDevice() {
  if (initialized) return;
  initialized = true;
  measure();
  uni.onWindowResize(measure);
}
export function setDisplayMode(mode: DisplayMode) {
  displayMode.value = mode;
  writeStorage('displayMode', mode);
}
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    if (initialized) uni.offWindowResize(measure);
  });
