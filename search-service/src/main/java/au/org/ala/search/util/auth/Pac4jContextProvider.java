package au.org.ala.search.util.auth;

import org.pac4j.core.context.WebContext;

// TODO: move this and related classes into ala-security-project

/**
 * Provides a Pac4j Context via static methods or similar so that the client code need not take them as params.
 */
public interface Pac4jContextProvider {

    WebContext webContext();
}
