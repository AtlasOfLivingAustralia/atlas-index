/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.update;

import au.org.ala.search.model.TaskType;
import au.org.ala.search.service.remote.ElasticService;
import au.org.ala.search.service.remote.LogService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

import java.lang.reflect.Field;
import java.util.Arrays;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;

/**
 * Pure-logic unit tests for {@link AllService#isTaskEnabled(TaskType)}. No Spring context, no
 * containers — constructor dependencies are Mockito mocks that are never invoked. The
 * {@code @Value}-annotated public boolean fields are set directly (simulating property
 * injection) rather than via a Spring context.
 */
class AllServiceTest {

    // TaskType values that are expected to have a matching "task<Name>Enabled" field on
    // AllService. Anything not listed here (e.g. FIELDGUIDE, consumer/broadcast/leader-only
    // task types) intentionally has no field and always falls back to true.
    private static final List<TaskType> CONFIGURED_TASK_TYPES = List.of(
            TaskType.AREA, TaskType.BIOCACHE, TaskType.BIOCOLLECT, TaskType.DIGIVOL,
            TaskType.COLLECTIONS, TaskType.DWCA, TaskType.KNOWLEDGEBASE, TaskType.LAYER,
            TaskType.LISTS, TaskType.SITEMAP, TaskType.WORDPRESS, TaskType.TAXON_DESCRIPTION,
            TaskType.POSTGRES_SYNC
    );

    private AllService newAllService() {
        return new AllService(
                mock(CollectionsImportService.class), mock(WordpressImportService.class),
                mock(KnowledgebaseImportService.class), mock(DigivolImportService.class), mock(LogService.class),
                mock(ListImportService.class), mock(BiocollectImportService.class),
                mock(LayerImportService.class), mock(AreaImportService.class),
                mock(DwCAImportService.class), mock(TaxonUpdateService.class),
                mock(SitemapService.class), mock(DashboardService.class), mock(DescriptionsUpdateService.class),
                mock(PostgresSyncService.class), mock(ElasticService.class));
    }

    @Test
    void isTaskEnabled_all_alwaysTrue() {
        AllService service = newAllService();

        assertThat(service.isTaskEnabled(TaskType.ALL)).isTrue();
    }

    @Test
    void isTaskEnabled_dashboard_alwaysTrue() {
        AllService service = newAllService();
        service.taskDashboardEnabled = false; // even if explicitly disabled via config

        assertThat(service.isTaskEnabled(TaskType.DASHBOARD)).isTrue();
    }

    @Test
    void isTaskEnabled_configuredTrue_returnsTrue() {
        AllService service = newAllService();
        service.taskDigivolEnabled = true;

        assertThat(service.isTaskEnabled(TaskType.DIGIVOL)).isTrue();
    }

    @Test
    void isTaskEnabled_configuredFalse_returnsFalse() {
        AllService service = newAllService();
        service.taskDigivolEnabled = false;

        assertThat(service.isTaskEnabled(TaskType.DIGIVOL)).isFalse();
    }

    @Test
    void isTaskEnabled_unconfiguredField_null_returnsNull() {
        AllService service = newAllService();
        // taskDigivolEnabled left as its default (null) — field exists but value is null

        assertThat(service.isTaskEnabled(TaskType.DIGIVOL)).isNull();
    }

    @Test
    void isTaskEnabled_taskTypeWithNoMatchingField_returnsTrue() {
        AllService service = newAllService();

        // FIELDGUIDE has no "taskFieldguideEnabled" field on AllService, so the
        // NoSuchFieldException branch is hit, defaulting to true.
        assertThat(service.isTaskEnabled(TaskType.FIELDGUIDE)).isTrue();
    }

    @Test
    void isTaskEnabled_eachIngestionTaskType_reflectsItsOwnField() {
        AllService service = newAllService();
        service.taskAreaEnabled = true;
        service.taskBiocacheEnabled = false;
        service.taskBiocollectEnabled = true;
        service.taskCollectionsEnabled = false;
        service.taskDwcaEnabled = true;
        service.taskKnowledgebaseEnabled = false;
        service.taskLayerEnabled = true;
        service.taskListsEnabled = false;
        service.taskSitemapEnabled = true;
        service.taskWordpressEnabled = false;
        service.taskTaxonDescriptionEnabled = false;
        service.taskPostgresSyncEnabled = true;

        assertThat(service.isTaskEnabled(TaskType.AREA)).isTrue();
        assertThat(service.isTaskEnabled(TaskType.BIOCACHE)).isFalse();
        assertThat(service.isTaskEnabled(TaskType.BIOCOLLECT)).isTrue();
        assertThat(service.isTaskEnabled(TaskType.COLLECTIONS)).isFalse();
        assertThat(service.isTaskEnabled(TaskType.DWCA)).isTrue();
        assertThat(service.isTaskEnabled(TaskType.KNOWLEDGEBASE)).isFalse();
        assertThat(service.isTaskEnabled(TaskType.LAYER)).isTrue();
        assertThat(service.isTaskEnabled(TaskType.LISTS)).isFalse();
        assertThat(service.isTaskEnabled(TaskType.SITEMAP)).isTrue();
        assertThat(service.isTaskEnabled(TaskType.WORDPRESS)).isFalse();
        // TAXON_DESCRIPTION and POSTGRES_SYNC now correctly resolve to their underscored field
        // names via AllService.taskFieldName(), so the configured value is honoured rather than
        // always falling back to true.
        assertThat(service.isTaskEnabled(TaskType.TAXON_DESCRIPTION)).isFalse();
        assertThat(service.isTaskEnabled(TaskType.POSTGRES_SYNC)).isTrue();
    }

    @ParameterizedTest
    @EnumSource(value = TaskType.class, names = {
            "AREA", "BIOCACHE", "BIOCOLLECT", "DIGIVOL", "COLLECTIONS", "DWCA",
            "KNOWLEDGEBASE", "LAYER", "LISTS", "SITEMAP", "WORDPRESS",
            "TAXON_DESCRIPTION", "POSTGRES_SYNC"
    })
    void isTaskEnabled_configuredTaskType_resolvesToMatchingField(TaskType taskType) throws Exception {
        // Guards against future regressions: for every TaskType we expect to be configurable,
        // AllService.taskFieldName() must resolve to a real, settable field, and toggling it
        // must be reflected by isTaskEnabled() rather than silently falling back to true.
        AllService service = newAllService();
        Field field = AllService.class.getField(AllService.taskFieldName(taskType));

        field.set(service, false);
        assertThat(service.isTaskEnabled(taskType))
                .as("isTaskEnabled(%s) should reflect field %s == false", taskType, field.getName())
                .isFalse();

        field.set(service, true);
        assertThat(service.isTaskEnabled(taskType))
                .as("isTaskEnabled(%s) should reflect field %s == true", taskType, field.getName())
                .isTrue();
    }

    @Test
    void everyTaskEnabledField_hasCorrespondingResolvableTaskType() {
        // Guards against the reverse mistake: a new "task<Name>Enabled" field being added to
        // AllService without a TaskType whose generated field name actually matches it (e.g. due
        // to inconsistent naming), which would leave the field permanently unreachable via
        // isTaskEnabled().
        List<String> unmatchedFields = Arrays.stream(AllService.class.getFields())
                .filter(f -> f.getName().startsWith("task") && f.getName().endsWith("Enabled"))
                .filter(f -> Arrays.stream(TaskType.values())
                        .noneMatch(t -> AllService.taskFieldName(t).equals(f.getName())))
                .map(Field::getName)
                .toList();

        assertThat(unmatchedFields)
                .as("Every task*Enabled field on AllService should be resolvable from some TaskType via taskFieldName()")
                .isEmpty();
    }

    @Test
    void everyConfiguredTaskType_hasCorrespondingField() {
        // Guards against a new INGESTION TaskType being added without a matching field being
        // declared on AllService (the field lookup would then always fall back to true).
        List<String> unmatchedTaskTypes = CONFIGURED_TASK_TYPES.stream()
                .filter(t -> Arrays.stream(AllService.class.getFields())
                        .noneMatch(f -> f.getName().equals(AllService.taskFieldName(t))))
                .map(Enum::name)
                .toList();

        assertThat(unmatchedTaskTypes)
                .as("Every configured TaskType should have a matching task*Enabled field on AllService")
                .isEmpty();
    }
}
