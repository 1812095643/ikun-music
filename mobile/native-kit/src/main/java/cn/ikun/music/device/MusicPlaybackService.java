package cn.ikun.music.device;

import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

public final class MusicPlaybackService extends MediaSessionService {
    private MediaSession session;
    @Override public void onCreate() {
        super.onCreate();
        AndroidAudio.initialize(this);
        session = new MediaSession.Builder(this, AndroidAudio.player).build();
    }
    @Override public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) { return session; }
    @Override public void onDestroy() {
        if (session != null) session.release();
        AndroidAudio.release();
        super.onDestroy();
    }
}
