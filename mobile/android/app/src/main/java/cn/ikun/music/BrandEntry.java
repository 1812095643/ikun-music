package cn.ikun.music;

import android.content.Intent;
import android.os.Bundle;

import io.dcloud.PandoraEntry;
import io.dcloud.PandoraEntryActivity;

public final class BrandEntry extends PandoraEntry {
    @Override
    public void startActivity(Intent intent, Bundle options) {
        // 保留 SDK 的启动参数和初始化，只将实际承载页面替换为品牌开屏适配类。
        if (intent.getComponent() != null
                && PandoraEntryActivity.class.getName().equals(intent.getComponent().getClassName())) {
            intent.setClass(this, MusicActivity.class);
        }
        super.startActivity(intent, options);
    }
}
