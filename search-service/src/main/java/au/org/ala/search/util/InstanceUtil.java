/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import java.net.InetAddress;
import java.net.UnknownHostException;

public class InstanceUtil {

    /**
     * Get the unique instance id. This assumes that the hostname is unique, e.g. Kubernetes pod name.
     *
     * @return
     */
    public static String getInstanceId() {
        try {
            return InetAddress.getLocalHost().getHostName();
        } catch (UnknownHostException e) {
            throw new RuntimeException("Failed to get hostname", e);
        }
    }
}
