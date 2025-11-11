/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.model.doi;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.commons.lang3.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Builder for DataCite DOI payloads.
 *
 * References
 * - https://github.com/AtlasOfLivingAustralia/doi-service
 * - https://support.datacite.org/docs/api-create-dois
 * - https://support.datacite.org/docs/datacite-xml-to-json-mapping
 */

public class DoiPayloadBuilder {
    private final Map<String, Object> attributes = new LinkedHashMap<>();

    public DoiPayloadBuilder event(String event) {
        attributes.put("event", event);
        return this;
    }

    public DoiPayloadBuilder prefix(String prefix) {
        attributes.put("prefix", prefix);
        return this;
    }

    public DoiPayloadBuilder doi(String doi) {
        attributes.put("doi", doi);
        return this;
    }

    public DoiPayloadBuilder creators(List<String> names) {
        if (names == null) {
            return this;
        }
        List<Map<String, String>> creatorList = new java.util.ArrayList<>();
        for (String name : names) {
            creatorList.add(Map.of("name", name));
        }
        attributes.put("creators", creatorList);
        return this;
    }

    public DoiPayloadBuilder titles(List<String> names) {
        if (names == null) {
            return this;
        }
        List<Map<String, String>> titleList = new java.util.ArrayList<>();
        for (String name : names) {
            titleList.add(Map.of("title", name));
        }
        attributes.put("titles", titleList);
        return this;
    }

    public DoiPayloadBuilder subjects(List<String> subjects) {
        if (subjects == null) {
            return this;
        }
        List<Map<String, String>> subjectList = new java.util.ArrayList<>();
        for (String subject : subjects) {
            subjectList.add(Map.of("subject", subject));
        }
        attributes.put("subjects", subjectList);
        return this;
    }

    public DoiPayloadBuilder contributors(List<MintRequest.ProviderMetadata.Contributor> contributors) {
        if (contributors == null) {
            return this;
        }
        List<Map<String, String>> contributorList = new java.util.ArrayList<>();
        for (MintRequest.ProviderMetadata.Contributor contributor : contributors) {
            if (StringUtils.isEmpty(contributor.name)) {
                continue;
            }
            String type = ContributorType.fromValue(contributor.type);
            contributorList.add(Map.of("contributorType", type, "name", contributor.name));
        }
        attributes.put("contributors", contributorList);
        return this;
    }

    public DoiPayloadBuilder descriptions(List<MintRequest.ProviderMetadata.Description> descriptions) {
        if (descriptions == null) {
            return this;
        }
        List<Map<String, String>> descriptionList = new java.util.ArrayList<>();
        for (MintRequest.ProviderMetadata.Description description : descriptions) {
            if (StringUtils.isEmpty(description.text)) {
                continue;
            }
            String type = DescriptionType.fromValue(description.type);
            descriptionList.add(Map.of("descriptionType", type, "description", description.text));
        }
        attributes.put("descriptions", descriptionList);
        return this;
    }

    public DoiPayloadBuilder publisher(String publisher) {
        attributes.put("publisher", publisher);
        return this;
    }

    public DoiPayloadBuilder publicationYear(int year) {
        attributes.put("publicationYear", year);
        return this;
    }

    public DoiPayloadBuilder types(Map<String, String> types) {
        attributes.put("types", types);
        return this;
    }

    public DoiPayloadBuilder date(String date, String dateType) {
        if (date != null && dateType != null) {
            attributes.put("dates", List.of(Map.of("date", date, "dateType", dateType)));
        }
        return this;
    }

    public DoiPayloadBuilder url(String url) {
        attributes.put("url", url);
        return this;
    }

    public DoiPayloadBuilder language(String publicationLang) {
        attributes.put("language", publicationLang);
        return this;
    }

    public DoiPayloadBuilder rightsList(List<String> rights) {
        if (rights == null) {
            return this;
        }
        List<Map<String, String>> contributorList = new java.util.ArrayList<>();
        for (String right : rights) {
            contributorList.add(Map.of("rights", right));
        }
        attributes.put("rightsList", contributorList);
        return this;
    }

    public String build() throws Exception {
        Map<String, Object> data = Map.of(
                "type", "dois",
                "attributes", attributes
        );
        Map<String, Object> root = Map.of("data", data);
        ObjectMapper mapper = new ObjectMapper();
        return mapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
    }

    // From https://schema.datacite.org/meta/kernel-4/include/datacite-contributorType-v4.xsd
    public enum ContributorType {
        ContactPerson,
        DataCollector,
        DataCurator,
        DataManager,
        Distributor,
        Editor,
        HostingInstitution,
        Other,
        Producer,
        ProjectLeader,
        ProjectManager,
        ProjectMember,
        RegistrationAgency,
        RegistrationAuthority,
        RelatedPerson,
        ResearchGroup,
        RightsHolder,
        Researcher,
        Sponsor,
        Supervisor,
        Translator,
        WorkPackageLeader;

        public static String fromValue(String value) {
            for (ContributorType type : ContributorType.values()) {
                if (type.name().equalsIgnoreCase(value)) {
                    return type.name();
                }
            }
            return Other.name();
        }
    }

    // From https://schema.datacite.org/meta/kernel-4/include/datacite-resourceType-v4.xsd
    public enum ResourceType {
        Audiovisual,
        Award,
        Book,
        BookChapter,
        Collection,
        ComputationalNotebook,
        ConferencePaper,
        ConferenceProceeding,
        DataPaper,
        Dataset,
        Dissertation,
        Event,
        Image,
        Instrument,
        InteractiveResource,
        Journal,
        JournalArticle,
        Model,
        OutputManagementPlan,
        PeerReview,
        PhysicalObject,
        Preprint,
        Project,
        Report,
        Service,
        Software,
        Sound,
        Standard,
        StudyRegistration,
        Text,
        Workflow,
        Other;

        public static String fromValue(String value) {
            for (ResourceType type : ResourceType.values()) {
                if (type.name().equalsIgnoreCase(value)) {
                    return type.name();
                }
            }
            return Other.name();
        }
    }

    // From https://schema.datacite.org/meta/kernel-4/include/datacite-descriptionType-v4.xsd
    public enum DescriptionType {
        Abstract,
        Methods,
        SeriesInformation,
        TableOfContents,
        TechnicalInfo,
        Other;

        public static String fromValue(String value) {
            for (DescriptionType type : DescriptionType.values()) {
                if (type.name().equalsIgnoreCase(value)) {
                    return type.name();
                }
            }
            return Other.name();
        }
    }
}
