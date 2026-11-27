/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.service.remote;

import au.org.ala.search.model.dto.IndexedField;
import au.org.ala.search.model.query.Op;
import au.org.ala.search.util.QueryParserUtil;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregate;
import co.elastic.clients.elasticsearch._types.aggregations.Aggregation;
import co.elastic.clients.elasticsearch._types.aggregations.LongTermsAggregate;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsAggregate;
import co.elastic.clients.elasticsearch._types.aggregations.StringTermsBucket;
import co.elastic.clients.elasticsearch._types.query_dsl.Query;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ElasticServiceHierarchicalFacetTest {

    @Test
    void isKeywordField_acceptsOnlyIndexedStringFields() {
        assertThat(ElasticService.isKeywordField(new IndexedField("rk_kingdom", "string", true, true, null))).isTrue();
        assertThat(ElasticService.isKeywordField(new IndexedField("rankID", "int", true, true, null))).isFalse();
        assertThat(ElasticService.isKeywordField(new IndexedField("description", "string", false, true, null))).isFalse();
        assertThat(ElasticService.isKeywordField(new IndexedField("hasIekName", "boolean", true, true, null))).isFalse();
        assertThat(ElasticService.isKeywordField(null)).isFalse();
    }

    @Test
    void hierarchicalAggName_producesElasticsearchSafeName() {
        String aggName = ElasticService.hierarchicalAggName(new String[]{"rk_kingdom", "rk_class", "rk_order"});
        assertThat(aggName).isEqualTo("hier_rk_kingdom__rk_class__rk_order");
        assertThat(aggName).doesNotContain(">", "[", "]");

        String sanitized = ElasticService.hierarchicalAggName(new String[]{"a[0]", "b>c"});
        assertThat(sanitized).doesNotContain(">", "[", "]");
    }

    @Test
    void escapeFqValue_escapesBackslashesBeforeQuotes() {
        assertThat(ElasticService.escapeFqValue("a\"b")).isEqualTo("a\\\"b");
        assertThat(ElasticService.escapeFqValue("a\\")).isEqualTo("a\\\\");
        assertThat(ElasticService.escapeFqValue("a\\\"b")).isEqualTo("a\\\\\\\"b");
    }

    @Test
    void buildHierarchicalAggregation_constructsThreeLevelNestedTermsWithIntermediateMissingBucket() {
        String[] levels = {"rk_kingdom", "rk_class", "rk_order"};
        Aggregation root = ElasticService.buildHierarchicalAggregation(levels, 0);

        assertThat(root.terms()).isNotNull();
        assertThat(root.terms().field()).isEqualTo("rk_kingdom");
        assertThat(root.terms().size()).isEqualTo(20);
        assertThat(root.terms().missing()).isNull();

        Aggregation classAgg = root.aggregations().get(ElasticService.subAggName(1));
        assertThat(classAgg).isNotNull();
        assertThat(classAgg.terms().field()).isEqualTo("rk_class");
        assertThat(classAgg.terms().size()).isEqualTo(15);
        assertThat(classAgg.terms().missing()).isNotNull();
        assertThat(classAgg.terms().missing().stringValue()).isEqualTo(ElasticService.MISSING_BUCKET_VALUE);

        Aggregation orderAgg = classAgg.aggregations().get(ElasticService.subAggName(2));
        assertThat(orderAgg).isNotNull();
        assertThat(orderAgg.terms().field()).isEqualTo("rk_order");
        assertThat(orderAgg.terms().size()).isEqualTo(10);
        assertThat(orderAgg.terms().missing()).isNull();
        assertThat(orderAgg.aggregations()).isEmpty();
    }

    @Test
    @SuppressWarnings("unchecked")
    void extractHierarchicalFacetItems_buildsNestedTreeAndPromotesMissingIntermediateRankInCountOrder() {
        String[] levels = {"rk_kingdom", "rk_class", "rk_order"};

        StringTermsBucket diprotodontia = bucket("DIPROTODONTIA", 2, Map.of());
        StringTermsBucket mammalia = bucket("MAMMALIA", 2, Map.of(ElasticService.subAggName(2), termsAgg(List.of(diprotodontia))));

        StringTermsBucket coleoptera = bucket("COLEOPTERA", 1, Map.of());
        StringTermsBucket insecta = bucket("INSECTA", 1, Map.of(ElasticService.subAggName(2), termsAgg(List.of(coleoptera))));

        StringTermsBucket orphanOrder = bucket("ORPHANORDER", 3, Map.of());
        StringTermsBucket missingClass = bucket(
                ElasticService.MISSING_BUCKET_VALUE, 3, Map.of(ElasticService.subAggName(2), termsAgg(List.of(orphanOrder))));

        StringTermsBucket animalia = bucket(
                "ANIMALIA", 6, Map.of(ElasticService.subAggName(1), termsAgg(List.of(mammalia, insecta, missingClass))));

        StringTermsBucket viruses = bucket("Viruses", 1, Map.of(ElasticService.subAggName(1), termsAgg(List.of())));

        List<Map<String, Object>> result = ElasticService.extractHierarchicalFacetItems(
                List.of(animalia, viruses), levels, 0, null);

        assertThat(result).hasSize(2);

        Map<String, Object> animaliaItem = result.get(0);
        assertThat(animaliaItem.get("label")).isEqualTo("ANIMALIA");
        assertThat(animaliaItem.get("count")).isEqualTo(6L);
        assertThat(animaliaItem.get("fq")).isEqualTo("rk_kingdom:\"ANIMALIA\"");

        List<Map<String, Object>> animaliaChildren = (List<Map<String, Object>>) animaliaItem.get("children");
        assertThat(animaliaChildren).hasSize(3);

        // Promoted ORPHANORDER (count 3) should be sorted ahead of MAMMALIA (2) and INSECTA (1)
        assertThat(animaliaChildren.get(0).get("label")).isEqualTo("ORPHANORDER");
        assertThat(animaliaChildren.get(0).get("count")).isEqualTo(3L);
        assertThat(animaliaChildren.get(0).get("fq"))
                .isEqualTo("rk_kingdom:\"ANIMALIA\" AND -rk_class:* AND rk_order:\"ORPHANORDER\"");

        assertThat(animaliaChildren.get(1).get("label")).isEqualTo("MAMMALIA");
        assertThat(animaliaChildren.get(1).get("count")).isEqualTo(2L);
        assertThat(animaliaChildren.get(1).get("fq")).isEqualTo("rk_kingdom:\"ANIMALIA\" AND rk_class:\"MAMMALIA\"");

        List<Map<String, Object>> mammaliaChildren = (List<Map<String, Object>>) animaliaChildren.get(1).get("children");
        assertThat(mammaliaChildren).hasSize(1);
        assertThat(mammaliaChildren.get(0).get("label")).isEqualTo("DIPROTODONTIA");
        assertThat(mammaliaChildren.get(0).get("fq"))
                .isEqualTo("rk_kingdom:\"ANIMALIA\" AND rk_class:\"MAMMALIA\" AND rk_order:\"DIPROTODONTIA\"");

        assertThat(animaliaChildren.get(2).get("label")).isEqualTo("INSECTA");
        assertThat(animaliaChildren.get(2).get("count")).isEqualTo(1L);

        // Viruses has no non-empty children, so "children" key should be omitted
        Map<String, Object> virusesItem = result.get(1);
        assertThat(virusesItem.get("label")).isEqualTo("Viruses");
        assertThat(virusesItem).doesNotContainKey("children");
    }

    @Test
    void extractHierarchicalFacetItems_ignoresNonStringChildAggregationsWithoutThrowing() {
        String[] levels = {"rk_kingdom", "rankID"};
        Aggregate longTerms = Aggregate.of(a -> a.lterms(LongTermsAggregate.of(lt -> lt
                .docCountErrorUpperBound(0L)
                .sumOtherDocCount(0L)
                .buckets(b -> b.array(List.of())))));
        StringTermsBucket animalia = bucket("ANIMALIA", 5, Map.of(ElasticService.subAggName(1), longTerms));

        List<Map<String, Object>> result = ElasticService.extractHierarchicalFacetItems(
                List.of(animalia), levels, 0, null);

        assertThat(result).hasSize(1);
        assertThat(result.get(0)).doesNotContainKey("children");
    }

    @Test
    void termToQuery_treatsQuotedWildcardsAsLiteralTermAndUnquotedAsWildcardOrExists() {
        ElasticService service = new ElasticService(null, null, null, null);

        Op quotedStar = QueryParserUtil.parse("rk_order:\"*\"", f -> true);
        Query quotedStarQuery = service.termToQuery(quotedStar.terms.get(0), false);
        assertThat(quotedStarQuery.isExists()).isFalse();
        assertThat(quotedStarQuery.isWildcard()).isFalse();
        assertThat(quotedStarQuery.isMatchPhrase()).isTrue();
        assertThat(quotedStarQuery.matchPhrase().query()).isEqualTo("*");

        Op quotedQuestion = QueryParserUtil.parse("rk_order:\"Incertae sedis?\"", f -> true);
        Query quotedQuestionQuery = service.termToQuery(quotedQuestion.terms.get(0), false);
        assertThat(quotedQuestionQuery.isWildcard()).isFalse();
        assertThat(quotedQuestionQuery.isMatchPhrase()).isTrue();
        assertThat(quotedQuestionQuery.matchPhrase().query()).isEqualTo("Incertae sedis?");

        Op quotedKeywordStar = QueryParserUtil.parse("speciesGroup:\"*\"", f -> true);
        Query quotedKeywordStarQuery = service.termToQuery(quotedKeywordStar.terms.get(0), false);
        assertThat(quotedKeywordStarQuery.isTerm()).isTrue();
        assertThat(quotedKeywordStarQuery.term().value().stringValue()).isEqualTo("*");

        Op unquotedStar = QueryParserUtil.parse("rk_order:*", f -> true);
        Query unquotedStarQuery = service.termToQuery(unquotedStar.terms.get(0), false);
        assertThat(unquotedStarQuery.isExists()).isTrue();

        Op unquotedWildcard = QueryParserUtil.parse("rk_order:Dip*", f -> true);
        Query unquotedWildcardQuery = service.termToQuery(unquotedWildcard.terms.get(0), false);
        assertThat(unquotedWildcardQuery.isWildcard()).isTrue();
    }

    private static StringTermsBucket bucket(String key, long docCount, Map<String, Aggregate> subAggs) {
        return StringTermsBucket.of(b -> b.key(key).docCount(docCount).aggregations(subAggs));
    }

    private static Aggregate termsAgg(List<StringTermsBucket> buckets) {
        return Aggregate.of(a -> a.sterms(StringTermsAggregate.of(st -> st
                .docCountErrorUpperBound(0L)
                .sumOtherDocCount(0L)
                .buckets(b -> b.array(buckets)))));
    }
}
