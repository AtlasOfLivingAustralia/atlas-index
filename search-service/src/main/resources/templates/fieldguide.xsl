<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
                xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
                xmlns:fo="http://www.w3.org/1999/XSL/Format">

    <xsl:output method="xml" indent="yes"/>

    <xsl:template match="/fieldguide">
        <fo:root font-family="Roboto">
            <!-- Page layout -->

            <fo:layout-master-set>
                <fo:simple-page-master master-name="first-page" page-height="29.7cm" page-width="21cm" margin="0cm"
                                       margin-top="-1pt">
                    <fo:region-body margin-top="6cm" margin-bottom="2cm"/>
                    <fo:region-before region-name="first-page-header" extent="3cm"/>
                    <fo:region-after extent="1cm"/>
                </fo:simple-page-master>

                <fo:simple-page-master master-name="other-pages" page-height="29.7cm" page-width="21cm" margin="0cm"
                                       margin-top="-1pt">
                    <fo:region-body margin-top="2.3cm" margin-bottom="0.5cm"/>
                    <fo:region-before region-name="subsequent-page-header" extent="3cm"/>
                    <fo:region-after extent="1cm"/>
                </fo:simple-page-master>

                <fo:page-sequence-master master-name="fieldguide-sequence">
                    <fo:repeatable-page-master-alternatives>
                        <fo:conditional-page-master-reference master-reference="first-page" page-position="first"/>
                        <fo:conditional-page-master-reference master-reference="other-pages" page-position="rest"/>
                    </fo:repeatable-page-master-alternatives>
                </fo:page-sequence-master>
            </fo:layout-master-set>

            <!-- Page sequence -->
            <fo:page-sequence master-reference="fieldguide-sequence">
                <!-- Static content for first page -->
                <fo:static-content flow-name="first-page-header">
                    <fo:block>
                        <fo:external-graphic src="images/field-guide-header-pg1.png" width="100%"
                                             content-width="scale-to-fit"/>
                    </fo:block>
                    <fo:block font-size="12px" margin-top="0.5cm" margin-left="2cm" font-style="italic" font-weight="bold">
                        This PDF was generated on <xsl:value-of select="formattedDate"/>.
                        <fo:basic-link external-destination="{dataLink}">
                            <fo:inline text-decoration="underline">View the original search query.</fo:inline>
                        </fo:basic-link>
                    </fo:block>
                </fo:static-content>

                <!-- Static content for subsequent pages -->
                <fo:static-content flow-name="subsequent-page-header">
                    <fo:block>
                        <fo:external-graphic src="images/field-guide-banner-other-pages.png" width="100%"
                                             content-width="scale-to-fit"/>
                    </fo:block>
                </fo:static-content>

                <!-- Static footer -->
                <fo:static-content flow-name="xsl-region-after" margin-left="0cm" margin-right="0cm" >
                    <fo:block>
                        <fo:block border-bottom="1pt solid black" margin-bottom="1pt" margin-top="0.3cm"/>
                    </fo:block>
                    <fo:table width="100%">
                        <fo:table-column column-width="50%"/>
                        <fo:table-column column-width="50%"/>
                        <fo:table-body>
                            <fo:table-row>
                                <fo:table-cell>
                                    <fo:block text-align="left" font-size="8pt" margin-left="0.5cm">
                                        <fo:basic-link external-destination="{baseUrl}">
                                            <fo:inline text-decoration="underline" color="blue">Atlas of Living
                                                Australia
                                            </fo:inline>
                                            <fo:inline>– Field Guide</fo:inline>
                                        </fo:basic-link>
                                    </fo:block>
                                </fo:table-cell>
                                <fo:table-cell>
                                    <fo:block text-align="right" font-size="8pt" margin-right="0.5cm">
                                        Page
                                        <fo:page-number/>
                                        of
                                        <fo:page-number-citation ref-id="last-page"/>
                                    </fo:block>
                                </fo:table-cell>
                            </fo:table-row>
                        </fo:table-body>
                    </fo:table>
                </fo:static-content>

                <!-- Main content -->

                <fo:flow flow-name="xsl-region-body" margin-left="0.5cm" margin-right="0.5cm">
                    <!-- Loop through families and taxa -->
                    <xsl:for-each select="group">
                        <xsl:for-each select="taxon">
                            <fo:block-container keep-together.within-page="always" break-before="auto" width="100%">
                                <fo:block space-before="0.5cm">&#160;</fo:block>
                                <xsl:if test="position() = 1">
                                    <fo:block font-size="12pt">
                                        Family:
                                        <fo:inline font-weight="bold">
                                            <xsl:value-of select="../name"/>
                                        </fo:inline>
                                    </fo:block>
                                    <fo:block border-bottom="0.5pt solid black" margin-top="2pt" margin-bottom="8pt"
                                              margin-right="0.5cm"/>
                                </xsl:if>
                                <fo:block font-size="12pt" margin-left="0.5cm" margin-top="0.2cm">
                                    Scientific name:
                                    <fo:inline font-style="italic" font-weight="bold" text-decoration="underline">
                                        <fo:basic-link external-destination="{../../fieldguideSpeciesUrl}{guid}">
                                            <xsl:value-of select="scientificName"/>
                                        </fo:basic-link>
                                    </fo:inline>
                                </fo:block>

                                <xsl:if test="commonName">
                                    <fo:block font-size="12pt" margin-left="0.5cm" font-weight="bold">
                                        <xsl:value-of select="commonName"/>
                                    </fo:block>
                                </xsl:if>

                                <fo:table table-layout="fixed" width="90%" margin-top="0.5cm">
                                    <fo:table-column column-width="40%"/>
                                    <fo:table-column column-width="40%"/>
                                    <fo:table-column column-width="20%"/>

                                    <fo:table-body>
                                        <fo:table-row>
                                            <fo:table-cell>
                                                <fo:block-container height="160px" text-align="center">
                                                    <fo:block>
                                                    <xsl:if test="string(imageUrl) != ''">
                                                        <fo:external-graphic src="{imageUrl}" width="200px"
                                                                             height="160px" content-width="scale-to-fit" content-height="scale-to-fit"/>
                                                    </xsl:if>
                                                    </fo:block>
                                                </fo:block-container>
                                            </fo:table-cell>

                                            <fo:table-cell>
                                                <fo:block text-align="center">
                                                    <fo:external-graphic src="{../../biocacheMapUrl}{guid}%22"
                                                                         content-width="scale-to-fit" width="100%"
                                                                         height="160px"/>
                                                </fo:block>
                                            </fo:table-cell>

                                            <fo:table-cell>
                                                <fo:block text-align="center">
                                                    <fo:external-graphic src="{../../biocacheLegendUrl}{guid}%22"
                                                                         content-width="scale-to-fit" width="100%"
                                                                         height="160px"/>
                                                </fo:block>
                                            </fo:table-cell>
                                        </fo:table-row>
                                    </fo:table-body>
                                </fo:table>
                            </fo:block-container>
                        </xsl:for-each>
                    </xsl:for-each>

                    <!-- Attribution -->
                    <fo:block break-before="page"/>
                    <fo:block font-size="14pt" font-weight="bold" margin-left="0.75cm">Attribution</fo:block>
                    <fo:block margin-left="0.5cm" margin-right="0.5cm" space-before="5pt">
                        <fo:block border-bottom="0.5pt solid black" margin-top="2pt" margin-right="0.5cm"/>
                    </fo:block>

                    <!-- Loop through families and taxa -->
                    <xsl:for-each select="group">
                        <xsl:for-each select="taxon">
                            <fo:block-container keep-together.within-page="always" break-before="auto" width="100%" margin-left="0.75cm" margin-right="0.5cm">
                                <fo:block font-size="12pt" font-style="italic" font-weight="bold" space-before="18pt">
                                    <xsl:value-of select="scientificName"/>
                                </fo:block>
                                <xsl:if test="string(datasetName) != ''">
                                    <fo:block font-size="10pt" space-before="3pt">
                                        Taxonomic information supplied by:
                                        <fo:basic-link
                                                external-destination="{../../collectoryUrl}/public/show/{datasetID}">
                                            <fo:inline text-decoration="underline" color="blue">
                                                <xsl:value-of select="datasetName"/>
                                            </fo:inline>
                                        </fo:basic-link>
                                    </fo:block>
                                </xsl:if>

                                <xsl:if test="string(imageDataResourceURL) != ''">
                                    <fo:block font-size="10pt" space-before="3pt">
                                        Image sourced from:
                                        <fo:basic-link external-destination="{imageDataResourceURL}">
                                            <fo:inline text-decoration="underline" color="blue">
                                                <xsl:value-of select="imageDataResourceName"/>
                                            </fo:inline>
                                        </fo:basic-link>
                                    </fo:block>
                                </xsl:if>

                                <xsl:if test="string(imageCreator) != '' and string(imageDataResourceUid) != ''">
                                    <fo:block font-size="10pt" space-before="3pt">
                                        Image by:
                                        <fo:basic-link
                                                external-destination="{../../collectoryUrl}/public/show/{imageDataResourceUid}">
                                            <fo:inline text-decoration="underline" color="blue">
                                                <xsl:value-of select="imageCreator"/>
                                            </fo:inline>
                                        </fo:basic-link>
                                        <fo:inline>&#160;</fo:inline>
                                        <xsl:if test="string(imageLicenceUrl) != ''">
                                            <fo:basic-link color="blue" external-destination="{imageLicenceUrl}">
                                                <fo:inline text-decoration="underline" color="blue">
                                                    <xsl:value-of select="imageLicence"/>
                                                </fo:inline>
                                            </fo:basic-link>
                                        </xsl:if>
                                    </fo:block>
                                </xsl:if>

                                <xsl:if test="string(imageRights) != ''">
                                    <fo:block font-size="10pt" space-before="3pt">Image rights:
                                        <xsl:value-of select="imageRights"/>
                                    </fo:block>
                                </xsl:if>
                            </fo:block-container>
                        </xsl:for-each>
                    </xsl:for-each>

                    <!-- Last page marker -->
                    <fo:block id="last-page"/>
                </fo:flow>
            </fo:page-sequence>
        </fo:root>
    </xsl:template>
</xsl:stylesheet>
