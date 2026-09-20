package cn.ikun.music.device;

import io.dcloud.feature.uniapp.annotation.UniJSMethod;
import io.dcloud.feature.uniapp.common.UniModule;
import io.dcloud.feature.uniapp.bridge.UniJSCallback;

/** 云打包必须注册真实模块，前端用版本握手确认本地扩展已正确装载。 */
public final class DeviceKitModule extends UniModule {
    @UniJSMethod(uiThread = false)
    public String version() {
        return DeviceKit.version();
    }

    @UniJSMethod(uiThread = false)
    public String audioState() { return AndroidAudio.snapshot(); }

    @UniJSMethod(uiThread = false)
    public void audioCommand(String payload) {
        MusicPlaybackService.dispatch(mUniSDKInstance.getContext().getApplicationContext(), payload);
    }

    @UniJSMethod(uiThread = false)
    public String playbackStatus() {
        return MusicPlaybackService.status(mUniSDKInstance.getContext());
    }

    @UniJSMethod(uiThread = true)
    public void observeAudio(UniJSCallback callback) {
        AndroidAudio.observe(callback::invokeAndKeepAlive);
    }

    @UniJSMethod(uiThread = true)
    public void unobserveAudio() {
        AndroidAudio.observe(null);
    }

    @UniJSMethod(uiThread = false)
    public void verifyUpdate(String payload, UniJSCallback callback) {
        callback.invoke(ApkUpdates.verify(mUniSDKInstance.getContext(), payload));
    }
}
