package cn.ikun.music.device;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Bundle;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import com.google.zxing.BarcodeFormat;
import com.journeyapps.barcodescanner.BarcodeCallback;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.journeyapps.barcodescanner.DefaultDecoderFactory;
import com.journeyapps.barcodescanner.CameraPreview;
import java.util.Collections;

/** 相机、对焦及解码复用 ZXing；这里只负责互传扫码的界面和一次性结果。 */
public final class TransferScanActivity extends Activity {
    private DecoratedBarcodeView scanner;
    private boolean completed, torch;
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(15, 23, 21));
        getWindow().setNavigationBarColor(Color.rgb(15, 23, 21));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(15, 23, 21));
        scanner = new DecoratedBarcodeView(this);
        scanner.setStatusText("");
        scanner.getViewFinder().setLaserVisibility(false);
        scanner.getViewFinder().setMaskColor(0x880F1715);
        scanner.getBarcodeView().addStateListener(new CameraPreview.StateListener() {
            @Override public void previewSized() { }
            @Override public void previewStarted() { }
            @Override public void previewStopped() { }
            @Override public void cameraClosed() { }
            @Override public void cameraError(Exception error) {
                if (completed) return;
                completed = true;
                DeviceKit.scanned(null, "相机暂时无法打开，请关闭其他占用相机的应用后重试。 ");
                finish();
            }
        });
        scanner.getBarcodeView().setDecoderFactory(new DefaultDecoderFactory(Collections.singletonList(BarcodeFormat.QR_CODE)));
        root.addView(scanner, new FrameLayout.LayoutParams(-1, -1));
        LinearLayout header = new LinearLayout(this);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.setPadding(dp(20), dp(16), dp(20), dp(16));
        header.setBackgroundColor(0xDD0F1715);
        TextView back = label("返回", 15);
        back.setPadding(dp(12), dp(12), dp(20), dp(12));
        back.setOnClickListener(view -> finish());
        header.addView(back);
        header.addView(label("扫码连接", 20));
        root.addView(header, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
        LinearLayout footer = new LinearLayout(this);
        footer.setOrientation(LinearLayout.VERTICAL);
        footer.setGravity(Gravity.CENTER);
        footer.setPadding(dp(24), dp(20), dp(24), dp(32));
        footer.setBackgroundColor(0xDD0F1715);
        footer.addView(label("对准另一台设备的互传二维码", 17));
        TextView hint = label("连接同一 Wi-Fi 或热点，识别后自动配对", 13);
        hint.setTextColor(0xFFBAC9C2);
        hint.setPadding(0, dp(12), 0, dp(20));
        footer.addView(hint);
        if (getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_FLASH)) {
            TextView light = label("打开补光灯", 15);
            light.setTextColor(0xFF55DF98);
            light.setPadding(dp(24), dp(14), dp(24), dp(14));
            light.setOnClickListener(view -> {
                torch = !torch;
                if (torch) scanner.setTorchOn(); else scanner.setTorchOff();
                light.setText(torch ? "关闭补光灯" : "打开补光灯");
            });
            footer.addView(light);
        }
        root.addView(footer, new FrameLayout.LayoutParams(-1, -2, Gravity.BOTTOM));
        setContentView(root);
        scanner.decodeSingle(new BarcodeCallback() {
            @Override public void barcodeResult(BarcodeResult result) {
                if (completed) return;
                completed = true;
                DeviceKit.scanned(result.getText(), null);
                finish();
            }
        });
        if (!getPackageManager().hasSystemFeature(PackageManager.FEATURE_CAMERA_ANY)) {
            completed = true;
            DeviceKit.scanned(null, "这台设备没有相机，可在浏览器输入另一台设备的互传地址。 ");
            finish();
        } else if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.CAMERA}, 201);
        }
    }
    private TextView label(String text, int size) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(0xFFF3F8F5);
        return view;
    }
    @Override protected void onResume() {
        super.onResume();
        if (scanner != null && !completed && checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) scanner.resume();
    }
    @Override protected void onPause() {
        if (scanner != null) scanner.pause();
        super.onPause();
    }
    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request != 201) return;
        if (results.length > 0 && results[0] == PackageManager.PERMISSION_GRANTED) scanner.resume();
        else {
            completed = true;
            DeviceKit.scanned(null, "扫码需要相机权限，请在系统设置中允许，或用浏览器输入互传地址。 ");
            finish();
        }
    }
    @Override protected void onDestroy() {
        if (isFinishing() && !completed) DeviceKit.scanned(null, null);
        super.onDestroy();
    }
}
