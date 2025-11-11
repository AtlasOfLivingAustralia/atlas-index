/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.EnableWebMvc;
import org.springframework.web.servlet.config.annotation.PathMatchConfigurer;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.util.UrlPathHelper;

import java.util.List;

@Configuration
@EnableWebMvc
public class WebConfig implements WebMvcConfigurer {

    @Value("#{'${security.cors.origins}'.split(',')}")
    private List<String> spaCorsOrigins;

    // Enable CORS for all endpoints
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        // TODO: verify and cleanup CORS settings, noting some controllers also have CORS annotations
        registry.addMapping("/session")
                .allowCredentials(true)
                .allowedOrigins(spaCorsOrigins.toArray(new String[0]))
                .allowedMethods("*")
                .allowedHeaders("*")
                .exposedHeaders("x-total-count");
        registry.addMapping("/v1/doi/doi")
                .allowedMethods("*")
                .allowedHeaders("*")
                .exposedHeaders("x-doi-id");
        registry.addMapping("/**")
                .allowedMethods("*")
                .allowedHeaders("*")
                .exposedHeaders("x-total-count", "location");
    }

    @Override
    public void configurePathMatch(PathMatchConfigurer configurer) {
        // this is required to support encoded guids as path variables used by legacy services
        UrlPathHelper urlPathHelper = new UrlPathHelper();
        urlPathHelper.setUrlDecode(false);
        configurer.setUrlPathHelper(urlPathHelper);

        WebMvcConfigurer.super.configurePathMatch(configurer);
    }
}
