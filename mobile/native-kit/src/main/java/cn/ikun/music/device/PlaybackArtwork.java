package cn.ikun.music.device;

import android.content.Context;
import android.graphics.Bitmap;
import android.net.Uri;
import androidx.media3.common.util.BitmapLoader;
import androidx.media3.datasource.DataSourceBitmapLoader;
import androidx.media3.datasource.DefaultDataSource;
import androidx.media3.datasource.DefaultHttpDataSource;
import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;
import com.google.common.util.concurrent.ListeningExecutorService;
import com.google.common.util.concurrent.MoreExecutors;
import java.util.Collections;
import java.util.concurrent.Executors;

/** 会话与通知共用 Media3 加载器；音源站图片需要请求头和跨协议跳转，不能沿用默认空配置。 */
final class PlaybackArtwork implements BitmapLoader {
    static final Uri FALLBACK = Uri.parse("asset:///ikun-transfer/brand.png");
    private final ListeningExecutorService executor = MoreExecutors.listeningDecorator(Executors.newSingleThreadExecutor());
    private final DataSourceBitmapLoader loader;

    PlaybackArtwork(Context context) {
        DefaultHttpDataSource.Factory http = new DefaultHttpDataSource.Factory()
            .setUserAgent("okhttp/3.10.0").setAllowCrossProtocolRedirects(true)
            .setConnectTimeoutMs(8000).setReadTimeoutMs(8000)
            .setDefaultRequestProperties(Collections.singletonMap("Referer", "http://www.kuwo.cn/"));
        // 限制解码尺寸，避免高清原图占满通知 Binder 或后台堆内存。
        loader = new DataSourceBitmapLoader(executor, new DefaultDataSource.Factory(context, http), null, 512);
    }
    @Override public boolean supportsMimeType(String mimeType) { return loader.supportsMimeType(mimeType); }
    @Override public ListenableFuture<Bitmap> decodeBitmap(byte[] data) {
        return fallback(loader.decodeBitmap(data));
    }
    @Override public ListenableFuture<Bitmap> loadBitmap(Uri uri) {
        return fallback(loader.loadBitmap(uri));
    }
    private ListenableFuture<Bitmap> fallback(ListenableFuture<Bitmap> future) {
        return Futures.catchingAsync(future, Exception.class, error -> loader.loadBitmap(FALLBACK), MoreExecutors.directExecutor());
    }
    void close() { executor.shutdownNow(); }
}
