package cn.ikun.music.device;

import android.content.Context;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.*;
import androidx.media3.exoplayer.*;
import androidx.media3.exoplayer.audio.*;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import java.util.ArrayDeque;
import java.util.function.Consumer;
import org.json.JSONArray;
import org.json.JSONObject;

public final class AndroidAudio {
    static ExoPlayer player;
    static SessionPlayer sessionPlayer;
    static final SpectrumAnalyzer analyzer = new SpectrumAnalyzer();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static final ArrayDeque<JSONObject> navigation = new ArrayDeque<>();
    private static Consumer<String> observer;
    private static long eventId;
    private static volatile String state = "{}";
    private static String source = "", failure = "";
    private static final Runnable publish = new Runnable() {
        @Override public void run() {
            if (player == null) return;
            updateState(false);
            main.postDelayed(this, 250);
        }
    };
    static void initialize(Context context) {
        if (player != null) return;
        DefaultRenderersFactory renderers = new DefaultRenderersFactory(context) {
            @Override protected AudioSink buildAudioSink(Context context, boolean enableFloatOutput, boolean enableAudioTrackPlaybackParams) {
                return new DefaultAudioSink.Builder(context).setEnableFloatOutput(false)
                    .setAudioProcessors(new androidx.media3.common.audio.AudioProcessor[]{new TeeAudioProcessor(analyzer)}).build();
            }
        };
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory().setUserAgent("okhttp/3.10.0")
            .setAllowCrossProtocolRedirects(true).setDefaultRequestProperties(java.util.Collections.singletonMap("Referer", "http://www.kuwo.cn/"));
        player = new ExoPlayer.Builder(context, renderers)
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(context, http)))
            .setWakeMode(C.WAKE_MODE_LOCAL).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        sessionPlayer = new SessionPlayer(player);
        player.addListener(new Player.Listener() {
            @Override public void onPlayerError(PlaybackException error) { failure = error.getErrorCodeName(); }
            @Override public void onIsPlayingChanged(boolean playing) { if (!playing) analyzer.reset(); }
            @Override public void onEvents(Player value, Player.Events events) { updateState(true); }
        });
        main.post(publish);
    }
    static void observe(Consumer<String> callback) {
        observer = callback;
        if (observer != null) observer.accept(state);
    }
    private static void updateState(boolean notify) {
        if (player == null) return;
        try {
            state = new JSONObject().put("src", source).put("position", player.getCurrentPosition() / 1000.0)
                .put("duration", Math.max(0, player.getDuration()) / 1000.0).put("playing", player.isPlaying())
                .put("playWhenReady", player.getPlayWhenReady()).put("state", player.getPlaybackState())
                .put("error", failure).put("events", new JSONArray(navigation)).toString();
            if (notify && observer != null) observer.accept(state);
        } catch (Exception ignored) { }
    }
    static void navigate(String type) {
        try {
            navigation.addLast(new JSONObject().put("id", ++eventId).put("type", type));
            while (navigation.size() > 32) navigation.removeFirst();
            // 原生回调可在锁屏时唤起 JS 服务；快照保留序号，前台轮询补收时不会重复切歌。
            updateState(true);
        } catch (Exception error) { reportFailure(error); }
    }
    static void prepareForPlayback() {
        if (player == null || player.getMediaItemCount() == 0) return;
        failure = "";
        // stop、解码/网络错误都会让 ExoPlayer 进入 IDLE，仅调用 play 不会再次加载音源。
        if (player.getPlaybackState() == Player.STATE_IDLE) player.prepare();
        else if (player.getPlaybackState() == Player.STATE_ENDED) player.seekTo(0);
    }
    static void reportFailure(Exception error) {
        failure = error.getMessage() == null ? error.getClass().getSimpleName() : error.getMessage();
        if (player != null) updateState(true);
        else try {
            state = new JSONObject().put("error", failure).toString();
            if (observer != null) observer.accept(state);
        } catch (Exception ignored) { }
    }
    public static String snapshot() { return state; }
    static void command(String payload) {
        try {
            JSONObject input = new JSONObject(payload);
            switch (input.getString("type")) {
                case "load":
                    source = input.getString("src"); failure = ""; analyzer.reset();
                    MediaMetadata.Builder metadata = new MediaMetadata.Builder().setTitle(input.optString("title"))
                        .setArtist(input.optString("artist")).setAlbumTitle(input.optString("album"));
                    String artwork = input.optString("artwork");
                    if (!artwork.isEmpty()) metadata.setArtworkUri(Uri.parse(artwork));
                    player.setMediaItem(new MediaItem.Builder().setUri(source)
                        .setMediaId(input.optString("id", source)).setMediaMetadata(metadata.build()).build(),
                        Math.max(0, (long)(input.optDouble("position", 0) * 1000)));
                    player.prepare(); break;
                case "play": prepareForPlayback(); player.play(); break;
                case "pause": player.pause(); break;
                case "stop": player.stop(); player.clearMediaItems(); source = ""; analyzer.reset(); break;
                case "seek": player.seekTo(Math.max(0, (long)(input.getDouble("position") * 1000))); break;
                case "navigation": sessionPlayer.setNavigation(input.optBoolean("previous"), input.optBoolean("next")); break;
                case "spectrum": analyzer.setEnabled(input.optBoolean("enabled")); break;
            }
            updateState(true);
        } catch (Exception error) { reportFailure(error); }
    }
    static void release() {
        main.removeCallbacks(publish);
        if (sessionPlayer != null) sessionPlayer.release();
        player = null; sessionPlayer = null; source = ""; state = "{}"; analyzer.reset();
        if (observer != null) observer.accept(state);
    }
}
