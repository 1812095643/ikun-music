package cn.ikun.music.device;

import android.app.Activity;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.media.MediaMetadataRetriever;
import cn.ikun.music.transfer.TransferHost;
import cn.ikun.music.transfer.TransferStore;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;

/** Native.js 的薄桥接层：系统文件权限、Media3 和局域网服务共用这个入口。 */
public final class DeviceKit {
    static Activity activity;
    static TransferHost host;
    static final ExecutorService worker = Executors.newSingleThreadExecutor();
    private static volatile String transferState = "{\"running\":false}";
    private static volatile String operation = "{\"status\":\"idle\"}";
    private static int generation;
    public static String version() { return "1"; }
    public static void initialize(Activity value) { activity = value; }
    public static String audioState() { return AndroidAudio.snapshot(); }
    public static String spectrum() { return AndroidAudio.analyzer.snapshot(); }
    public static void setSpectrumEnabled(boolean enabled) { AndroidAudio.analyzer.setEnabled(enabled); }
    public static void audioCommand(String payload) {
        if (activity == null) return;
        MusicPlaybackService.dispatch(activity.getApplicationContext(), payload);
    }
    public static void startTransfer(String root, String site) {
        activity.getSharedPreferences("ikun-device", Context.MODE_PRIVATE).edit().putString("inbox", root).apply();
        final int version = ++generation;
        transferState = "{\"running\":false,\"starting\":true}";
        worker.execute(() -> {
            try {
                if (host != null) host.stop();
                File web = new File(site);
                if (!web.isDirectory() && !web.mkdirs()) throw new IOException("无法准备互传页面");
                for (String name : new String[]{"index.html", "portal.css", "portal.js", "brand.png"}) {
                    try (InputStream input = activity.getAssets().open("ikun-transfer/" + name); OutputStream output = new FileOutputStream(new File(web, name))) { copy(input, output); }
                }
                TransferHost next = new TransferHost(new File(root), new File(site));
                next.start(30000, false);
                if (version != generation) { next.stop(); return; }
                host = next;
                transferState = next.localInfo().toString();
            } catch (Exception error) { transferState = problem(error); }
        });
    }
    public static void stopTransfer() {
        generation++;
        transferState = "{\"running\":false}";
        TransferHost current = host;
        if (current != null) new Thread(current::stop, "ikun-transfer-stop").start();
    }
    public static String transferInfo() { return transferState; }
    public static String operationState() { return operation; }
    public static void scanMusic() {
        operation = "{\"status\":\"working\",\"kind\":\"scan\"}";
        worker.execute(() -> {
            try {
                JSONArray tracks = new JSONArray();
                Uri collection = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI;
                String[] columns = {"_id", "title", "artist", "album", "duration", "_size", "_display_name"};
                try (Cursor cursor = activity.getContentResolver().query(collection, columns, "duration > 0", null, "title ASC")) {
                    if (cursor != null) while (cursor.moveToNext()) {
                        Uri uri = ContentUris.withAppendedId(collection, cursor.getLong(0));
                        tracks.put(track(uri.toString(), cursor.getString(1), cursor.getString(2), cursor.getString(3), cursor.getLong(4), cursor.getLong(5)));
                    }
                } catch (SecurityException ignored) { }
                // 互传文件位于应用私有目录，不会被媒体库扫描到，合并真实收到的音频对象。
                String inbox = activity.getSharedPreferences("ikun-device", Context.MODE_PRIVATE).getString("inbox", "");
                if (host != null || !inbox.isEmpty()) {
                    TransferStore receivedStore = host != null ? host.store() : new TransferStore(new File(inbox));
                    JSONArray received = receivedStore.list(true);
                    for (int i = 0; i < received.length(); i++) {
                        JSONObject item = received.getJSONObject(i);
                        String name = item.optString("name");
                        if (name.toLowerCase(Locale.ROOT).matches(".*\\.(mp3|flac|wav|m4a|aac|ogg|opus|wma|ape)$")) {
                            File file = receivedStore.file(item.getString("id"));
                            tracks.put(readTrack(Uri.fromFile(file), name));
                        }
                    }
                }
                operation = new JSONObject().put("status", "completed").put("kind", "scan").put("tracks", tracks).toString();
            } catch (Exception error) { operation = problem(error); }
        });
    }
    public static void chooseFiles(String mode) {
        operation = "{\"status\":\"working\"}";
        activity.startActivity(new Intent(activity, FilePickerActivity.class).putExtra("mode", mode));
    }
    public static void exportFile(String id) {
        operation = "{\"status\":\"working\"}";
        activity.startActivity(new Intent(activity, FilePickerActivity.class).putExtra("mode", "export").putExtra("id", id));
    }
    static void selected(String mode, String id, java.util.List<Uri> files) {
        worker.execute(() -> {
            try {
                if (files.isEmpty()) { operation = "{\"status\":\"cancelled\"}"; return; }
                JSONArray tracks = new JSONArray();
                for (Uri uri : files) {
                    if (mode.equals("export")) {
                        if (host == null) throw new IOException("请先打开互传记录");
                        try (InputStream input = new FileInputStream(host.store().file(id)); OutputStream output = activity.getContentResolver().openOutputStream(uri)) {
                            copy(input, output);
                        }
                    } else {
                        try { activity.getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION); } catch (SecurityException ignored) { }
                        String name = "未命名文件"; long size = -1;
                        try (Cursor cursor = activity.getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE}, null, null, null)) {
                            if (cursor != null && cursor.moveToFirst()) { name = cursor.getString(0); size = cursor.isNull(1) ? -1 : cursor.getLong(1); }
                        }
                        if (mode.equals("audio")) tracks.put(readTrack(uri, name));
                        else {
                            if (host == null || !host.isAlive()) throw new IOException("请先开启局域网互传");
                            try (InputStream input = activity.getContentResolver().openInputStream(uri)) { host.store().receive(name, size, input, true, false); }
                        }
                    }
                }
                operation = new JSONObject().put("status", "completed").put("kind", mode).put("tracks", tracks).toString();
            } catch (Exception error) { operation = problem(error); }
        });
    }
    static JSONObject readTrack(Uri uri, String name) throws Exception {
        String title = name.replaceFirst("\\.[^.]+$", ""), artist = "本地音乐", album = ""; long duration = 0, size = 0;
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(activity, uri);
            String value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_TITLE); if (value != null && !value.isEmpty()) title = value;
            value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ARTIST); if (value != null && !value.isEmpty()) artist = value;
            value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_ALBUM); if (value != null) album = value;
            value = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION); if (value != null) duration = Long.parseLong(value);
        } catch (Exception ignored) { }
        finally { retriever.release(); }
        return track(uri.toString(), title, artist, album, duration, size);
    }
    private static JSONObject track(String uri, String title, String artist, String album, long duration, long size) throws Exception {
        return new JSONObject().put("id", "local:" + UUID.nameUUIDFromBytes(uri.getBytes(StandardCharsets.UTF_8)))
            .put("title", title == null ? "未命名音乐" : title).put("artist", artist == null || artist.equals("<unknown>") ? "本地音乐" : artist)
            .put("album", album == null ? "" : album).put("cover", "").put("duration", duration / 1000.0).put("localUri", uri).put("fileSize", size);
    }
    static String problem(Exception error) {
        try { return new JSONObject().put("status", "error").put("running", false).put("message", error.getMessage() == null ? "操作未完成，请重试" : error.getMessage()).toString(); }
        catch (Exception ignored) { return "{\"status\":\"error\"}"; }
    }
    static void copy(InputStream input, OutputStream output) throws IOException {
        if (input == null || output == null) throw new IOException("无法打开所选文件");
        byte[] bytes = new byte[32768]; int count;
        while ((count = input.read(bytes)) != -1) output.write(bytes, 0, count);
    }
}
