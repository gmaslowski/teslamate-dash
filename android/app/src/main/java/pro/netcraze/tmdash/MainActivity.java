package pro.netcraze.tmdash;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.HttpAuthHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;

public class MainActivity extends Activity {

    private WebView webView;
    private ProgressBar progressBar;
    private String homeUrl = "";
    private String homeHost = "";
    private String savedLogin = "";
    private String savedPass = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        SharedPreferences prefs = getSharedPreferences(SetupActivity.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean(SetupActivity.KEY_CONFIGURED, false)) {
            startActivity(new Intent(this, SetupActivity.class));
            finish();
            return;
        }
        homeUrl = prefs.getString(SetupActivity.KEY_URL, "");
        if (homeUrl.isEmpty()) {
            startActivity(new Intent(this, SetupActivity.class));
            finish();
            return;
        }
        savedLogin = prefs.getString(SetupActivity.KEY_LOGIN, "");
        savedPass = prefs.getString(SetupActivity.KEY_PASS, "");
        Uri u = Uri.parse(homeUrl);
        if (u.getHost() != null) {
            homeHost = u.getHost();
        }

        webView = new WebView(this);
        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        progressBar.setVisibility(View.GONE);
        FrameLayout.LayoutParams pbParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                (int) (3 * getResources().getDisplayMetrics().density));
        pbParams.gravity = android.view.Gravity.TOP;

        FrameLayout root = new FrameLayout(this);
        root.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        root.addView(progressBar, pbParams);
        setContentView(root);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                Uri parsed = Uri.parse(url);
                if (("http".equals(parsed.getScheme()) || "https".equals(parsed.getScheme()))
                        && parsed.getHost() != null
                        && parsed.getHost().equals(homeHost)) {
                    return false; // same site — stay in the app
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
                return true; // external links go to the default browser
            }

            @Override
            public void onReceivedHttpAuthRequest(WebView view, HttpAuthHandler handler,
                                                  String host, String realm) {
                if (!savedLogin.isEmpty() && !savedPass.isEmpty()) {
                    handler.proceed(savedLogin, savedPass);
                } else {
                    // No saved credentials — ask manually.
                    showAuthDialog(handler);
                }
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    view.loadDataWithBaseURL(homeUrl,
                            "<html><body style=\"background:#111318;color:#e9eaee;"
                                    + "font-family:sans-serif;text-align:center;padding-top:40%\">"
                                    + "<h2>No connection</h2>"
                                    + "<p><a href=\"" + homeUrl + "\" style=\"color:#4f6bc0\">Retry</a></p>"
                                    + "</body></html>",
                            "text/html", "utf-8", null);
                }
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress >= 100) {
                    progressBar.setVisibility(View.GONE);
                } else {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                }
            }
        });

        hideSystemBars();
        webView.loadUrl(homeUrl);
    }

    private void showAuthDialog(final HttpAuthHandler handler) {
        LinearLayout layout = new LinearLayout(this);
        layout.setOrientation(LinearLayout.VERTICAL);
        int pad = (int) (24 * getResources().getDisplayMetrics().density);
        layout.setPadding(pad, 0, pad, 0);

        final EditText user = new EditText(this);
        user.setHint("Login");
        final EditText pass = new EditText(this);
        pass.setHint("Password");
        pass.setInputType(android.text.InputType.TYPE_CLASS_TEXT
                | android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);

        layout.addView(user);
        layout.addView(pass);

        new AlertDialog.Builder(this)
                .setTitle("Authentication required")
                .setView(layout)
                .setPositiveButton("OK", (d, w) ->
                        handler.proceed(user.getText().toString(), pass.getText().toString()))
                .setNegativeButton("Cancel", (d, w) -> handler.cancel())
                .setOnCancelListener(d -> handler.cancel())
                .show();
    }

    private void hideSystemBars() {
        View decor = getWindow().getDecorView();
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setStatusBarColor(0xFF111318);
            getWindow().setNavigationBarColor(0xFF111318);
            decor.getWindowInsetsController().hide(
                    android.view.WindowInsets.Type.statusBars()
                            | android.view.WindowInsets.Type.navigationBars());
            decor.getWindowInsetsController().setSystemBarsBehavior(
                    android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } else {
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
