package cn.ikun.music.device;

import androidx.media3.common.C;
import androidx.media3.exoplayer.audio.TeeAudioProcessor;
import org.jtransforms.fft.FloatFFT_1D;
import org.json.JSONObject;
import org.json.JSONArray;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;

/** 复用 Media3 PCM 分流与 JTransforms FFT；不采集麦克风，也不修改播放的音频。 */
public final class SpectrumAnalyzer implements TeeAudioProcessor.AudioBufferSink {
    private static final int WINDOW = 1024, BANDS = 28;
    private final FloatFFT_1D fft = new FloatFFT_1D(WINDOW);
    private final float[] left = new float[WINDOW], right = new float[WINDOW], window = new float[WINDOW];
    private int sampleRate = 44100, channels = 2, encoding = C.ENCODING_PCM_16BIT;
    private long lastFrame;
    private volatile boolean enabled;
    private volatile String frame = "{\"ready\":false,\"left\":[],\"right\":[]}";
    public SpectrumAnalyzer() {
        for (int i = 0; i < WINDOW; i++) window[i] = (float)(0.5 - 0.5 * Math.cos(2 * Math.PI * i / (WINDOW - 1)));
    }
    public void setEnabled(boolean value) { enabled = value; if (!value) reset(); }
    public String snapshot() { return frame; }
    public void reset() { frame = "{\"ready\":false,\"left\":[],\"right\":[]}"; }
    @Override public void flush(int rate, int count, int format) { sampleRate = rate; channels = count; encoding = format; reset(); }
    @Override public void handleBuffer(ByteBuffer buffer) {
        if (!enabled || channels < 1 || (encoding != C.ENCODING_PCM_16BIT && encoding != C.ENCODING_PCM_FLOAT)) return;
        long now = System.nanoTime();
        if (now - lastFrame < 50000000L) return;
        int bytes = encoding == C.ENCODING_PCM_FLOAT ? 4 : 2;
        int frames = Math.min(WINDOW, buffer.remaining() / (channels * bytes));
        if (frames < 64) return;
        lastFrame = now;
        ByteBuffer data = buffer.duplicate().order(ByteOrder.LITTLE_ENDIAN);
        int start = data.limit() - frames * channels * bytes;
        double energyLeft = 0, energyRight = 0;
        java.util.Arrays.fill(left, 0); java.util.Arrays.fill(right, 0);
        for (int i = 0; i < frames; i++) {
            int position = start + i * channels * bytes;
            float l = bytes == 4 ? data.getFloat(position) : data.getShort(position) / 32768f;
            float r = channels == 1 ? l : bytes == 4 ? data.getFloat(position + bytes) : data.getShort(position + bytes) / 32768f;
            energyLeft += l * l; energyRight += r * r;
            left[i] = l * window[i]; right[i] = r * window[i];
        }
        fft.realForward(left); fft.realForward(right);
        try {
            frame = new JSONObject().put("ready", true).put("channels", channels).put("left", bands(left)).put("right", bands(right))
                .put("leftLevel", Math.sqrt(energyLeft / frames)).put("rightLevel", Math.sqrt(energyRight / frames)).toString();
        } catch (Exception ignored) { reset(); }
    }
    private JSONArray bands(float[] values) throws org.json.JSONException {
        JSONArray bars = new JSONArray();
        double high = Math.min(16000, sampleRate / 2.0);
        for (int band = 0; band < BANDS; band++) {
            int from = Math.max(1, (int)(60 * Math.pow(high / 60, band / (double)BANDS) * WINDOW / sampleRate));
            int to = Math.min(WINDOW / 2 - 1, Math.max(from, (int)(60 * Math.pow(high / 60, (band + 1.0) / BANDS) * WINDOW / sampleRate)));
            double peak = 0;
            for (int bin = from; bin <= to; bin++) peak = Math.max(peak, Math.hypot(values[2 * bin], values[2 * bin + 1]) / WINDOW);
            double amplitude = Math.max(0, Math.min(1, (20 * Math.log10(Math.max(peak, 0.00001)) + 72) / 65));
            bars.put(Math.round(amplitude * 1000) / 1000.0);
        }
        return bars;
    }
}
