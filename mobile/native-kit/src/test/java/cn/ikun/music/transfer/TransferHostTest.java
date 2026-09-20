package cn.ikun.music.transfer;

import org.junit.*;
import org.junit.rules.TemporaryFolder;
import org.json.*;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import static org.junit.Assert.*;

public class TransferHostTest {
    @Rule public TemporaryFolder temporary = new TemporaryFolder();
    private TransferHost host;
    private String base, owner, guest;
    private int status;
    @Before public void start() throws Exception {
        host = new TransferHost(temporary.newFolder("inbox"), temporary.newFolder("site")); host.start(5000, true);
        JSONObject info = host.localInfo(); base = "http://127.0.0.1:" + info.getInt("port"); owner = info.getString("ownerToken");
        guest = parse(call("POST", "/api/join", "", new JSONObject().put("code", info.getString("code")).toString().getBytes(StandardCharsets.UTF_8))).getString("token");
    }
    private JSONObject parse(byte[] value) throws Exception { return new JSONObject(new String(value, StandardCharsets.UTF_8)); }
    @After public void stop() { host.stop(); }
    private byte[] call(String method, String path, String token, byte[] bytes) throws Exception {
        HttpURLConnection connection = (HttpURLConnection)new URL(base + path).openConnection();
        connection.setConnectTimeout(3000); connection.setReadTimeout(10000); connection.setRequestMethod(method);
        connection.setRequestProperty("x-ikun-token", token);
        if (bytes != null) { connection.setDoOutput(true); connection.setFixedLengthStreamingMode(bytes.length); try (OutputStream out = connection.getOutputStream()) { out.write(bytes); } }
        status = connection.getResponseCode();
        try (InputStream input = status >= 400 ? connection.getErrorStream() : connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            if (input != null) { byte[] buffer = new byte[8192]; int count; while ((count = input.read(buffer)) >= 0) output.write(buffer, 0, count); }
            return output.toByteArray();
        } finally { connection.disconnect(); }
    }
    @Test public void arbitraryFileRoundTripAndIsolation() throws Exception {
        byte[] file = new byte[1024 * 1024 + 117]; new java.util.Random(8).nextBytes(file);
        JSONObject item = parse(call("POST", "/api/files?name=" + URLEncoder.encode("安装包.zip", "UTF-8"), guest, file));
        assertEquals(200, status); assertEquals(file.length, host.store().file(item.getString("id")).length());
        byte[] downloaded = call("GET", "/api/items/" + item.getString("id"), owner, null);
        assertArrayEquals(MessageDigest.getInstance("SHA-256").digest(file), MessageDigest.getInstance("SHA-256").digest(downloaded));
        call("GET", "/api/items/" + item.getString("id"), guest, null); assertEquals(404, status);
        JSONObject shared = parse(call("POST", "/api/files?name=out.bin", owner, file));
        assertArrayEquals(file, call("GET", "/api/items/" + shared.getString("id"), guest, null));
    }
    @Test public void longTextIsCompleteAndNotExecuted() throws Exception {
        StringBuilder text = new StringBuilder(); for(int i=0;i<8000;i++) text.append("孙燕姿 - 遇见 <script>文本</script>\n");
        JSONObject item = parse(call("POST", "/api/text", guest, new JSONObject().put("text", text.toString()).toString().getBytes(StandardCharsets.UTF_8)));
        String received = parse(call("GET", "/api/items/" + item.getString("id"), owner, null)).getString("text");
        assertEquals(text.toString(), received); assertTrue(item.getString("preview").length() <= 160);
    }
    @Test public void unpairedRequestsAndTraversalAreRejected() throws Exception {
        call("GET", "/api/state", "", null); assertEquals(401, status);
        call("GET", "/api/items/../../outside", owner, null); assertEquals(404, status);
        call("POST", "/api/leave", guest, new byte[0]); assertEquals(200, status);
        call("GET", "/api/state", guest, null); assertEquals(401, status);
    }
    @Test public void interruptedStreamNeverCreatesCompletedFile() throws Exception {
        TransferStore store = new TransferStore(temporary.newFolder("interrupted"));
        try { store.receive("partial.apk", 8192, new ByteArrayInputStream(new byte[8]), false, false); fail(); } catch(EOFException expected) { }
        assertEquals(0, store.list(true).length()); assertEquals(0, store.progress().length());
    }
    @Test public void documentProviderWithoutSizeKeepsTheWholeFile() throws Exception {
        byte[] data = new byte[131073]; new java.util.Random(9).nextBytes(data);
        JSONObject item = host.store().receive("provider.bin", -1, new ByteArrayInputStream(data), true, false);
        assertEquals(data.length, item.getLong("size"));
        assertArrayEquals(data, java.nio.file.Files.readAllBytes(host.store().file(item.getString("id")).toPath()));
    }
}
