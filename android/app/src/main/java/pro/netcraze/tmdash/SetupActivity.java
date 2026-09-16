package pro.netcraze.tmdash;

import android.app.Activity;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public class SetupActivity extends Activity {

    public static final String PREFS = "tmdash_prefs";
    public static final String KEY_URL = "tmdash_url";
    public static final String KEY_LOGIN = "tmdash_login";
    public static final String KEY_PASS = "tmdash_pass";
    public static final String KEY_CONFIGURED = "tmdash_configured";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(0xFF111318);
        getWindow().setNavigationBarColor(0xFF111318);

        float density = getResources().getDisplayMetrics().density;
        int pad = (int) (24 * density);

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, (int) (48 * density), pad, pad);
        root.setBackgroundColor(0xFF111318);

        TextView title = new TextView(this);
        title.setText("TM Dash");
        title.setTextColor(0xFFe9eaee);
        title.setTextSize(24);
        root.addView(title);

        TextView hint = new TextView(this);
        hint.setText("Address of the dashboard. Login/password are for HTTP Basic Auth "
                + "(optional — leave empty if the server has auth disabled).");
        hint.setTextColor(0xFF7d818c);
        hint.setTextSize(14);
        LinearLayout.LayoutParams hintLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT);
        hintLp.setMargins(0, 8, 0, 24);
        root.addView(hint, hintLp);

        final EditText url = new EditText(this);
        url.setHint("Address (https://your-server/)");
        url.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        root.addView(url);

        final EditText login = new EditText(this);
        login.setHint("Login (optional)");
        root.addView(login);

        final EditText pass = new EditText(this);
        pass.setHint("Password (optional)");
        pass.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_PASSWORD);
        root.addView(pass);

        Button save = new Button(this);
        save.setText("Save & open");
        save.setAllCaps(false);
        root.addView(save);

        setContentView(root);

        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View v) {
                String u = url.getText().toString().trim();
                if (u.isEmpty()) {
                    url.setError("Address is required");
                    return;
                }
                if (!u.startsWith("http://") && !u.startsWith("https://")) {
                    u = "https://" + u;
                }

                SharedPreferences.Editor ed =
                        getSharedPreferences(PREFS, MODE_PRIVATE).edit();
                ed.putString(KEY_URL, u);
                ed.putString(KEY_LOGIN, login.getText().toString().trim());
                ed.putString(KEY_PASS, pass.getText().toString());
                ed.putBoolean(KEY_CONFIGURED, true);
                ed.apply();

                startActivity(new Intent(SetupActivity.this, MainActivity.class));
                finish();
            }
        });
    }
}
