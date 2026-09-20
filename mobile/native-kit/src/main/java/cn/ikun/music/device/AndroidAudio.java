package cn.ikun.music.device;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.*;
import androidx.media3.exoplayer.*;
import androidx.media3.exoplayer.audio.*;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import org.json.JSONObject;

public final class AndroidAudio {
    static ExoPlayer player;
    static final SpectrumAnalyzer analyzer = new SpectrumAnalyzer();
    private static final Handler main = new Handler(Looper.getMainLooper());
    private static volatile String state = "{}";
    private static String source = "", failure = "";
    private static final Runnable publish = new Runnable() {
        @Override public void run() {
            if (player == null) return;
            try {
                state = new JSONObject().put("src", source).put("position", player.getCurrentPosition() / 1000.0)
                    .put("duration", Math.max(0, player.getDuration()) / 1000.0).put("playing", player.isPlaying())
                    .put("state", player.getPlaybackState()).put("error", failure).toString();
            } catch (Exception ignored) { }
            main.postDelayed(this, 100);
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
            .setMediaSourceFactory(new DefaultMediaSourceFactory(new DefaultDataSource.Factory(context, http))).build();
        player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(), true);
        player.setHandleAudioBecomingNoisy(true);
        player.addListener(new Player.Listener() {
            @Override public void onPlayerError(PlaybackException error) { failure = error.getErrorCodeName(); }
            @Override public void onIsPlayingChanged(boolean playing) { if (!playing) analyzer.reset(); }
        });
        main.post(publish);
    }
    public static String snapshot() { return state; }
    public static void command(Context context, String payload) {
        main.post(() -> {
            try {
                initialize(context);
                JSONObject input = new JSONObject(payload);
                switch (input.getString("type")) {
                    case "load":
                        source = input.getString("src"); failure = ""; analyzer.reset();
                        MediaMetadata metadata = new MediaMetadata.Builder().setTitle(input.optString("title"))
                            .setArtist(input.optString("artist")).setAlbumTitle(input.optString("album")).build();
                        player.setMediaItem(new MediaItem.Builder().setUri(source).setMediaId(source).setMediaMetadata(metadata).build());
                        player.prepare(); break;
                    case "play": player.play(); break;
                    case "pause": player.pause(); break;
                    case "stop": player.stop(); source = ""; analyzer.reset(); break;
                    case "seek": player.seekTo((long)(input.getDouble("position") * 1000)); break;
                    case "spectrum": analyzer.setEnabled(input.optBoolean("enabled")); break;
                }
            } catch (Exception error) { failure = error.getMessage(); }
        });
    }
    static void release() {
        main.removeCallbacks(publish);
        if (player != null) player.release();
        player = null; source = ""; state = "{}"; analyzer.reset();
    }
}
