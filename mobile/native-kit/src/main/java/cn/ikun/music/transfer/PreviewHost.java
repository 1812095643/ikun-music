package cn.ikun.music.transfer;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** 浏览器验收运行同一份传输内核，不模拟上传、落盘或下载结果。 */
public final class PreviewHost {
    public static void main(String[] args) throws Exception {
        File root = new File(args[0]);
        TransferHost host = new TransferHost(new File(root, "received"), new File(args[1]));
        host.start(30000, false);
        Files.write(new File(root, "runtime.json").toPath(), host.localInfo().toString().getBytes(StandardCharsets.UTF_8));
        Runtime.getRuntime().addShutdownHook(new Thread(host::stop));
        System.out.println("Transfer server started on port " + host.getListeningPort());
    }
}
