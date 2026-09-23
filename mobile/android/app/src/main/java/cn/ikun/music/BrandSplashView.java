package cn.ikun.music;

import android.animation.ValueAnimator;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.animation.Animation;
import android.view.animation.LinearInterpolator;
import android.view.animation.RotateAnimation;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class BrandSplashView extends FrameLayout {
    public static final String TAG = "ikun-brand-splash";
    private final FrameLayout scene;
    private final LinearLayout signature;
    private final View progress;
    private final float density;

    public BrandSplashView(Context context) {
        super(context);
        density = getResources().getDisplayMetrics().density;
        setTag(TAG);
        setBackgroundColor(Color.WHITE);
        scene = new FrameLayout(context);
        addView(scene, new LayoutParams(dp(255), dp(255), Gravity.CENTER));

        View aura = new View(context);
        aura.setBackgroundResource(R.drawable.brand_splash_aura);
        scene.addView(aura, new LayoutParams(dp(245), dp(245), Gravity.CENTER));
        View ring = new View(context);
        ring.setBackground(shape(Color.TRANSPARENT, 99, 0x1C29C96F));
        scene.addView(ring, new LayoutParams(dp(197), dp(197), Gravity.CENTER));
        progress = new View(context);
        progress.setBackgroundResource(R.drawable.brand_splash_progress);
        scene.addView(progress, new LayoutParams(dp(197), dp(197), Gravity.CENTER));

        float[][] dots = {{34, 72, 7}, {70, 218, 5}, {219, 112, 5}, {185, 24, 3},
                {207, 197, 3}, {17, 162, 3}};
        for (float[] dot : dots) {
            View view = new View(context);
            view.setBackground(shape(0xA68BD9AA, dot[2], 0));
            LayoutParams position = new LayoutParams(dp(dot[2]), dp(dot[2]));
            position.leftMargin = dp(dot[0]);
            position.topMargin = dp(dot[1]);
            scene.addView(view, position);
        }
        ImageView icon = new ImageView(context);
        icon.setImageResource(R.drawable.icon);
        icon.setScaleType(ImageView.ScaleType.CENTER_CROP);
        icon.setBackground(shape(Color.WHITE, 31, 0));
        icon.setClipToOutline(true);
        icon.setElevation(dp(3));
        scene.addView(icon, new LayoutParams(dp(105), dp(105), Gravity.CENTER));

        signature = new LinearLayout(context);
        signature.setOrientation(LinearLayout.VERTICAL);
        signature.setGravity(Gravity.CENTER);
        LinearLayout title = new LinearLayout(context);
        title.setGravity(Gravity.CENTER);
        title.addView(label("IKUN", 30, 0xFF128451, Typeface.BOLD, 0.035f));
        TextView name = label(getResources().getString(R.string.brand_splash_music),
                23, 0xFF128451, Typeface.BOLD, 0.085f);
        LinearLayout.LayoutParams nameParams = new LinearLayout.LayoutParams(-2, -2);
        nameParams.leftMargin = dp(10);
        title.addView(name, nameParams);
        signature.addView(title, new LinearLayout.LayoutParams(-2, -2));
        TextView tagline = label(getResources().getString(R.string.brand_splash_tagline),
                11, 0xFF7C8493, Typeface.NORMAL, 0.27f);
        LinearLayout.LayoutParams taglineParams = new LinearLayout.LayoutParams(-2, -2);
        taglineParams.topMargin = dp(14);
        signature.addView(tagline, taglineParams);
        addView(signature, new LayoutParams(-1, -2, Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL));
    }

    @Override
    protected void onSizeChanged(int width, int height, int oldWidth, int oldHeight) {
        super.onSizeChanged(width, height, oldWidth, oldHeight);
        // 与 StartupSplash.vue 使用相同尺寸规则，横屏缩小场景，保留底部品牌文字空间。
        boolean compact = height / density < 540;
        float sceneSize = compact ? 190 : 255;
        scene.setScaleX(sceneSize / 255);
        scene.setScaleY(sceneSize / 255);
        scene.setTranslationY(dp(compact ? -40 : -52.5f));
        LayoutParams params = (LayoutParams) signature.getLayoutParams();
        params.bottomMargin = Math.round(height * (compact ? 0.06f : 0.13f));
        signature.setLayoutParams(params);
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        if (!ValueAnimator.areAnimatorsEnabled()) return;
        RotateAnimation rotation = new RotateAnimation(0, 360,
                Animation.RELATIVE_TO_SELF, 0.5f, Animation.RELATIVE_TO_SELF, 0.5f);
        rotation.setDuration(1200);
        rotation.setRepeatCount(Animation.INFINITE);
        rotation.setInterpolator(new LinearInterpolator());
        progress.startAnimation(rotation);
    }

    @Override
    protected void onDetachedFromWindow() {
        progress.clearAnimation();
        super.onDetachedFromWindow();
    }

    private TextView label(String text, float size, int color, int style, float spacing) {
        TextView label = new TextView(getContext());
        label.setText(text);
        label.setTextSize(TypedValue.COMPLEX_UNIT_DIP, size);
        label.setTextColor(color);
        label.setTypeface(Typeface.create("sans-serif", style));
        label.setLetterSpacing(spacing);
        label.setIncludeFontPadding(false);
        return label;
    }

    private GradientDrawable shape(int color, float radius, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(dp(radius));
        if (stroke != 0) drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private int dp(float value) {
        return Math.round(value * density);
    }
}
