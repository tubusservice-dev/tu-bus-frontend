package com.tubusexpress.app;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import com.getcapacitor.BridgeActivity;

import java.util.Locale;

/**
 * Custom bridge activity that fixes the Android WebView's failure to
 * expose `env(safe-area-inset-*)` to CSS.
 *
 * Background
 * ----------
 * On iOS WKWebView, declaring `<meta name="viewport" content="viewport-fit=cover">`
 * is enough — the WebView propagates the device notch / home indicator
 * insets to the page as CSS `env(safe-area-inset-*)` automatically.
 *
 * The Android WebView does NOT do this. The page can declare viewport-fit
 * but `env(safe-area-inset-top)` resolves to 0px on every Android version
 * (7-16) unless native code explicitly captures the system window insets
 * and forwards them to the page. Without that bridge, every page element
 * that depends on safe-area math (sticky headers, fullscreen modals,
 * floating buttons) ends up painted under the status bar or gesture / nav
 * bar.
 *
 * What this class does
 * --------------------
 *   1. Forces edge-to-edge layout via `WindowCompat.setDecorFitsSystemWindows`
 *      on every Android version. Android 15+ already enforces this when
 *      targetSdk >= 35; calling it explicitly normalizes Android 7-14 to
 *      the same model so the CSS only has one rendering contract to honor.
 *
 *   2. Attaches an `OnApplyWindowInsetsListener` to the decor view that
 *      reads the union of `systemBars` (status + nav) and `displayCutout`
 *      (notches / punch-holes). The union is important on devices where
 *      the notch sits beside the status bar and is taller than it.
 *
 *   3. Converts the pixel insets to CSS pixels using the display density
 *      and injects them as CSS custom properties on `<html>` via
 *      `evaluateJavascript`. The page already declares fallback values:
 *
 *        :root {
 *          --safe-area-top: env(safe-area-inset-top, 0px);
 *          ...
 *        }
 *
 *      Once this activity runs `setProperty('--safe-area-top', '30px')`
 *      that inline style wins over the `:root` rule (inline beats class)
 *      and the entire CSS layer that consumes `var(--safe-area-*)` starts
 *      receiving correct values.
 *
 *   4. Re-runs on every insets change (orientation, IME show/hide,
 *      multi-window, foldable hinge, gesture pill resize) so the layout
 *      stays correct without page reload.
 *
 * Supported range
 * ---------------
 * Android 7.0 (API 24) through Android 16 (API 36). Display-cutout insets
 * are zero on API < 28 because devices that old have no notch.
 */
public class MainActivity extends BridgeActivity {

    /** Last applied insets, in CSS pixels. Used to avoid redundant JS calls. */
    private int lastTop = -1;
    private int lastBottom = -1;
    private int lastLeft = -1;
    private int lastRight = -1;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Step 1 — Force edge-to-edge so the WebView controls the full
        // screen surface. Necessary on Android < 15; idempotent on >= 15.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Step 2-3 — Capture system insets and forward them to the page.
        final View decor = getWindow().getDecorView();
        ViewCompat.setOnApplyWindowInsetsListener(decor, (v, windowInsets) -> {
            // Combine system bars (status + nav) with the display cutout
            // so devices with tall notches expose the full safe area.
            int mask = WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout();
            Insets insets = windowInsets.getInsets(mask);

            float density = getResources().getDisplayMetrics().density;
            int top = Math.round(insets.top / density);
            int bottom = Math.round(insets.bottom / density);
            int left = Math.round(insets.left / density);
            int right = Math.round(insets.right / density);

            // Skip the JS bridge call when nothing changed to avoid
            // re-flowing CSS on every meaningless inset notification.
            if (top != lastTop || bottom != lastBottom
                    || left != lastLeft || right != lastRight) {
                lastTop = top;
                lastBottom = bottom;
                lastLeft = left;
                lastRight = right;
                applySafeAreaToWebView(top, bottom, left, right);
            }

            // Returning the original insets keeps the rest of the view
            // tree behavior intact. We are not consuming the insets.
            return windowInsets;
        });
    }

    /**
     * Pushes the current safe-area inset values into the page as CSS
     * custom properties on the `<html>` element. The IIFE guards against
     * an early invocation before the document is parsed (the listener
     * can fire before the WebView has finished loading on cold start) by
     * deferring to DOMContentLoaded in that case.
     */
    private void applySafeAreaToWebView(int top, int bottom, int left, int right) {
        WebView webView = (this.bridge != null) ? this.bridge.getWebView() : null;
        if (webView == null) return;

        final String js = String.format(Locale.US,
                "(function(){"
                        + "function apply(){"
                        + "  var s=document.documentElement&&document.documentElement.style;"
                        + "  if(!s)return false;"
                        + "  s.setProperty('--safe-area-top','%dpx');"
                        + "  s.setProperty('--safe-area-bottom','%dpx');"
                        + "  s.setProperty('--safe-area-left','%dpx');"
                        + "  s.setProperty('--safe-area-right','%dpx');"
                        + "  return true;"
                        + "}"
                        + "if(!apply()){"
                        + "  document.addEventListener('DOMContentLoaded',apply,{once:true});"
                        + "}"
                        + "})();",
                top, bottom, left, right);

        // evaluateJavascript runs on the WebView thread; safe to call
        // from the insets listener which fires on the UI thread.
        webView.evaluateJavascript(js, null);
    }
}
