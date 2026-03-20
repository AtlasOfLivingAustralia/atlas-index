/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

// Much of the DOI response is unstructured. Only define the fields we need.
import {CSSProperties} from "react";

interface Occurrence {
    uuid: string;
    taxonRank?: string;
    scientificName?: string;
    raw_scientificName?: string;
    vernacularName?: string;
    raw_vernacularName?: string;
    eventDate?: number;
    year?: number;
    stateProvince?: string;
    country?: string;
    institutionName?: string;
    collectionName?: string;
    dataResourceName?: string;
    basisOfRecord?: string;
    raw_catalogNumber?: string;
    raw_collectionCode?: string;
}

interface OccurrenceListResult {
    occurrences: Occurrence[];
    totalRecords: number;
}

interface DataQualityInfo {
    profile: string;
    unfilteredCount: number | undefined;
    selectedFilters: string[] | undefined;
    expand: boolean;
}

interface FacetItem {
    label: string;
    count: number;
    fq: string;
    i18nCode: string;
}

interface Facet {
    label: string;
    facets: FacetItem [] | undefined;
}

interface GroupedFacetData {
    [key: string]: Facet[];
}

interface QualityFilter {
    id: number;
    enabled: boolean;
    description: string;
    filter: string;
    displayOrder: number;
    inverseFilter: string;
}

interface QualityCategory {
    id: number;
    enabled: boolean;
    name: string;
    label: string;
    description: string;
    displayOrder: number;
    inverseFilter: string;
    qualityFilters: QualityFilter[];
}

interface QualityProfile {
    id: number;
    name: string;
    shortName: string;
    description: string;
    contactName: string;
    contactEmail: string;
    enabled: boolean;
    isDefault: boolean;
    displayOrder: number;
    dateCreated: Date | undefined;
    lastUpdated: Date | undefined;
    categories: QualityCategory[];
}

interface FieldInfo {
    name: string,
    jsonName?: string,
    downloadName?: string,
    description?: string,
    downloadDescription?: string,
    dataType?: string,
    indexed?: boolean,
    stored?: boolean,
    multiValued?: boolean,
    i18nValues?: boolean,
    info?: string,
    infoUrl?: string,
    dwcTerm?: string,
    classs?: string,
    category?: string
}

interface IndexFields {
    [key: string]: FieldInfo;
}

interface Fq {
    name: string;
    fq: string;
    href: string;
}

interface AdvancedSearch {
    [key: string]: Fq[];
}

// used by the species group import
interface SpeciesGroup {
    name: string;
    children?: SpeciesGroup[];
}

// used for the left hand side section for the listing of species groups
interface SpeciesGroupItem {
    name: string;
    indent: number;
}

// used for the right hand side section for the listing of species
interface SpeciesListItem {
    guid: string | null;
    commonName: string | null;
    name: string;
    count: number;
}

interface InfoTableRow {
    fieldCode: string;
    fieldName: string;
    url?: string | null;
    text?: string | string[];
    original?: string;
    originalUrl?: string;
    style?: CSSProperties;
}

interface OccurrenceResult {
    basisOfRecord?: string;
    catalogNumber?: string;
    occurrenceID?: string;
    recordedBy?: string;
    userId?: string;
    duplicationStatus?: string;
    associatedOccurrences?: string;
    recordNumber?: string;
    reproductiveCondition?: string;
    sex?: string;
    behavior?: string;
    individualCount?: string;
    lifeStage?: string;
    rights?: string;
    occurrenceDetails?: string;
    preparations?: string;
    otherCatalogNumbers?: string;
    collectionCode?: string;
    institutionCode?: string;
    associatedTaxa?: string;
    dataGeneralizations?: string;
    informationWithheld?: string;
    fieldNumber?: string;
    samplingProtocol?: string;
    outlierForLayers?: string[];
    photographer?: string;
    rightsholder?: string;
    fieldNotes?: string;
}

interface ClassificationResult {
    scientificName?: string;
    taxonConceptID?: string;
    originalNameUsage?: string;
    originalNameUsageID?: string;
    taxonRank?: string;
    taxonRankID?: number;
    vernacularName?: string;
    kingdom?: string;
    kingdomID?: string;
    phylum?: string;
    phylumID?: string;
    classs?: string;
    classID?: string;
    order?: string;
    orderID?: string;
    family?: string;
    familyID?: string;
    genus?: string;
    genusID?: string;
    species?: string;
    speciesID?: string;
    taxonomicIssue?: string[];
    specificEpithet?: string;
    nameMatchMetric?: string;
    higherClassification?: string;
    scientificNameAuthorship?: string;
}

interface LocationResult {
    country?: string;
    countryCode?: string;
    stateProvince?: string;
    lga?: string;
    locality?: string;
    ibra?: string;
    habitat?: string;
    decimalLatitude?: number;
    decimalLongitude?: number;
    geodeticDatum?: string;
    higherGeography?: string;
    verbatimCoordinateSystem?: string;
    waterBody?: string;
    islandGroup?: string;
    island?: string;
    maximumElevationInMeters?: string;
    minimumElevationInMeters?: string;
    locationRemarks?: string;
    coordinateUncertaintyInMeters?: string;
    coordinatePrecision?: string;
    georeferenceVerificationStatus?: string;
    georeferenceSources?: string;
    georeferenceProtocol?: string;
    georeferencedBy?: string;
    minimumDepthInMeters?: string;
    maximumDepthInMeters?: string;
    verbatimLocality?: string;
}

interface IdentificationResult {
    identifiedBy?: string;
    identificationRemarks?: string;
    typeStatus?: string;
    identificationQualifier?: string;
    identifierRole?: string;
}

interface EventResult {
    eventID?: string;
    eventDate?: string;
    eventTime?: string;
    year?: number;
    month?: number;
    day?: number;
    datasetName?: string;
    parentEventID?: string

}

interface AttributionResult {
    institutionName?: string;
    institutionUid?: string;
    institutionCode?: string;
    collectionName?: string;
    collectionUid?: string;
    collectionCode?: string;
    datasetName?: string;
    dataResourceUid?: string;
    dataResourceName?: string;
    dataProviderUid?: string;
    dataProviderName?: string;
    citation?: string;
    provenance?: string;
}

interface ResultItem {
    uuid?: string;
    occurrence?: OccurrenceResult;
    identification?: IdentificationResult;
    event?: EventResult;
    attribution?: AttributionResult;
    classification?: ClassificationResult;
    location?: LocationResult;
    miscProperties?: { [key: string]: string };
    el?: { [key: string]: number };
    cl?: { [key: string]: string };
    lastModifiedTime?: string;
}

interface ReferencedResult {
    id?: string;
    dataResourceUid?: string;
    identifier?: string;
    scientificName?: string;
    decimalLongitude?: number;
    decimalLatitude?: number;
    year?: number;
    _nest_parent_?: string;
    _root_?: string;
}

interface DqAssertion {
    wiki: string;
    name: string;
    description: string;
}

interface SystemAssertion {
    code: string;
    name: string;
}

interface SystemAssertionsResult {
    failed: SystemAssertion[];
    warning: SystemAssertion[];
    passed: SystemAssertion[];
    missing: SystemAssertion[];
    unchecked: SystemAssertion[];
}

interface MediaFormatsResult {
    smallImageUrl?: string;
    largeImageUrl?: string;
    imageUrl?: string;
}

interface MediaMetadataResult {
    creator?: string;
    rights?: string;
    rightsHolder?: string;
    license?: string;
}

interface MediaResult {
    alternativeFormats?: MediaFormatsResult;
    filePath?: string;
    metadata?: MediaMetadataResult;
}

interface RecordResult {
    systemAssertions: SystemAssertionsResult;
    processed: ResultItem;
    raw: ResultItem;
    alaUserName?: string;
    sensitive?: string;
    userId?: string;
    referencedPublications: ReferencedResult[];
    sounds?: MediaResult[];
    images?: MediaResult[];
}

type OccurrenceTableRowProps = {
    fieldName: string; // field label
    fieldCode?: string; // css class, and field label formatting guide
    url?: string | null; // optional url to link the text to, if not beginning with http(s)://, no link is created
    text?: string | string[] | number; // main text to display
    original?: string; // optional original value to display below the main text
    originalUrl?: string; // optional url to link the original value to
    style?: CSSProperties; // optional inline styles for the text
};

type CompareRow = {
    name: string;
    raw: string;
    processed: string;
}

type CompareResult = {
    Attribution: CompareRow[];
    Classification: CompareRow[];
    Event: CompareRow[];
    Identification: CompareRow[];
    Location: CompareRow[];
    Occurrence: CompareRow[];
}

export type {
    DataQualityInfo,
    FacetItem,
    Facet,
    GroupedFacetData,
    QualityProfile,
    QualityCategory,
    QualityFilter,
    FieldInfo,
    IndexFields,
    Fq,
    AdvancedSearch,
    SpeciesGroup,
    SpeciesGroupItem,
    SpeciesListItem,
    InfoTableRow,
    RecordResult,
    ResultItem,
    LocationResult,
    ClassificationResult,
    OccurrenceResult,
    OccurrenceTableRowProps,
    CompareRow,
    CompareResult,
    IdentificationResult,
    EventResult,
    AttributionResult,
    ReferencedResult,
    DqAssertion,
    SystemAssertion,
    Occurrence,
    OccurrenceListResult
};
