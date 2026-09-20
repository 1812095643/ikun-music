export function getBackgroundPlaybackGuide() {
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    const info = uni.getSystemInfoSync();
    const brand = (info.deviceBrand || info.brand || '').toLowerCase();
    if (/xiaomi|redmi|poco/.test(brand)) {
      return { brand: '小米', detail: '在系统电池设置中找到 ikun音乐，将省电策略设为“无限制”。' };
    }
    if (/vivo|iqoo/.test(brand)) {
      return {
        brand: 'vivo',
        detail: '在系统“电池 → 后台耗电管理”中找到 ikun音乐，允许后台耗电或后台高耗电。'
      };
    }
    if (/oppo|realme|oneplus/.test(brand)) {
      return {
        brand: 'OPPO',
        detail: '在应用信息的“耗电管理”或“电池用量”中，开启“允许后台活动”。'
      };
    }
    return { brand: 'Android', detail: '在系统应用设置中找到电池选项，允许 ikun音乐在后台运行。' };
  }
  // #endif
  return null;
}

export function openBackgroundPlaybackSettings(battery = false) {
  // #ifdef APP-PLUS
  if (plus.os.name === 'Android') {
    try {
      const activity = plus.android.runtimeMainActivity();
      const intent = plus.android.newObject(
        'android.content.Intent',
        battery
          ? 'android.settings.IGNORE_BATTERY_OPTIMIZATION_SETTINGS'
          : 'android.settings.APPLICATION_DETAILS_SETTINGS'
      );
      if (!battery) {
        const packageName = plus.android.invoke(activity, 'getPackageName');
        const uri = plus.android.invoke('android.net.Uri', 'parse', `package:${packageName}`);
        plus.android.invoke(intent, 'setData', uri);
      }
      plus.android.invoke(activity, 'startActivity', intent);
      return;
    } catch {
      if (battery) {
        openBackgroundPlaybackSettings();
        return;
      }
    }
  }
  // #endif
  uni.showToast({
    title: '请在系统设置中打开 ikun音乐的应用信息，调整后台运行权限。',
    icon: 'none'
  });
}
