/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link AuditService}'s static diff/merge helpers and the
 * {@code diffObjects}/{@code deepDiff}/{@code diffLists} object-diffing logic. No Spring
 * context, no containers, no repository interaction — the service is instantiated with a
 * {@code null} repository since these methods never touch it.
 */
class AuditServiceTest {

    private final AuditService auditService = new AuditService(null);

    @Test
    void diff_bothNull_returnsNull() {
        assertThat(AuditService.diff("name", null, null)).isNull();
    }

    @Test
    void diff_equalValues_returnsNull() {
        assertThat(AuditService.diff("name", "same", "same")).isNull();
    }

    @Test
    void diff_changedValue_returnsFromToMap() {
        Map<String, Object> result = AuditService.diff("name", "old", "new");

        assertThat(result).containsOnlyKeys("name");

        Map<String, Object> change = (Map<String, Object>) result.get("name");
        assertThat(change).containsEntry("from", "old").containsEntry("to", "new");
    }

    @Test
    void diff_fromNullToValue_recordedAsAddition() {
        Map<String, Object> result = AuditService.diff("name", null, "new");

        Map<String, Object> change = (Map<String, Object>) result.get("name");
        assertThat(change.get("from")).isNull();
        assertThat(change.get("to")).isEqualTo("new");
    }

    @Test
    void diff_fromValueToNull_recordedAsDeletion() {
        Map<String, Object> result = AuditService.diff("name", "old", null);

        Map<String, Object> change = (Map<String, Object>) result.get("name");
        assertThat(change.get("from")).isEqualTo("old");
        assertThat(change.get("to")).isNull();
    }

    @Test
    void diff_numericValuesComparedByStringRepresentation() {
        // 1 (Integer) vs "1" (String) should be considered equal via String.valueOf
        assertThat(AuditService.diff("count", 1, "1")).isNull();
        assertThat(AuditService.diff("count", 1, 2)).isNotNull();
    }

    @Test
    void merge_bothNull_returnsNull() {
        assertThat(AuditService.merge(null, null)).isNull();
    }

    @Test
    void merge_firstNull_returnsSecond() {
        Map<String, Object> b = Map.of("x", 1);
        assertThat(AuditService.merge(null, b)).isEqualTo(b);
    }

    @Test
    void merge_secondNull_returnsFirst() {
        Map<String, Object> a = Map.of("x", 1);
        assertThat(AuditService.merge(a, null)).isEqualTo(a);
    }

    @Test
    void merge_bothPresent_combinesEntries() {
        Map<String, Object> a = new LinkedHashMap<>(Map.of("x", 1));
        Map<String, Object> b = new LinkedHashMap<>(Map.of("y", 2));

        Map<String, Object> merged = AuditService.merge(a, b);

        assertThat(merged).containsEntry("x", 1).containsEntry("y", 2);
    }

    @Test
    void merge_overlappingKeys_secondTakesPrecedence() {
        Map<String, Object> a = new LinkedHashMap<>(Map.of("x", 1));
        Map<String, Object> b = new LinkedHashMap<>(Map.of("x", 2));

        Map<String, Object> merged = AuditService.merge(a, b);

        assertThat(merged).containsEntry("x", 2);
    }

    @Test
    void merge_doesNotMutateInputMaps() {
        Map<String, Object> a = new LinkedHashMap<>(Map.of("x", 1));
        Map<String, Object> b = new LinkedHashMap<>(Map.of("y", 2));

        AuditService.merge(a, b);

        assertThat(a).containsOnlyKeys("x");
        assertThat(b).containsOnlyKeys("y");
    }

    static class Sample {
        public String name;
        public int count;

        Sample(String name, int count) {
            this.name = name;
            this.count = count;
        }
    }

    @Test
    void diffObjects_bothNull_returnsNull() {
        assertThat(auditService.diffObjects(null, null)).isNull();
    }

    @Test
    void diffObjects_identicalObjects_returnsNull() {
        Sample before = new Sample("a", 1);
        Sample after = new Sample("a", 1);

        assertThat(auditService.diffObjects(before, after)).isNull();
    }

    @Test
    void diffObjects_changedScalarField_recordsFromTo() {
        Sample before = new Sample("a", 1);
        Sample after = new Sample("b", 1);

        Map<String, Object> diff = auditService.diffObjects(before, after);

        assertThat(diff).containsKey("name");
        
        Map<String, Object> change = (Map<String, Object>) diff.get("name");
        assertThat(change).containsEntry("from", "a").containsEntry("to", "b");
        assertThat(diff).doesNotContainKey("count");
    }

    @Test
    void diffObjects_createFromNull_recordsAllFieldsAsAdditions() {
        Sample after = new Sample("a", 1);

        Map<String, Object> diff = auditService.diffObjects(null, after);

        assertThat(diff).containsKeys("name", "count");
    }

    @Test
    void diffObjects_deleteToNull_recordsAllFieldsAsDeletions() {
        Sample before = new Sample("a", 1);

        Map<String, Object> diff = auditService.diffObjects(before, null);

        assertThat(diff).containsKeys("name", "count");
    }

    @Test
    void diffObjects_nestedMapChange_recordedWithDotPath() {
        Map<String, Object> before = Map.of("outer", new LinkedHashMap<>(Map.of("inner", "a")));
        Map<String, Object> after = Map.of("outer", new LinkedHashMap<>(Map.of("inner", "b")));

        Map<String, Object> diff = auditService.diffObjects(before, after);

        assertThat(diff).containsKey("outer.inner");
    }

    @Test
    void diffObjects_listOfMapsWithIds_matchesByIdNotIndex() {
        Map<String, Object> before = Map.of(
                "items", List.of(
                        new LinkedHashMap<>(Map.of("id", 1, "name", "one")),
                        new LinkedHashMap<>(Map.of("id", 2, "name", "two"))));
        // delete item id=1 from the middle/front — id=2 unchanged, should not show as changed
        Map<String, Object> after = Map.of(
                "items", List.of(
                        new LinkedHashMap<>(Map.of("id", 2, "name", "two"))));

        Map<String, Object> diff = auditService.diffObjects(before, after);

        assertThat(diff).containsKey("items[deleted:1]");
        assertThat(diff).doesNotContainKey("items[id:2]");
    }

    @Test
    void diffObjects_listOfMapsWithIds_additionRecorded() {
        Map<String, Object> before = Map.of(
                "items", List.of(new LinkedHashMap<>(Map.of("id", 1, "name", "one"))));
        Map<String, Object> after = Map.of(
                "items", List.of(
                        new LinkedHashMap<>(Map.of("id", 1, "name", "one")),
                        new LinkedHashMap<>(Map.of("id", 2, "name", "two"))));

        Map<String, Object> diff = auditService.diffObjects(before, after);

        assertThat(diff).containsKey("items[added:2]");
    }

    @Test
    void diffObjects_listOfMapsWithIds_matchedPairFieldChange_recursesWithIdPath() {
        Map<String, Object> before = Map.of(
                "items", List.of(new LinkedHashMap<>(Map.of("id", 1, "name", "one"))));
        Map<String, Object> after = Map.of(
                "items", List.of(new LinkedHashMap<>(Map.of("id", 1, "name", "ONE"))));

        Map<String, Object> diff = auditService.diffObjects(before, after);

        assertThat(diff).containsKey("items[id:1].name");
    }

    @Test
    void diffObjects_listOfScalarsChanged_recordedAsJsonStringDiff() {
        Map<String, Object> before = Map.of("tags", List.of("a", "b"));
        Map<String, Object> after = Map.of("tags", List.of("a", "c"));

        Map<String, Object> diff = auditService.diffObjects(before, after);

        assertThat(diff).containsKey("tags");
    }

    @Test
    void diffObjects_listOfScalarsUnchanged_noDiff() {
        Map<String, Object> before = Map.of("tags", List.of("a", "b"));
        Map<String, Object> after = Map.of("tags", List.of("a", "b"));

        assertThat(auditService.diffObjects(before, after)).isNull();
    }
}
