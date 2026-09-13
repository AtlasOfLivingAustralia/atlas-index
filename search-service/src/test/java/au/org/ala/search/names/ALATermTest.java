/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

package au.org.ala.search.names;

import org.junit.jupiter.api.Test;

import java.net.URI;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure-logic unit tests for {@link ALATerm}. No Spring context, no containers.
 */
class ALATermTest {

    @Test
    void defaultConstructor_usesAlaPrefixAndNamespace() {
        assertThat(ALATerm.nameID.prefix()).isEqualTo("ala:");
        assertThat(ALATerm.nameID.namespace()).isEqualTo(URI.create("http://ala.org.au/terms/1.0/"));
    }

    @Test
    void location_overridesPrefixAndNamespace() {
        assertThat(ALATerm.Location.prefix()).isEqualTo("dwc:");
        assertThat(ALATerm.Location.namespace()).isEqualTo(URI.create("http://rs.tdwg.org/dwc/terms/"));
    }

    @Test
    void simpleName_returnsEnumConstantName() {
        assertThat(ALATerm.nameID.simpleName()).isEqualTo("nameID");
        assertThat(ALATerm.principalTaxonID.simpleName()).isEqualTo("principalTaxonID");
    }

    @Test
    void qualifiedName_combinesNamespaceAndSimpleName() {
        assertThat(ALATerm.nameID.qualifiedName())
                .isEqualTo("http://ala.org.au/terms/1.0/nameID");
    }

    @Test
    void toString_combinesPrefixAndName() {
        assertThat(ALATerm.nameID.toString()).isEqualTo("ala:nameID");
        assertThat(ALATerm.Location.toString()).isEqualTo("dwc:Location");
    }

    @Test
    void isClass_alwaysFalse() {
        assertThat(ALATerm.nameID.isClass()).isFalse();
        assertThat(ALATerm.Location.isClass()).isFalse();
    }

    @Test
    void valueOf_matchesEnumConstantName() {
        assertThat(ALATerm.valueOf("nameID")).isEqualTo(ALATerm.nameID);
        assertThat(ALATerm.valueOf("Location")).isEqualTo(ALATerm.Location);
    }
}
