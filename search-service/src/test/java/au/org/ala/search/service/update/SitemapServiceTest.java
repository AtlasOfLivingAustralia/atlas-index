/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import co.elastic.clients.elasticsearch.core.search.Hit;
import co.elastic.clients.json.JsonData;
import co.elastic.clients.json.jackson.JacksonJsonpMapper;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link SitemapService}'s {@code hitToItem} mapping helper. No
 * Spring context, no real Elasticsearch connection — a {@link Hit} is constructed directly in
 * memory via the Elasticsearch Java client's builder API (this only builds a plain data object,
 * it does not require a live cluster), and the private method is exercised via reflection.
 */
class SitemapServiceTest {

    private final SitemapService sitemapService = new SitemapService(
            mock(ElasticService.class), mock(LogService.class), null);

    private static final JacksonJsonpMapper JSONP_MAPPER = new JacksonJsonpMapper();

    private static JsonData jsonDataOf(Object value) {
        return JsonData.of(value, JSONP_MAPPER);
    }

    private SearchItemIndex hitToItem(Hit<SearchItemIndex> hit) throws Exception {
        Method m = SitemapService.class.getDeclaredMethod("hitToItem", Hit.class);
        m.setAccessible(true);
        return (SearchItemIndex) m.invoke(sitemapService, hit);
    }

    private Hit<SearchItemIndex> hitWithFields(Map<String, JsonData> fields) {
        return Hit.of(h -> h.index("test-index").id("1").fields(fields));
    }

    @Test
    void hitToItem_allFieldsPresent_mapsEachField() throws Exception {
        long modifiedMillis = 1_700_000_000_000L;
        Map<String, JsonData> fields = new HashMap<>();
        fields.put("id", jsonDataOf(List.of("dr123")));
        fields.put("guid", jsonDataOf(List.of("urn:lsid:test:123")));
        fields.put("modified", jsonDataOf(List.of(modifiedMillis)));
        fields.put("scientificName", jsonDataOf(List.of("Eucalyptus regnans")));
        fields.put("commonNameSingle", jsonDataOf(List.of("Mountain Ash")));
        fields.put("nameComplete", jsonDataOf(List.of("Eucalyptus regnans F.Muell.")));

        SearchItemIndex item = hitToItem(hitWithFields(fields));

        assertThat(item.getId()).isEqualTo("dr123");
        assertThat(item.getGuid()).isEqualTo("urn:lsid:test:123");
        assertThat(item.getModified()).isEqualTo(new java.util.Date(modifiedMillis));
        assertThat(item.getScientificName()).isEqualTo("Eucalyptus regnans");
        assertThat(item.getCommonNameSingle()).isEqualTo("Mountain Ash");
        assertThat(item.getNameComplete()).isEqualTo("Eucalyptus regnans F.Muell.");
    }

    @Test
    void hitToItem_missingOptionalFields_mapsToNull() throws Exception {
        Map<String, JsonData> fields = new HashMap<>();
        fields.put("id", jsonDataOf(List.of("dr123")));
        fields.put("guid", jsonDataOf(List.of("urn:lsid:test:123")));
        // modified, scientificName, commonNameSingle, nameComplete all absent

        SearchItemIndex item = hitToItem(hitWithFields(fields));

        assertThat(item.getId()).isEqualTo("dr123");
        assertThat(item.getGuid()).isEqualTo("urn:lsid:test:123");
        assertThat(item.getModified()).isNull();
        assertThat(item.getScientificName()).isNull();
        assertThat(item.getCommonNameSingle()).isNull();
        assertThat(item.getNameComplete()).isNull();
    }

    @Test
    void hitToItem_noFieldsAtAll_mapsAllToNull() throws Exception {
        SearchItemIndex item = hitToItem(hitWithFields(new HashMap<>()));

        assertThat(item.getId()).isNull();
        assertThat(item.getGuid()).isNull();
        assertThat(item.getModified()).isNull();
        assertThat(item.getScientificName()).isNull();
        assertThat(item.getCommonNameSingle()).isNull();
        assertThat(item.getNameComplete()).isNull();
    }
}
