# Common authentication implementation (draft)

This is an outline of how to use the common authentication implementation that uses search-service endpoints for
single sign-on within the scope of atlas-index UIs.

Atlas-index UIs may exclude this if they do not require authentication (e.g. dashboard, specimens, species, regions). It 
is recommended to use a unique header and footer for these applications, one that does not change based on login state.

## Prerequisites

- An instance of search-service that has been configured to use the authentication provider.
- The UI application must be registered with search-service whitelist of allowed clients.
- The UI application is registered as a logout URL of the authentication provider.

## Implementation guide

For a working example, see the [doi-ui](../doi-ui) project.

1. **Environment Variables**: Set the following environment variables in your UI application:
    - `VITE_APP_API_URL`: The base URL of your search-service instance.
    - `VITE_APP_BASE_URL`: The base URL of your application. This is the redirect URL after logout. It is registered
      with the authentication provider for the clientId used by search-service.

2. **Initialisation**: Add the common authentication utility files to your project. These files are typically located in
   the `util` directory:
    - `auth.tsx`: Contains functions for checking login state, handling login, and handling logout.
    - `UserContext.tsx`: Provides a React context for managing user information.

    ```tsx
    // Import common authentication utilities
    import {checkLoginState, handleLogin, handleLogout, UserContext, UserInfo} from '@ala/common-ui';
    
    // Maintain a reference to the hook and a refresh timer
    const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
    const refreshTimer = useRef<NodeJS.Timeout | null>(null);
    
    // Initialise login state on component mount and set up visibility change listener to re-check login state
    useEffect(() => {
        checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);
    
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                checkLoginState(setUserInfo, refreshTimer, import.meta.env.VITE_APP_API_URL);
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
    
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);
   
    // Wrapper functions to handle login and logout
    function handleLoginWrapper() {
        handleLogin(import.meta.env.VITE_APP_API_URL);
    }
    function handleLogoutWrapper() {
        handleLogout(import.meta.env.VITE_APP_API_URL, import.meta.env.VITE_APP_BASE_URL);
    }
    
    // Wrap your application in the UserContext provider and pass userInfo and setUserInfo
    <UserContext.Provider value={{userInfo, setUserInfo}}>
        {/* Provide login and logout functions to the common header */}
        <Header
            isLoggedIn={userInfo?.authenticated}
            logoutFn={handleLogoutWrapper}
            loginFn={handleLoginWrapper}
            // other props as needed
        />
    
        {/* ...other application components... */}
    
        {/* Provide login and logout functions to the common footer */}
        <Footer
            isLoggedIn={userInfo?.authenticated}
            logoutFn={handleLogoutWrapper}
            loginFn={handleLoginWrapper}
            // other props as needed
        />
    </UserContext.Provider>
    
    ```

3. **Component Use**: Get the login state within a component.

    ```tsx
    // Import common authentication utilities
    import {useUser, handleLogin} from '@ala/common-ui';
    
    // Get the user information from context
    const {userInfo} = useUser();
    
    useEffect(() => {
        // Example for a page requiring a mandatory login
        if (!userInfo) {
            // Still checking if logged in, return and keep listening to userInfo updates
            return;
        }
    
        // Not logged in, redirect to login page if login is mandatory
        if (userInfo && !userInfo.authenticated) {
            handleLogin(import.meta.env.VITE_APP_API_URL);
            return;
        }
    }, [userInfo]);
    
    // Return loading state while checking login
    if (!userInfo) {
        return <div>Loading...</div>;
    }
    
    // Restrict for user specific roles
    if (!userInfo.roles || !userInfo.roles.includes("ROLE_ADMIN")) {
        return <div>You do not have permission to view this page.</div>;
    }
    ```

4. **Information available**: The user information available in `userInfo` when logged in is as follows:

    ```tsx
    export type UserInfo = {
        authenticated: boolean; // whether the user is logged in
        userId?: string; // user's unique identifier
        email?: string; // user's email address
        firstName?: string; // user's given name
        lastName?: string; // user's family name
        roles?: string[]; // user roles
        accessToken?: string; // JWT access token
        expiresAt?: number; // access token expiry time (epoch seconds)
    };
    ```
