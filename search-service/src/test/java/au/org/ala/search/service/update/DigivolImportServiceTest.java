/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.SearchItemIndex;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link DigivolImportService}'s {@code hasChanges} comparison
 * helper. No Spring context, no containers — constructor dependencies are Mockito mocks that
 * are never invoked, and the private method is exercised via reflection.
 */
class DigivolImportServiceTest {

    private final DigivolImportService digivolImportService = new DigivolImportService(
            mock(ElasticService.class), mock(LogService.class));

    private boolean hasChanges(SearchItemIndex newItem, SearchItemIndex existingItem) throws Exception {
        Method m = DigivolImportService.class.getDeclaredMethod(
                "hasChanges", SearchItemIndex.class, SearchItemIndex.class);
        m.setAccessible(true);
        return (boolean) m.invoke(digivolImportService, newItem, existingItem);
    }

    private SearchItemIndex item(String id, String guid, String idxtype, String name, String description) {
        SearchItemIndex item = new SearchItemIndex();
        item.setId(id);
        item.setGuid(guid);
        item.setIdxtype(idxtype);
        item.setName(name);
        item.setDescription(description);
        return item;
    }

    @Test
    void hasChanges_existingNull_returnsTrue() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc");

        assertThat(hasChanges(newItem, null)).isTrue();
    }

    @Test
    void hasChanges_identicalItems_returnsFalse() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc");
        SearchItemIndex existingItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc");

        assertThat(hasChanges(newItem, existingItem)).isFalse();
    }

    @Test
    void hasChanges_differentId_returnsTrue() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc");
        SearchItemIndex existingItem = item("2", "guid1", "BIOCOLLECT", "Project", "desc");

        assertThat(hasChanges(newItem, existingItem)).isTrue();
    }

    @Test
    void hasChanges_differentGuid_returnsTrue() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc");
        SearchItemIndex existingItem = item("1", "guid2", "BIOCOLLECT", "Project", "desc");

        assertThat(hasChanges(newItem, existingItem)).isTrue();
    }

    @Test
    void hasChanges_differentIdxtype_returnsTrue() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc");
        SearchItemIndex existingItem = item("1", "guid1", "TAXON", "Project", "desc");

        assertThat(hasChanges(newItem, existingItem)).isTrue();
    }

    @Test
    void hasChanges_differentName_returnsTrue() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", "Project A", "desc");
        SearchItemIndex existingItem = item("1", "guid1", "BIOCOLLECT", "Project B", "desc");

        assertThat(hasChanges(newItem, existingItem)).isTrue();
    }

    @Test
    void hasChanges_differentDescription_returnsTrue() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc A");
        SearchItemIndex existingItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc B");

        assertThat(hasChanges(newItem, existingItem)).isTrue();
    }

    @Test
    void hasChanges_nullFieldsOnBothSides_treatedAsEqual() throws Exception {
        SearchItemIndex newItem = item(null, null, null, null, null);
        SearchItemIndex existingItem = item(null, null, null, null, null);

        assertThat(hasChanges(newItem, existingItem)).isFalse();
    }

    @Test
    void hasChanges_nullOnOneSideOnly_returnsTrue() throws Exception {
        SearchItemIndex newItem = item("1", "guid1", "BIOCOLLECT", null, "desc");
        SearchItemIndex existingItem = item("1", "guid1", "BIOCOLLECT", "Project", "desc");

        assertThat(hasChanges(newItem, existingItem)).isTrue();
    }
}
