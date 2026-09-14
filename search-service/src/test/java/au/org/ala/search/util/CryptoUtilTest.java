/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import org.junit.jupiter.api.Test;

import javax.crypto.BadPaddingException;
import java.security.GeneralSecurityException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Pure-logic unit tests for {@link CryptoUtil}. No Spring context, no containers.
 */
class CryptoUtilTest {

    @Test
    void encryptThenDecrypt_roundTrips() throws Exception {
        String secret = "my-secret-key";
        String plaintext = "hello world";

        String encrypted = CryptoUtil.encrypt(plaintext, secret);
        String decrypted = CryptoUtil.decrypt(encrypted, secret);

        assertThat(decrypted).isEqualTo(plaintext);
    }

    @Test
    void encrypt_producesBase64CiphertextDifferentFromPlaintext() throws Exception {
        String secret = "my-secret-key";
        String plaintext = "hello world";

        String encrypted = CryptoUtil.encrypt(plaintext, secret);

        assertThat(encrypted).isNotEqualTo(plaintext);
        // must be valid Base64
        assertThat(java.util.Base64.getDecoder().decode(encrypted)).isNotEmpty();
    }

    @Test
    void encrypt_isDeterministicForSameInputAndSecret() throws Exception {
        // AES in ECB mode (default when no mode specified) with the same key is deterministic
        String secret = "my-secret-key";
        String plaintext = "hello world";

        String encrypted1 = CryptoUtil.encrypt(plaintext, secret);
        String encrypted2 = CryptoUtil.encrypt(plaintext, secret);

        assertThat(encrypted1).isEqualTo(encrypted2);
    }

    @Test
    void decrypt_withWrongSecret_throwsException() throws Exception {
        String encrypted = CryptoUtil.encrypt("hello world", "correct-secret");

        assertThatThrownBy(() -> CryptoUtil.decrypt(encrypted, "wrong-secret"))
                .isInstanceOf(GeneralSecurityException.class);
    }

    @Test
    void decrypt_withMalformedBase64_throwsException() {
        assertThatThrownBy(() -> CryptoUtil.decrypt("not valid base64 !!!", "some-secret"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void encryptThenDecrypt_emptyString_roundTrips() throws Exception {
        String secret = "my-secret-key";

        String encrypted = CryptoUtil.encrypt("", secret);
        String decrypted = CryptoUtil.decrypt(encrypted, secret);

        assertThat(decrypted).isEqualTo("");
    }

    @Test
    void encryptThenDecrypt_unicodeContent_roundTrips() throws Exception {
        String secret = "my-secret-key";
        String plaintext = "Eucalyptus regnans \u2013 café \u2764";

        String encrypted = CryptoUtil.encrypt(plaintext, secret);
        String decrypted = CryptoUtil.decrypt(encrypted, secret);

        assertThat(decrypted).isEqualTo(plaintext);
    }

    @Test
    void encryptThenDecrypt_differentSecretsProduceDifferentCiphertext() throws Exception {
        String plaintext = "hello world";

        String encryptedA = CryptoUtil.encrypt(plaintext, "secret-a");
        String encryptedB = CryptoUtil.encrypt(plaintext, "secret-b");

        assertThat(encryptedA).isNotEqualTo(encryptedB);
    }
}
