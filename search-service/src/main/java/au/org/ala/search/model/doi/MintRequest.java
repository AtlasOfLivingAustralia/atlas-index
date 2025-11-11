/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.doi;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.Data;

import java.util.List;
import java.util.Map;

/**
 * DOI Minting Request Model. From doi-service implementation.
 */
@Data
public class MintRequest {
    public static class ProviderMetadata {
        public static class Creator {
            public String name;
        }

        public static class Title {
            public String title;
        }

        public static class Contributor {
            public String name;
            public String type;
        }

        public static class Description {
            public String text;
            public String type;
        }

        public List<Creator> creators;
        public List<String> authors;
        public List<Title> titles;
        public String title;
        public String subtitle;
        public String publicationYear;
        public List<String> subjects;
        public String resourceText;
        public String resourceType;
        public String publisher;
        public List<Contributor> contributors;
        public List<Description> descriptions;
        public String createdDate;
        public List<String> rights;

        public Map<String, Object> toMap() {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.convertValue(this, Map.class);
        }
    }

    public DoiProvider provider;
    public ProviderMetadata providerMetadata;
    public String title;
    public String authors;
    public String description;
    public Object licence; // Legacy API is String, but biocache-service usage is List<String>
    public String applicationUrl;
    public String fileUrl;
    public Map<String, Object> applicationMetadata;
    public String customLandingPageUrl;
    public String userId;
    public Boolean active;
    public List<String> authorisedRoles;
    public String displayTemplate;
}
