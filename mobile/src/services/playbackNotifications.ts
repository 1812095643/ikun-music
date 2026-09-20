import { readStorage, writeStorage } from '@/stores/library';

export interface PlaybackNotificationStatus {
  sdk?: number;
  notificationsEnabled?: boolean;
  channelEnabled?: boolean;
  sessionActive?: boolean;
  published?: boolean;
}

export function playbackNotificationStatus(): PlaybackNotificationStatus | null {
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    try {
      return JSON.parse(uni.requireNativePlugin('Ikun-DeviceKit').playbackStatus());
    } catch {
      return {};
    }
  }
  // #endif
  return null;
}

let requesting = false;
export async function requestPlaybackNotifications(manual = false) {
  // #ifdef APP-PLUS
  const status = playbackNotificationStatus();
  if (!status || requesting) return;
  if (
    manual &&
    ((status.sdk || 0) < 33 ||
      status.notificationsEnabled !== false ||
      status.channelEnabled === false ||
      readStorage('playbackNotificationAsked', false))
  ) {
    openPlaybackNotificationSettings();
    return;
  }
  if (
    (status.sdk || 0) < 33 ||
    status.notificationsEnabled !== false ||
    (!manual && readStorage('playbackNotificationAsked', false))
  )
    return;
  requesting = true;
  // 标准媒体通知有权限豁免，但部分厂商另有通知展示开关；拒绝后不反复打扰或阻止听歌。
  writeStorage('playbackNotificationAsked', true);
  try {
    await new Promise<void>((resolve) =>
      plus.android.requestPermissions(
        ['android.permission.POST_NOTIFICATIONS'],
        () => resolve(),
        () => resolve()
      )
    );
  } finally {
    requesting = false;
  }
  // #endif
}

export function openPlaybackNotificationSettings() {
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    try {
      const activity = plus.android.runtimeMainActivity();
      const intent = plus.android.newObject(
        'android.content.Intent',
        'android.settings.APP_NOTIFICATION_SETTINGS'
      );
      (plus.android.invoke as (...args: any[]) => any)(
        intent,
        'putExtra',
        'android.provider.extra.APP_PACKAGE',
        plus.android.invoke(activity, 'getPackageName')
      );
      plus.android.invoke(activity, 'startActivity', intent);
      return;
    } catch {
      // 部分系统没有独立的通知设置页，继续显示手动调整指引。
    }
  }
  // #endif
  uni.showToast({ title: '请到系统应用设置中打开音乐播放通知和锁屏显示。', icon: 'none' });
}
