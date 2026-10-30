package com.campinity.app;

import android.app.UiModeManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands Campinity's in-app theme choice (stored in the WebView's
 * localStorage, which Android cannot read at launch) to Android as this
 * app's own night mode.
 *
 * Android 12+ draws the launch splash (values-v31/styles.xml) before any
 * app code runs, resolving @color/splash_background against the app's
 * night mode — which, without this, is simply the phone's. So a phone in
 * dark mode always showed a dark splash even with Campinity set to Light.
 * UiModeManager.setApplicationNightMode() is persisted by the system and
 * used for the next launch's splash screen, so the splash follows the
 * theme saved last time the app ran.
 *
 * Called from src/theme/nativeAppTheme.js whenever the theme mode changes.
 * Android 11 and older have no per-app night mode: their pre-API-31
 * launch background keeps following the phone's setting.
 */
@CapacitorPlugin(name = "AppTheme")
public class AppThemePlugin extends Plugin {

    @PluginMethod
    public void setNightMode(PluginCall call) {
        String mode = call.getString("mode", "system");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            int nightMode;
            if ("dark".equals(mode)) {
                nightMode = UiModeManager.MODE_NIGHT_YES;
            } else if ("light".equals(mode)) {
                nightMode = UiModeManager.MODE_NIGHT_NO;
            } else {
                // "system": follow the phone again.
                nightMode = UiModeManager.MODE_NIGHT_AUTO;
            }
            UiModeManager uiModeManager = (UiModeManager) getContext().getSystemService(Context.UI_MODE_SERVICE);
            uiModeManager.setApplicationNightMode(nightMode);
        }
        call.resolve();
    }
}
