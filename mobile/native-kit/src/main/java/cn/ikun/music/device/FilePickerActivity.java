package cn.ikun.music.device;

import android.app.Activity;
import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import java.util.ArrayList;
import java.util.List;

/** 系统选择器只授予用户选中文件的访问权，支持任意文件和持久音频 URI。 */
public final class FilePickerActivity extends Activity {
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) return;
        String mode = getIntent().getStringExtra("mode");
        Intent picker = new Intent("export".equals(mode) ? Intent.ACTION_CREATE_DOCUMENT : Intent.ACTION_OPEN_DOCUMENT);
        picker.addCategory(Intent.CATEGORY_OPENABLE);
        picker.setType("audio".equals(mode) ? "audio/*" : "*/*");
        picker.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, !"export".equals(mode));
        picker.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        if ("export".equals(mode) && DeviceKit.host != null) {
            org.json.JSONObject item = DeviceKit.host.store().entry(getIntent().getStringExtra("id"));
            if (item != null) picker.putExtra(Intent.EXTRA_TITLE, item.optString("name"));
        }
        try { startActivityForResult(picker, 100); }
        catch (Exception error) { DeviceKit.selected(mode, "", new ArrayList<>()); finish(); }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        List<Uri> selected = new ArrayList<>();
        if (result == RESULT_OK && data != null) {
            if (data.getClipData() != null) for (int i = 0; i < data.getClipData().getItemCount(); i++) selected.add(data.getClipData().getItemAt(i).getUri());
            else if (data.getData() != null) selected.add(data.getData());
        }
        DeviceKit.selected(getIntent().getStringExtra("mode"), getIntent().getStringExtra("id"), selected);
        finish();
    }
}
