package cn.ikun.music.transfer;

import fi.iki.elonen.NanoHTTPD;
import org.json.JSONObject;
import org.json.JSONArray;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Semaphore;

/** 使用 NanoHTTPD 处理 HTTP 与连接；业务层只负责配对、流式落盘和显式分享。 */
public final class TransferHost extends NanoHTTPD {
    private final TransferStore store;
    private final File site;
    private final String ownerToken = token();
    private final String pairCode = String.format(Locale.ROOT, "%06d", new SecureRandom().nextInt(1000000));
    private final Set<String> guests = ConcurrentHashMap.newKeySet();
    private final Map<String, long[]> attempts = new HashMap<>();
    private final Semaphore transfers = new Semaphore(3);
    public TransferHost(File root, File site) throws Exception {
        super("0.0.0.0", 0);
        this.store = new TransferStore(root);
        this.site = site.getCanonicalFile();
    }
    public TransferStore store() { return store; }
    private static String token() { byte[] bytes = new byte[24]; new SecureRandom().nextBytes(bytes); return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes); }
    public JSONObject localInfo() throws Exception {
        JSONArray addresses = new JSONArray();
        List<Map.Entry<String, Integer>> candidates = new ArrayList<>();
        Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
        while (interfaces != null && interfaces.hasMoreElements()) {
            NetworkInterface iface = interfaces.nextElement();
            if (!iface.isUp() || iface.isLoopback()) continue;
            String name = (iface.getName() + " " + iface.getDisplayName()).toLowerCase(Locale.ROOT);
            int rank = name.matches(".*(wlan|wi-fi|wifi|swlan|ap0).*?") ? 0 : 10;
            if (name.matches(".*(virtual|vmware|vbox|veth|docker|vpn|tun|tap|rmnet|ccmni|pdp_ip).*")) rank = 50;
            Enumeration<InetAddress> values = iface.getInetAddresses();
            while (values.hasMoreElements()) {
                InetAddress value = values.nextElement();
                if (value instanceof Inet4Address && value.isSiteLocalAddress()) candidates.add(new AbstractMap.SimpleEntry<>("http://" + value.getHostAddress() + ":" + getListeningPort(), rank));
            }
        }
        candidates.sort(Map.Entry.comparingByValue());
        for (Map.Entry<String, Integer> candidate : candidates) addresses.put(candidate.getKey());
        return new JSONObject().put("running", isAlive()).put("port", getListeningPort()).put("addresses", addresses)
            .put("code", pairCode).put("ownerToken", ownerToken).put("peerCount", guests.size());
    }
    @Override public Response serve(IHTTPSession request) {
        try {
            String path = request.getUri();
            String method = request.getMethod().name();
            if (!path.startsWith("/api/")) return staticFile(path, method);
            if (path.equals("/api/join") && method.equals("POST")) return join(request);
            String auth = request.getHeaders().getOrDefault("x-ikun-token", Optional.ofNullable(request.getCookies().read("ikun_peer")).orElse(""));
            boolean owner = ownerToken.equals(auth);
            if (!owner && !guests.contains(auth)) return json(401, "请重新输入车机上的连接码");
            if (path.equals("/api/leave") && method.equals("POST") && !owner) {
                guests.remove(auth);
                Response response = json(200, new JSONObject().put("ok", true));
                response.addHeader("Set-Cookie", "ikun_peer=; Path=/api; Max-Age=0; HttpOnly; SameSite=Strict");
                return response;
            }
            if (path.equals("/api/state") && method.equals("GET")) {
                JSONObject result = new JSONObject().put("items", store.list(owner));
                if (owner) result.put("transfers", store.progress()).put("peerCount", guests.size()).put("addresses", localInfo().getJSONArray("addresses"));
                return json(200, result);
            }
            if (path.equals("/api/text") && method.equals("POST")) return json(200, store.saveText(body(request, 2 * 1024 * 1024).getString("text"), owner));
            if (path.equals("/api/files") && method.equals("POST")) {
                if (!transfers.tryAcquire()) return json(429, "已有三个文件正在传输，请稍后重试");
                try {
                    long size = Long.parseLong(request.getHeaders().getOrDefault("content-length", "-1"));
                    if (size < 0) throw new IOException("未能读取文件大小，请重新选择文件");
                    String name = request.getParms().getOrDefault("name", "未命名文件");
                    return json(200, store.receive(name, size, request.getInputStream(), owner, false));
                } finally { transfers.release(); }
            }
            if (path.startsWith("/api/cancel/") && method.equals("POST") && owner) { store.cancel(path.substring(12)); return json(200, new JSONObject().put("ok", true)); }
            if (path.startsWith("/api/items/")) {
                String id = path.substring(11);
                JSONObject item = store.entry(id);
                if (item == null || (!owner && !"outgoing".equals(item.optString("direction")))) return json(404, "这个文件已经不在共享列表中");
                if (method.equals("DELETE") && owner) { store.remove(id); return json(200, new JSONObject().put("ok", true)); }
                if (method.equals("GET")) {
                    File file = store.file(id);
                    if ("text".equals(item.optString("kind"))) return json(200, new JSONObject().put("text", new String(java.nio.file.Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8)));
                    Response response = newFixedLengthResponse(Response.Status.OK, "application/octet-stream", new FileInputStream(file), file.length());
                    response.addHeader("Content-Disposition", "attachment; filename*=UTF-8''" + URLEncoder.encode(item.getString("name"), "UTF-8").replace("+", "%20"));
                    response.addHeader("X-Content-Type-Options", "nosniff");
                    return response;
                }
            }
            return json(404, "没有找到这个传输操作");
        } catch (Exception error) { return json(400, error.getMessage() == null ? "传输中断，请重试" : error.getMessage()); }
    }
    private synchronized Response join(IHTTPSession request) throws Exception {
        long now = System.currentTimeMillis();
        String remote = request.getRemoteIpAddress();
        if (attempts.size() > 128) attempts.entrySet().removeIf(e -> now - e.getValue()[0] > 60000);
        long[] count = attempts.computeIfAbsent(remote, key -> new long[]{now, 0});
        if (now - count[0] > 60000) { count[0] = now; count[1] = 0; }
        if (++count[1] > 8) return json(429, "尝试过于频繁，请一分钟后重试");
        if (!pairCode.equals(body(request, 4096).optString("code"))) return json(403, "连接码不一致，请查看车机屏幕上的六位数字");
        if (guests.size() >= 24) return json(429, "连接设备过多，请重新开启互传");
        String value = token(); guests.add(value);
        Response response = json(200, new JSONObject().put("token", value));
        response.addHeader("Set-Cookie", "ikun_peer=" + value + "; Path=/api; HttpOnly; SameSite=Strict");
        return response;
    }
    private JSONObject body(IHTTPSession request, int max) throws Exception {
        int length = Integer.parseInt(request.getHeaders().getOrDefault("content-length", "-1"));
        if (length < 0 || length > max) throw new IOException("发送内容过长，请拆分后重试");
        byte[] bytes = new byte[length];
        new DataInputStream(request.getInputStream()).readFully(bytes);
        return new JSONObject(new String(bytes, StandardCharsets.UTF_8));
    }
    private Response staticFile(String path, String method) throws Exception {
        if (!method.equals("GET") || !Arrays.asList("/", "/portal.css", "/portal.js", "/brand.png").contains(path)) return json(404, "页面不存在");
        File file = new File(site, path.equals("/") ? "index.html" : path.substring(1));
        if (!file.isFile()) return json(503, "互传页面尚未准备好，请重新打开互传");
        String mime = path.endsWith(".png") ? "image/png" : path.endsWith(".js") ? "application/javascript" : path.endsWith(".css") ? "text/css" : "text/html";
        Response response = newFixedLengthResponse(Response.Status.OK, mime + "; charset=utf-8", new FileInputStream(file), file.length());
        response.addHeader("Cache-Control", "no-store");
        response.addHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'");
        response.addHeader("X-Content-Type-Options", "nosniff");
        response.addHeader("Referrer-Policy", "no-referrer");
        return response;
    }
    private static Response json(int status, Object value) {
        try {
            String body = value instanceof String ? new JSONObject().put("message", value).toString() : value.toString();
            Response response = newFixedLengthResponse(Response.Status.lookup(status), "application/json; charset=utf-8", body);
            response.addHeader("Cache-Control", "no-store");
            return response;
        } catch (Exception error) { return newFixedLengthResponse(Response.Status.INTERNAL_ERROR, "text/plain", "Transfer unavailable"); }
    }
    @Override public void stop() { store.cancelAll(); guests.clear(); super.stop(); }
}
