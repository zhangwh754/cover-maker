package com.covermaker.app;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;

@CapacitorPlugin(name = "CoverFiles")
public class CoverFilesPlugin extends Plugin {
    @PluginMethod public void saveImage(PluginCall call) {
        if (Build.VERSION.SDK_INT < 29) {
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType(call.getString("mime", "image/png"));
            intent.putExtra(Intent.EXTRA_TITLE, call.getString("filename", "cover.png"));
            startActivityForResult(call, intent, "documentCreated");
            return;
        }
        getBridge().execute(() -> {
            Uri uri = null;
            try {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, call.getString("filename"));
                values.put(MediaStore.Images.Media.MIME_TYPE, call.getString("mime"));
                values.put(MediaStore.Images.Media.RELATIVE_PATH, "Pictures/DailyRecommend");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
                uri = getContext().getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
                if (uri == null) throw new Exception("无法创建图片");
                write(uri, call.getString("data"));
                values.clear(); values.put(MediaStore.Images.Media.IS_PENDING, 0);
                getContext().getContentResolver().update(uri, values, null, null);
                JSObject result = new JSObject();
                result.put("location", "相册（Pictures/DailyRecommend）");
                call.resolve(result);
            } catch (Exception error) {
                if (uri != null) getContext().getContentResolver().delete(uri, null, null);
                call.reject("保存失败：" + error.getMessage());
            }
        });
    }
    private void write(Uri uri, String data) throws Exception {
        try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri)) {
            if (stream == null) throw new Exception("无法写入目标位置");
            stream.write(Base64.decode(data, Base64.DEFAULT));
        }
    }
    @ActivityCallback private void documentCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) { call.reject("已取消保存", "SAVE_CANCELLED"); return; }
        try {
            write(result.getData().getData(), call.getString("data"));
            JSObject saved = new JSObject(); saved.put("location", "所选位置"); call.resolve(saved);
        }
        catch (Exception error) { call.reject("保存失败：" + error.getMessage()); }
    }
    @PluginMethod public void importImage(PluginCall call) {
        getBridge().execute(() -> {
            try {
                URL url = new URL(call.getString("url", ""));
                for (int redirect = 0; redirect <= 4; redirect++) {
                    URI parsed = url.toURI();
                    if (!"https".equalsIgnoreCase(parsed.getScheme()) || parsed.getUserInfo() != null) throw new Exception("只支持 HTTPS 图片直链");
                    HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                    connection.setConnectTimeout(10000); connection.setReadTimeout(15000);
                    connection.setInstanceFollowRedirects(false);
                    try {
                        int status = connection.getResponseCode();
                        if (status >= 300 && status < 400) {
                            if (redirect == 4) throw new Exception("跳转次数过多");
                            url = new URL(url, connection.getHeaderField("Location")); continue;
                        }
                        if (status != 200) throw new Exception("图片服务器返回 " + status);
                        if (connection.getContentLengthLong() > 20 * 1024 * 1024) throw new Exception("图片超过 20 MB");
                        String mime = connection.getContentType();
                        if (mime == null || !mime.toLowerCase().startsWith("image/")) throw new Exception("链接没有返回图片");
                        try (InputStream input = connection.getInputStream(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                            byte[] buffer = new byte[8192]; int length;
                            long deadline = System.currentTimeMillis() + 30000;
                            while ((length = input.read(buffer)) != -1) {
                                if (output.size() + length > 20 * 1024 * 1024) throw new Exception("图片超过 20 MB");
                                if (System.currentTimeMillis() > deadline) throw new Exception("图片下载超时");
                                output.write(buffer, 0, length);
                            }
                            JSObject result = new JSObject(); result.put("mime", mime.split(";")[0]);
                            result.put("data", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)); call.resolve(result); return;
                        }
                    } finally { connection.disconnect(); }
                }
            } catch (Exception error) { call.reject("导入失败：" + error.getMessage()); }
        });
    }
}
