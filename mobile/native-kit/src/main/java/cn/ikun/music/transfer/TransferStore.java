package cn.ikun.music.transfer;

import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** 仅管理用户主动收发的对象；展示文件名从不参与磁盘路径计算。 */
public final class TransferStore {
    private final File root;
    private final Map<String, JSONObject> entries = new LinkedHashMap<>();
    private final Map<String, PendingFile> pending = new ConcurrentHashMap<>();
    public TransferStore(File root) throws Exception {
        this.root = root.getCanonicalFile();
        if (!this.root.isDirectory() && !this.root.mkdirs()) throw new IOException("无法创建接收目录");
        File[] metadata = this.root.listFiles((dir, name) -> name.matches("[a-f0-9-]{36}\\.json"));
        if (metadata != null) for (File file : metadata) {
            try {
                JSONObject item = new JSONObject(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8));
                String id = item.getString("id");
                if (id.matches("[a-f0-9-]{36}") && data(id).isFile()) entries.put(id, item);
            } catch (Exception ignored) { }
        }
    }
    private File data(String id) { return new File(root, id + ".data"); }
    public File file(String id) throws Exception {
        synchronized (this) { if (!entries.containsKey(id)) throw new FileNotFoundException("文件已不在接收目录"); }
        return data(id);
    }
    public synchronized JSONObject entry(String id) { return entries.get(id); }
    public synchronized JSONArray list(boolean owner) throws Exception {
        List<JSONObject> sorted = new ArrayList<>(entries.values());
        sorted.sort((a, b) -> Long.compare(b.optLong("createdAt"), a.optLong("createdAt")));
        JSONArray result = new JSONArray();
        for (JSONObject item : sorted) if (owner || "outgoing".equals(item.optString("direction"))) result.put(item);
        return result;
    }
    public JSONArray progress() throws Exception {
        JSONArray list = new JSONArray();
        for (PendingFile job : pending.values()) list.put(new JSONObject().put("id", job.id).put("name", job.name)
            .put("size", job.size).put("received", job.received).put("direction", job.direction));
        return list;
    }
    public JSONObject saveText(String text, boolean outgoing) throws Exception {
        byte[] bytes = text.getBytes(StandardCharsets.UTF_8);
        if (bytes.length > 2 * 1024 * 1024) throw new IOException("文字过长，请拆分为多次发送");
        if (text.trim().isEmpty()) throw new IOException("先输入要发送的文字");
        return receive("文字片段", bytes.length, new ByteArrayInputStream(bytes), outgoing, true);
    }
    public JSONObject receive(String name, long size, InputStream input, boolean outgoing, boolean text) throws Exception {
        if (size > root.getUsableSpace() - 4 * 1024 * 1024) throw new IOException("接收空间不足，请先清理空间");
        String displayName = name.replaceAll("[\\p{Cntrl}]", "_").trim();
        if (displayName.isEmpty()) displayName = "未命名文件";
        if (displayName.length() > 240) displayName = displayName.substring(0, 240);
        PendingFile job = new PendingFile(displayName, size, outgoing ? "outgoing" : "incoming", input);
        File part = new File(root, job.id + ".part");
        pending.put(job.id, job);
        try {
            try (OutputStream output = new BufferedOutputStream(new FileOutputStream(part))) {
                byte[] buffer = new byte[32 * 1024];
                long nextSpaceCheck = 0;
                while (size < 0 || job.received < size) {
                    if (job.cancelled) throw new IOException("传输已取消");
                    int length = input.read(buffer, 0, size < 0 ? buffer.length : (int) Math.min(buffer.length, size - job.received));
                    if (length < 0) { if (size < 0) break; throw new EOFException("连接中断，请重新发送这个文件"); }
                    if (job.received >= nextSpaceCheck) {
                        if (root.getUsableSpace() < length + 4 * 1024 * 1024) throw new IOException("接收空间不足，请先清理空间");
                        nextSpaceCheck = job.received + 1024 * 1024;
                    }
                    output.write(buffer, 0, length);
                    job.received += length;
                }
            }
            if (job.cancelled) throw new IOException("传输已取消");
            Files.move(part.toPath(), data(job.id).toPath(), StandardCopyOption.REPLACE_EXISTING);
            JSONObject item = new JSONObject().put("id", job.id).put("name", displayName).put("size", job.received)
                .put("kind", text ? "text" : "file").put("direction", job.direction).put("createdAt", System.currentTimeMillis());
            if (text) {
                String body = new String(Files.readAllBytes(data(job.id).toPath()), StandardCharsets.UTF_8);
                item.put("preview", body.substring(0, Math.min(160, body.length())));
            }
            File meta = new File(root, job.id + ".json");
            Files.write(meta.toPath(), item.toString().getBytes(StandardCharsets.UTF_8));
            synchronized (this) { entries.put(job.id, item); }
            return item;
        } finally {
            pending.remove(job.id);
            Files.deleteIfExists(part.toPath());
        }
    }
    public void cancel(String id) {
        PendingFile job = pending.get(id);
        if (job != null) {
            job.cancelled = true;
            try { job.input.close(); } catch (IOException ignored) { }
        }
    }
    public void cancelAll() { for (String id : pending.keySet()) cancel(id); }
    public synchronized void remove(String id) throws Exception {
        if (!entries.containsKey(id)) return;
        Files.deleteIfExists(data(id).toPath());
        Files.deleteIfExists(new File(root, id + ".json").toPath());
        entries.remove(id);
    }
    private static final class PendingFile {
        final String id = UUID.randomUUID().toString();
        final String name, direction;
        final long size;
        final InputStream input;
        volatile long received;
        volatile boolean cancelled;
        PendingFile(String name, long size, String direction, InputStream input) {
            this.name = name; this.size = size; this.direction = direction; this.input = input;
        }
    }
}
