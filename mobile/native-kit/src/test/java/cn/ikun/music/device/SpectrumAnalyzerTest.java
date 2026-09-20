package cn.ikun.music.device;

import org.junit.Test;
import org.json.*;
import java.nio.*;
import static org.junit.Assert.*;

public class SpectrumAnalyzerTest {
    @Test public void separatesRealStereoFrequenciesAndSilence() throws Exception {
        SpectrumAnalyzer analyser = new SpectrumAnalyzer(); analyser.setEnabled(true); analyser.flush(48000, 2, 2);
        ByteBuffer pcm = ByteBuffer.allocate(4096).order(ByteOrder.LITTLE_ENDIAN);
        for (int i=0;i<1024;i++) { pcm.putShort((short)(Math.sin(2*Math.PI*440*i/48000)*22000)); pcm.putShort((short)(Math.sin(2*Math.PI*4000*i/48000)*7000)); }
        pcm.flip(); analyser.handleBuffer(pcm);
        JSONObject frame = new JSONObject(analyser.snapshot());
        assertTrue(frame.getBoolean("ready")); assertEquals(2,frame.getInt("channels"));
        assertTrue(frame.getDouble("leftLevel") > frame.getDouble("rightLevel")*2);
        assertTrue(peak(frame.getJSONArray("right")) > peak(frame.getJSONArray("left"))+5);
        Thread.sleep(60); analyser.handleBuffer(ByteBuffer.allocate(4096));
        frame = new JSONObject(analyser.snapshot());
        for(int i=0;i<28;i++) { assertEquals(0, frame.getJSONArray("left").getDouble(i), 0.0001); assertEquals(0, frame.getJSONArray("right").getDouble(i), 0.0001); }
    }
    private int peak(JSONArray values) throws Exception { int index=0; for(int i=1;i<values.length();i++) if(values.getDouble(i)>values.getDouble(index)) index=i; return index; }
}
