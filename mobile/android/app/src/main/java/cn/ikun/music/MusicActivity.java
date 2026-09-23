package cn.ikun.music;

import android.content.Context;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;

import io.dcloud.PandoraEntryActivity;

public final class MusicActivity extends PandoraEntryActivity {
    @Override
    public Object onCreateSplash(Context context) {
        Object result = super.onCreateSplash(context);
        // 复用 SDK 的开屏容器及关闭时机，覆盖默认圆形 Logo 和应用名称，避免两套画面轮播。
        if (mSplashView instanceof ViewGroup) {
            ViewGroup container = (ViewGroup) mSplashView;
            if (container.findViewWithTag(BrandSplashView.TAG) == null) {
                container.addView(new BrandSplashView(context), new ViewGroup.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            }
        }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        getWindow().setStatusBarColor(Color.WHITE);
        getWindow().setNavigationBarColor(Color.WHITE);
        View decor = getWindow().getDecorView();
        decor.setSystemUiVisibility((decor.getSystemUiVisibility() & ~View.SYSTEM_UI_FLAG_FULLSCREEN)
                | View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        return result;
    }
}
