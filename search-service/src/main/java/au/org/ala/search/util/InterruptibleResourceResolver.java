/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.util;

import org.apache.xmlgraphics.io.Resource;
import org.apache.xmlgraphics.io.ResourceResolver;

import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;

/**
 * Interruptable hook for Apache XML Graphics ResourceResolver. Used to check if the current thread is interrupted.
 */
public class InterruptibleResourceResolver implements ResourceResolver {

    private final ResourceResolver delegate;

    public InterruptibleResourceResolver(ResourceResolver delegate) {
        this.delegate = delegate;
    }

    @Override
    public Resource getResource(URI uri) throws IOException {
        checkInterrupted(uri);
        return delegate.getResource(uri);
    }

    @Override
    public OutputStream getOutputStream(URI uri) throws IOException {
        checkInterrupted(uri);
        return delegate.getOutputStream(uri);
    }

    private void checkInterrupted(URI uri) {
        if (Thread.currentThread().isInterrupted()) {
            throw new RuntimeException("Thread interrupted while resolving resource: " + uri);
        }
    }
}
