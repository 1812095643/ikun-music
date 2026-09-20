package cn.ikun.music.device;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;
import java.util.ArrayDeque;

public final class MusicPlaybackService extends MediaSessionService {
    private static MusicPlaybackService active;
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final ArrayDeque<String> pending = new ArrayDeque<>();
    private MediaSession session;

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
        active = this;
        AndroidAudio.initialize(this);
        MediaSession.Builder builder = new MediaSession.Builder(this, AndroidAudio.sessionPlayer);
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch != null) builder.setSessionActivity(PendingIntent.getActivity(this, 0, launch,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        session = builder.build();
        // Native.js 直接启动服务，不会触发控制器绑定；必须主动注册，Media3 才会管理通知和前台保活。
        addSession(session);
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
        super.onDestroy();
    }
}
