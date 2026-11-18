package com.campinity.admin;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyInfo;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyFactory;
import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.Signature;
import java.security.spec.ECGenParameterSpec;

/**
 * Admin device key, held in Android Keystore.
 *
 * - P-256 (secp256r1) ECDSA key, purpose SIGN only, SHA-256.
 * - Generated inside the Keystore (StrongBox secure element when the phone
 *   has one, otherwise the TEE). The private key is never exportable: this
 *   plugin only ever returns the PUBLIC key (X.509 SubjectPublicKeyInfo,
 *   base64) and signatures (DER, base64).
 * - Uninstalling the app or clearing its data destroys the key, so the
 *   device must then be enrolled again (by design).
 */
@CapacitorPlugin(name = "AdminDeviceKey")
public class AdminDeviceKeyPlugin extends Plugin {

    private static final String ALIAS = "campinity_admin_device_v1";
    private static final String PROVIDER = "AndroidKeyStore";

    private KeyStore keyStore() throws Exception {
        KeyStore ks = KeyStore.getInstance(PROVIDER);
        ks.load(null);
        return ks;
    }

    private void generate(boolean strongBox) throws Exception {
        KeyGenParameterSpec.Builder spec = new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_SIGN)
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256);
        if (strongBox && Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            spec.setIsStrongBoxBacked(true);
        }
        KeyPairGenerator generator = KeyPairGenerator.getInstance(KeyProperties.KEY_ALGORITHM_EC, PROVIDER);
        generator.initialize(spec.build());
        generator.generateKeyPair();
    }

    private void ensureKey(KeyStore ks) throws Exception {
        if (ks.containsAlias(ALIAS)) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                generate(true);
                return;
            } catch (Exception strongBoxUnavailable) {
                // No StrongBox on this phone: fall back to the TEE-backed keystore.
                try { ks.deleteEntry(ALIAS); } catch (Exception ignored) { }
            }
        }
        generate(false);
    }

    private boolean isHardwareBacked(KeyStore ks) {
        try {
            PrivateKey key = (PrivateKey) ks.getKey(ALIAS, null);
            KeyFactory factory = KeyFactory.getInstance(key.getAlgorithm(), PROVIDER);
            KeyInfo info = factory.getKeySpec(key, KeyInfo.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                return info.getSecurityLevel() != KeyProperties.SECURITY_LEVEL_SOFTWARE;
            }
            return info.isInsideSecureHardware();
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void getOrCreateKey(PluginCall call) {
        try {
            KeyStore ks = keyStore();
            ensureKey(ks);
            PublicKey publicKey = ks.getCertificate(ALIAS).getPublicKey();
            JSObject result = new JSObject();
            result.put("publicKeySpki", Base64.encodeToString(publicKey.getEncoded(), Base64.NO_WRAP));
            result.put("hardwareBacked", isHardwareBacked(ks));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not create the device key (" + e.getClass().getSimpleName() + ").");
        }
    }

    @PluginMethod
    public void sign(PluginCall call) {
        String message = call.getString("message");
        if (message == null) {
            call.reject("Missing message.");
            return;
        }
        try {
            KeyStore ks = keyStore();
            if (!ks.containsAlias(ALIAS)) {
                call.reject("This device has no admin key. Enroll it again.");
                return;
            }
            Signature signature = Signature.getInstance("SHA256withECDSA");
            signature.initSign((PrivateKey) ks.getKey(ALIAS, null));
            signature.update(message.getBytes(StandardCharsets.UTF_8));
            JSObject result = new JSObject();
            result.put("signature", Base64.encodeToString(signature.sign(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Could not sign with the device key (" + e.getClass().getSimpleName() + ").");
        }
    }

    @PluginMethod
    public void deleteKey(PluginCall call) {
        try {
            KeyStore ks = keyStore();
            if (ks.containsAlias(ALIAS)) ks.deleteEntry(ALIAS);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not delete the device key (" + e.getClass().getSimpleName() + ").");
        }
    }
}
