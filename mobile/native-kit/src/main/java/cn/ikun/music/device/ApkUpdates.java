package cn.ikun.music.device;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.os.Build;
import java.io.File;
import java.io.FileInputStream;
import java.security.MessageDigest;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONObject;

final class ApkUpdates {
    static String verify(Context context, String payload) {
        try {
            JSONObject input = new JSONObject(payload);
            File file = new File(input.getString("path")).getCanonicalFile();
            File externalFiles = context.getExternalFilesDir(null);
            // DCloud 的 _doc 位于应用外部私有目录 apps 下，与 Android 的 files 目录同级。
            File externalApps = externalFiles == null ? null : new File(externalFiles.getParentFile(), "apps");
            if (!within(file, context.getFilesDir()) && !within(file, externalFiles) && !within(file, externalApps)) {
                throw new IllegalArgumentException("请重新下载应用内的更新安装包。");
            }
            if (!file.isFile() || file.length() != input.getLong("size")) {
                throw new IllegalArgumentException("安装包尚未下载完整，请重新下载。");
            }
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (FileInputStream stream = new FileInputStream(file)) {
                byte[] buffer = new byte[65536];
                int count;
                while ((count = stream.read(buffer)) != -1) digest.update(buffer, 0, count);
            }
            StringBuilder actual = new StringBuilder();
            for (byte value : digest.digest()) actual.append(String.format(java.util.Locale.ROOT, "%02x", value & 255));
            if (!actual.toString().equalsIgnoreCase(input.getString("sha256"))) {
                throw new IllegalArgumentException("安装包校验未通过，请重新下载。");
            }
            PackageManager manager = context.getPackageManager();
            int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo candidate = manager.getPackageArchiveInfo(file.getPath(), flags);
            PackageInfo installed = manager.getPackageInfo(context.getPackageName(), flags);
            if (candidate == null || !context.getPackageName().equals(candidate.packageName)
                || !input.getString("version").equals(candidate.versionName)) {
                throw new IllegalArgumentException("安装包与当前应用或目标版本不匹配，请重新检查更新。");
            }
            long next = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
            long current = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
            if (next <= current) throw new IllegalArgumentException("当前版本已经更新，请重新打开应用。");
            Set<String> expected = signatures(installed);
            if (expected.isEmpty() || !expected.equals(signatures(candidate))) {
                throw new IllegalArgumentException("安装包签名与当前应用不同，无法覆盖更新。");
            }
            return new JSONObject().put("ok", true).toString();
        } catch (Exception error) {
            try { return new JSONObject().put("ok", false).put("message", error.getMessage()).toString(); }
            catch (Exception ignored) { return "{\"ok\":false}"; }
        }
    }

    private static boolean within(File file, File directory) throws Exception {
        return directory != null && file.getPath().startsWith(directory.getCanonicalPath() + File.separator);
    }

    private static Set<String> signatures(PackageInfo info) {
        Signature[] values = Build.VERSION.SDK_INT >= 28 && info.signingInfo != null
            ? info.signingInfo.getApkContentsSigners() : info.signatures;
        Set<String> result = new HashSet<>();
        if (values != null) for (Signature value : values) result.add(value.toCharsString());
        return result;
    }
}
