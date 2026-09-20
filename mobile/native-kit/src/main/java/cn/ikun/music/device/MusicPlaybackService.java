package cn.ikun.music.device;

import android.app.PendingIntent;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import androidx.media3.session.DefaultMediaNotificationProvider;
import androidx.media3.session.CacheBitmapLoader;
import org.json.JSONObject;
import java.util.ArrayDeque;

public final class MusicPlaybackService extends MediaSessionService {
    private static volatile MusicPlaybackService active;
    static final String CHANNEL_ID = "default_channel_id";
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final ArrayDeque<String> pending = new ArrayDeque<>();
    private MediaSession session;
    private PlaybackArtwork artwork;

    static String status(Context context) {
        try {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
            boolean published = false;
            for (android.service.notification.StatusBarNotification item : manager.getActiveNotifications()) {
                if (item.getNotification().extras.containsKey("android.mediaSession")) published = true;
            }
            return new JSONObject().put("sdk", android.os.Build.VERSION.SDK_INT)
                .put("notificationsEnabled", manager.areNotificationsEnabled())
                .put("channelEnabled", channel == null || channel.getImportance() != NotificationManager.IMPORTANCE_NONE)
                .put("sessionActive", active != null && active.session != null)
                .put("published", published).toString();
        } catch (Exception error) { return "{}"; }
    }

    static void dispatch(Context context, String payload) {
        main.post(() -> {
            try {
                if (active != null) AndroidAudio.command(payload);
                else {
                    pending.addLast(payload);
                    context.startService(new Intent(context, MusicPlaybackService.class));
                }
            } catch (Exception error) {
                pending.remove(payload);
                AndroidAudio.reportFailure(error);
            }
        });
    }

    @Override public void onCreate() {
        super.onCreate();
        AndroidAudio.initialize(this);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "音乐播放", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("歌曲、封面和播放控制");
        channel.setSound(null, null);
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
        DefaultMediaNotificationProvider provider = new DefaultMediaNotificationProvider.Builder(this)
            .setChannelId(CHANNEL_ID).build();
        int icon = getResources().getIdentifier("ikun_notification", "drawable", getPackageName());
        if (icon != 0) provider.setSmallIcon(icon);
        setMediaNotificationProvider(provider);
        artwork = new PlaybackArtwork(this);
        MediaSession.Builder builder = new MediaSession.Builder(this, AndroidAudio.sessionPlayer)
            .setBitmapLoader(new CacheBitmapLoader(artwork));
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) builder.setSessionActivity(PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        session = builder.build();
        // Native.js 直接启动服务，不会触发控制器绑定；必须主动注册，Media3 才会管理通知和前台保活。
        addSession(session);
        setListener(new MediaSessionService.Listener() {
            @Override public void onForegroundServiceStartNotAllowedException() {
                AndroidAudio.reportFailure(new IllegalStateException("请返回应用后点击播放，以恢复后台播放服务。"));
            }
        });
        active = this;
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        int result = super.onStartCommand(intent, flags, startId);
        // 对外只开放标准媒体会话；私有取流命令保存在进程内，不能通过导出的 Intent 注入。
        while (!pending.isEmpty()) AndroidAudio.command(pending.removeFirst());
        return result;
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) { return session; }
    @Override public void onDestroy() {
        active = null;
        if (session != null) session.release();
        AndroidAudio.release();
        if (artwork != null) artwork.close();
        super.onDestroy();
    }
}
