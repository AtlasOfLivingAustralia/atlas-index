/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import au.org.ala.ws.security.client.AlaAuthClient;
import org.pac4j.core.config.Config;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class AuthMachineJwtConfiguration {
    @Bean
    AuthMachineJwt authMachineJwt(Config config, AlaAuthClient alaAuthClient) {
        return new AuthMachineJwt(config, alaAuthClient);
    }
}
