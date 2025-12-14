/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useUser} from "@ala/common-ui";
import {useEffect, useState} from "react";
import {CompareResult, CompareRow, InfoTableRow, RecordResult} from "../../api/model.tsx";
import {OccurrenceTableRow} from "./occurrenceRow.tsx";
import {FormattedMessage, useIntl} from 'react-intl';

// TODO: move to external config files
const vernacularName_show = true;
const dwcExcludeFields = new Set("dataHubUid,dataProviderUid,institutionUid,year,month,day,modified,left,right,provenance,taxonID,preferredFlag,outlierForLayers,speciesGroups,associatedMedia,images,userQualityAssertion,speciesHabitats,duplicationType,taxonomicIssues,subspeciesID,nameMatchMetric,sounds,verbatimAssociatedMedia,datasetName,fieldNumber,samplingProtocol".split(","));
const manualDatasetFields = new Set("dataProviderUid,dataProviderName,dataProviderName,dataResourceUid,dataResourceName,dataResourceName,institutionUid,institutionName,institutionName,institutionCode,collectionUid,collectionName,collectionName,collectionCode,catalogNumber,otherCatalogNumbers,occurrenceID,citation,recordUuid,basisOfRecord,preparations,identifiedBy,identifierRole,recordedBy,userId,recordNumber,typeStatus,identificationQualifier,reproductiveCondition,sex,behavior,individualCount,lifeStage,rights,occurrenceDetails,duplicationStatus,associatedOccurrences".split(","));
const manualEventFields = new Set("datasetName,eventID,parentEventID,eventHierarchy,fieldNumber,identificationRemarks,eventDate,samplingProtocol,".split(","));
const manualTaxonomyFields = new Set("higherClassification,taxonConceptID,scientificName,originalNameUsage,originalNameUsageID,taxonRank,taxonRankID,vernacularName,kingdom,kingdomID,phylum,phylumID,classs,classID,order,orderID,family,familyID,genus,genusID,species,speciesID,specificEpithet,associatedTaxa".split(","));
const manualLocationFields = new Set("higherGeography,country,stateProvince,lga,locality,ibra,habitat,decimalLatitude,decimalLongitude,geodeticDatum,verbatimCoordinateSystem,verbatimLocality,waterBody,minimumDepthInMeters,maximumDepthInMeters,minimumElevationInMeters,maximumElevationInMeters,island,islandGroup,locationRemarks,fieldNotes,coordinatePrecision,coordinateUncertaintyInMeters,generalisedInMetres,informationWithheld,georeferenceVerificationStatus,georeferenceSources,georeferenceProtocol,georeferencedBy".split(","));

function RecordCore({record, compareRecord, collectionInfo, setEventHierarchy}: {
    record?: RecordResult,
    compareRecord?: CompareResult,
    collectionInfo?: any,
    setEventHierarchy: (hierarchy: string | undefined) => void
}) {
    // tables to display
    const [datasetTable, setDatasetTable] = useState<InfoTableRow[]>([]);
    const [eventTable, setEventTable] = useState<InfoTableRow[]>([]);
    const [taxonomyTable, setTaxonomyTable] = useState<InfoTableRow[]>([]);
    const [geospatialTable, setGeospatialTable] = useState<InfoTableRow[]>([]);
    const [datasetTableExtra, setDatasetTableExtra] = useState<InfoTableRow[]>([]);
    const [eventTableExtra, setEventTableExtra] = useState<InfoTableRow[]>([]);
    const [taxonomyTableExtra, setTaxonomyTableExtra] = useState<InfoTableRow[]>([]);
    const [geospatialTableExtra, setGeospatialTableExtra] = useState<InfoTableRow[]>([]);
    const [miscTable, setMiscTable] = useState<InfoTableRow[]>([]);

    const {userInfo} = useUser();
    const intl = useIntl();

    useEffect(() => {
        if (!record) return;
        if (!compareRecord) return;

        createDatasetTable(record);
        createTaxonomyTable(record);
        createGeospatialTable(record);
        createMiscTable(record);

        let extraDatasetTable: InfoTableRow[] = [];
        extraDatasetTable = addAllExtraDwcFields(compareRecord.Attribution, extraDatasetTable, manualDatasetFields);
        extraDatasetTable = addAllExtraDwcFields(compareRecord.Occurrence, extraDatasetTable, manualDatasetFields);
        setDatasetTableExtra(addAllExtraDwcFields(compareRecord.Identification, extraDatasetTable, manualDatasetFields));
        setTaxonomyTableExtra(addAllExtraDwcFields(compareRecord.Classification, [], manualTaxonomyFields));
        setGeospatialTableExtra(addAllExtraDwcFields(compareRecord.Location, [], manualLocationFields));
        setEventTableExtra(addAllExtraDwcFields(compareRecord.Event, [], manualEventFields));

        getEventInfo(record);

    }, [record, compareRecord]);

    function getEventInfo(data: RecordResult) {
        // no events service
        if (!import.meta.env.VITE_APP_EVENTS_ENABLED) {
            if (!data?.raw?.event?.eventID || !data?.processed?.attribution?.dataResourceUid) {
                return undefined;
            } else {
                createEventTable(data, undefined);
            }
        }

        // events service enabled
        if (data?.raw?.event?.eventID && data?.processed?.attribution?.dataResourceUid) {
            let query = eventsGraphqlQuery(data.processed.attribution.dataResourceUid, data.raw.event.eventID)
            fetch(import.meta.env.VITE_APP_EVENTS_GRAPHQL_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({query})
            }).then(res => res.json()).then(hierarchyResponse => {
                let hierarchy = hierarchyResponse?.eventSearch?.documents?.results?.eventTypeHierarchy[0];
                setEventHierarchy(hierarchy);
                createEventTable(data, hierarchy);
            });
        } else {
            createEventTable(data, undefined);
        }
    }

    function eventsGraphqlQuery(datasetKey: string, eventID: string): string {
        return `query list {
            eventSearch(predicate: { type: and, predicates: [
                {type:equals, key: "datasetKey", value: "${datasetKey}"},
                {type:equals, key: "eventID",  value: "${eventID}"}
            ]}) {
                documents(size: 1) {
                    results {
                        eventTypeHierarchy 
                    }
                }
            }
        }`;
    }

    function isClubView(): boolean {
        return userInfo?.roles?.includes(import.meta.env.VITE_APP_ROLE_ADMIN) || false;
    }

    function capitalize(text: string): string {
        if (!text) return "";
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }

    function addAllExtraDwcFields(data: CompareRow[], table: InfoTableRow[], manualFields: Set<string>): InfoTableRow[] {
        if (data) {
            for (let item of data) {
                if (!dwcExcludeFields.has(item.name) && !manualFields.has(item.name)) {
                    let tagBody = '';
                    let original = '';
                    let originalUrl = undefined;
                    let lookup = intl.formatMessage({id: item.name, defaultMessage: 'DEFAULT_MESSAGE'});
                    if (lookup == 'DEFAULT_MESSAGE') lookup = '';
                    let label = lookup || camelCaseToHuman(item.name) || capitalize(item.name);
                    if (item.processed && item.raw && item.processed == item.raw) {
                        tagBody = pipeWhitespace(item.processed);
                    } else if (!item.raw && item.processed) {
                        tagBody = pipeWhitespace(item.processed);
                    } else if (item.raw && !item.processed) {
                        tagBody = pipeWhitespace(item.raw);
                    } else {
                        tagBody = pipeWhitespace(item.processed)
                        original = intl.formatMessage({
                            id: 'recordcore.span03',
                            defaultMessage: 'Supplied as'
                        }) + ' "' + item.raw + '"';
                        originalUrl = item?.raw?.match(/^https?:\/\//) ? item.raw : undefined;
                    }
                    table.push({
                        fieldCode: item.name, fieldName: label,
                        text: tagBody,
                        original: original,
                        originalUrl: originalUrl
                    })
                }
            }
        }

        return [...table]; // return new array reference to trigger re-render
    }

    /**
     * Camel case converted, taken from JS code:
     *
     * str.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().capitalize();
     *
     * @attr text REQUIRED the input text
     */
    function camelCaseToHuman(text: string): string {
        if (!text) return "";
        // Insert space before capital letters, convert to lowercase, capitalize first letter
        let result = text.replace(/([a-z])([A-Z])/g, "$1 $2")
            .replace(/_/g, " ")
            .toLowerCase();
        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    function pipeWhitespace(input: string): string {
        // Inject whitespace around pipe using RegExp
        return input.replace(/(\S)\|(\S)/g, "$1 | $2");
    }

    function createDatasetTable(data: RecordResult) {
        let datasetTable: InfoTableRow[] = [];
        datasetTable.push({
            fieldCode: "dataProvider", fieldName: "Data provider",
            url: `${import.meta.env.VITE_APP_COLLECTORY_URL}/public/show/${data?.processed?.attribution?.dataProviderUid}`,
            text: data?.processed?.attribution?.dataProviderName || data?.processed?.attribution?.dataProviderUid
        });

        datasetTable.push({
            fieldCode: "dataResource", fieldName: "Data resource",
            url: `${import.meta.env.VITE_APP_COLLECTORY_URL}/public/show/${data?.raw?.attribution?.dataResourceUid}`,
            text: data?.processed?.attribution?.dataResourceName || data?.raw?.attribution?.dataResourceUid
        });

        datasetTable.push({
            fieldCode: "institutionCode", fieldName: "Institution",
            url: `${import.meta.env.VITE_APP_COLLECTORY_URL}/public/show/${data?.processed?.attribution?.institutionUid}`,
            text: data?.processed?.attribution?.institutionName,
            original: data?.raw?.occurrence?.institutionCode &&
                intl.formatMessage({
                    id: 'recordcore.span01',
                    defaultMessage: 'Supplied institution code'
                }) + ' ' + data?.raw?.occurrence?.institutionCode
        });

        datasetTable.push({
            fieldCode: "collectionCode", fieldName: "Collection",
            url: `${import.meta.env.VITE_APP_COLLECTORY_URL}/public/show/${data?.processed?.attribution?.collectionUid}`,
            text: data?.processed?.attribution?.collectionName || collectionInfo?.collectionName || data?.processed?.attribution?.collectionUid,
            original: data?.raw?.occurrence?.collectionCode &&
                intl.formatMessage({
                    id: 'recordcore.span02',
                    defaultMessage: 'Supplied collection code'
                }) + ' ' + data?.raw?.occurrence?.collectionCode
        });

        datasetTable.push({
            fieldCode: "catalogNumber", fieldName: "Catalogue Number",
            text: data?.processed?.occurrence?.catalogNumber || data?.raw?.occurrence?.catalogNumber,
            original: data?.processed?.occurrence?.catalogNumber && data?.raw?.occurrence?.catalogNumber &&
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.occurrence?.catalogNumber + '"'
        });

        datasetTable.push({
            fieldCode: "otherCatalogNumbers", fieldName: "Other catalogue numbers",
            text: data?.raw?.occurrence?.otherCatalogNumbers
        });

        datasetTable.push({
            fieldCode: "occurrenceID", fieldName: "Occurrence ID",
            text: data?.processed?.occurrence?.occurrenceID || data?.raw?.occurrence?.occurrenceID,
            url: (data?.processed?.occurrence?.occurrenceID || data?.raw?.occurrence?.occurrenceID)?.match(/^https?:\/\//) && (data?.processed?.occurrence?.occurrenceID || data?.raw?.occurrence?.occurrenceID),
            original: data?.processed?.occurrence?.occurrenceID ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' ' + data?.raw?.occurrence?.occurrenceID + '"' : ''
        });

        datasetTable.push({
            fieldCode: "citation", fieldName: "Record citation",
            text: data?.raw?.attribution?.citation
        });

        datasetTable.push({
            fieldCode: "basisOfRecord", fieldName: "Basis of record",
            text: data?.processed?.occurrence?.basisOfRecord || data?.raw?.occurrence?.basisOfRecord ||
                intl.formatMessage({id: 'recordcore.span04.01', defaultMessage: 'Not supplied'}),
            original: (data?.processed?.occurrence?.basisOfRecord != data?.raw?.occurrence?.basisOfRecord ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' ' + data?.raw?.occurrence?.basisOfRecord + '"' : undefined)
        });

        datasetTable.push({
            fieldCode: "preparations", fieldName: "Preparations",
            text: data?.raw?.occurrence?.preparations
        });

        datasetTable.push({
            fieldCode: "identifiedBy", fieldName: "Identified by",
            text: data?.raw?.identification?.identifiedBy
        });

        datasetTable.push({
            fieldCode: "identifierRole", fieldName: "Identifier role",
            text: data?.raw?.identification?.identifierRole
        });

        datasetTable.push({
            fieldCode: "collectorName",
            fieldName: data?.processed?.occurrence?.basisOfRecord?.includes('specimen') ?
                intl.formatMessage({id: 'recordcore.collectornamelabel.01', defaultMessage: 'Collectory'}) :
                data?.processed?.occurrence?.basisOfRecord?.includes('observation') ?
                    intl.formatMessage({id: 'recordcore.collectornamelabel.02', defaultMessage: 'Observer'}) :
                    intl.formatMessage({id: 'recordcore.collectornamelabel.03', defaultMessage: 'Collector/Observer'}),
            text: data?.processed?.occurrence?.recordedBy || data?.processed?.occurrence?.userId,
            original: intl.formatMessage({id: 'recordcore.span03', defaultMessage: 'Supplied as'}) + ' "' +
                (data?.raw?.occurrence?.recordedBy || data?.raw?.occurrence?.userId) + '"'
        });

        datasetTable.push({
            fieldCode: "userId", fieldName: "User ID",
            text: data?.alaUserName || data?.raw?.occurrence?.recordedBy,
            url: getLinkForUserId(data?.alaUserName || data?.raw?.occurrence?.recordedBy,
                data?.raw?.occurrence?.userId, data?.raw?.attribution?.dataResourceUid,
                data?.raw?.occurrence?.occurrenceID)
        });

        datasetTable.push({
            fieldCode: "recordNumber",
            fieldName: data?.processed?.occurrence?.basisOfRecord?.includes('specimen') ? "Collecting number" : "Record number",
            text: data?.raw?.occurrence?.recordNumber || data?.raw?.occurrence?.recordNumber,
            url: data?.raw?.occurrence?.recordNumber || data?.raw?.occurrence?.recordNumber,
            original: data?.processed?.occurrence?.recordNumber && data?.raw?.occurrence?.recordNumber ?
                intl.formatMessage({id: 'recordcore.span03', defaultMessage: 'Supplied as'}) + ' "' +
                data?.raw?.occurrence?.recordNumber + '"' : ''
        });

        datasetTable.push({
            fieldCode: "typeStatus", fieldName: "Type status",
            text: data?.processed?.identification?.typeStatus || data?.raw?.identification?.typeStatus,
            original: data?.processed?.identification?.typeStatus && data?.raw?.identification?.typeStatus ?
                intl.formatMessage({id: 'recordcore.span03', defaultMessage: 'Supplied as'}) + ' "' +
                data?.raw?.identification?.typeStatus + '"' : ''
        });

        datasetTable.push({
            fieldCode: "identificationQualifier", fieldName: "Identification qualifier",
            text: data?.raw?.identification?.identificationQualifier
        });

        datasetTable.push({
            fieldCode: "reproductiveCondition", fieldName: "Reproductive condition",
            text: data?.raw?.occurrence?.reproductiveCondition
        });

        datasetTable.push({
            fieldCode: "sex", fieldName: "Sex",
            text: data?.raw?.occurrence?.sex
        });

        datasetTable.push({
            fieldCode: "behavior", fieldName: "Behaviour",
            text: data?.raw?.occurrence?.behavior
        });

        datasetTable.push({
            fieldCode: "individualCount", fieldName: "Individual count",
            text: data?.raw?.occurrence?.individualCount
        });

        datasetTable.push({
            fieldCode: "lifeStage", fieldName: "Life stage",
            text: data?.raw?.occurrence?.lifeStage
        });

        datasetTable.push({
            fieldCode: "rights", fieldName: "Rights",
            text: data?.raw?.occurrence?.rights
        });

        datasetTable.push({
            fieldCode: "occurrenceDetails", fieldName: "More details",
            text: data?.raw?.occurrence?.occurrenceDetails,
            url: data?.raw?.occurrence?.occurrenceDetails
        });

        if (data?.processed?.occurrence?.duplicationStatus) {
            datasetTable.push({
                fieldCode: "duplicationStatus", fieldName: "Associated Occurrence Status",
                text: data?.processed?.occurrence?.duplicationStatus
            });

            datasetTable.push({
                fieldCode: "associatedOccurrences", fieldName: "Inferred Associated Occurrences",
                text: data?.processed?.occurrence?.duplicationStatus === 'R' ?
                    intl.formatMessage({id: 'recordcore.iao.01', defaultMessage: 'This record has'}) + ' ' +
                    data?.processed?.occurrence?.associatedOccurrences?.split("|").length +
                    intl.formatMessage({id: 'recordcore.iao.01.5', defaultMessage: 'inferred associated occurrences'})
                    : intl.formatMessage({
                        id: 'recordcore.iao.02',
                        defaultMessage: 'The occurrence is associated with a representative record'
                    }),
                original: intl.formatMessage({id: 'recordcore.iao.03', defaultMessage: 'For more information see'}) +
                    ' ' + intl.formatMessage({
                        id: 'recordcore.iao.04',
                        defaultMessage: 'Inferred associated occurrence details'
                    }),
                originalUrl: "#inferredOccurrenceDetails"
            });

            if (data?.raw?.occurrence?.associatedOccurrences && data?.raw?.occurrence?.associatedOccurrences.length > 0) {
                datasetTable.push({
                    fieldCode: "duplicationStatus", fieldName: "Associated Occurrences",
                    text: data?.raw?.occurrence?.associatedOccurrences
                });
            }
        }

        // the extra fields will be added later after compareRecord is fetched, and we expect that to take longer than this to complete

        setDatasetTable(datasetTable);
    }

    function createTaxonomyTable(data: RecordResult) {
        let taxonomyTable: InfoTableRow[] = [];

        taxonomyTable.push({
            fieldCode: "higherClassification", fieldName: "Higher classification",
            text: data?.raw?.classification?.higherClassification
        });

        taxonomyTable.push({
            fieldCode: "scientificName", fieldName: "Scientific name",
            text: data?.processed?.classification?.scientificName || data?.raw?.classification?.scientificName,
            url: data?.processed?.classification?.scientificName ?
                `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.taxonConceptID}`
                : undefined,
            original: (data?.processed?.classification?.scientificName && data?.raw?.classification?.scientificName != data?.raw?.classification?.scientificName) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.scientificName + '"' : undefined
        });

        taxonomyTable.push({
            fieldCode: "originalNameUsage", fieldName: "Original name",
            text: data?.processed?.classification?.originalNameUsage || data?.raw?.classification?.originalNameUsage,
            url: data?.processed?.classification?.originalNameUsageID ?
                `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.originalNameUsageID}`
                : undefined,
            original: (data?.processed?.classification?.originalNameUsage && data?.raw?.classification?.originalNameUsage?.toLowerCase() != data?.raw?.classification?.originalNameUsage?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.originalNameUsage + '"' : undefined
        });


        taxonomyTable.push({
            fieldCode: "taxonRank", fieldName: "Taxon rank",
            //text-transform: capitalize;
            text: data?.processed?.classification?.taxonRank || data?.raw?.classification?.taxonRank || "[rank not known]",
            original: (data?.processed?.classification?.taxonRank && data?.raw?.classification?.taxonRank?.toLowerCase() != data?.raw?.classification?.taxonRank?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.taxonRank + '"' : undefined
        });

        if (vernacularName_show) {
            taxonomyTable.push({
                fieldCode: "commonName", fieldName: "Common name",
                text: data?.processed?.classification?.vernacularName || data?.raw?.classification?.vernacularName,
                original: (data?.processed?.classification?.vernacularName && data?.raw?.classification?.vernacularName?.toLowerCase() != data?.raw?.classification?.vernacularName?.toLowerCase()) ?
                    intl.formatMessage({
                        id: 'recordcore.span03',
                        defaultMessage: 'Supplied as'
                    }) + ' "' + data?.raw?.classification?.vernacularName + '"' : undefined
            });
        }

        taxonomyTable.push({
            fieldCode: "kingdom", fieldName: "Kingdom",
            text: data?.processed?.classification?.kingdom || data?.raw?.classification?.kingdom,
            url: data?.processed?.classification?.kingdomID ? `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.kingdomID}` : undefined,
            original: (data?.processed?.classification?.kingdom && data?.raw?.classification?.kingdom?.toLowerCase() != data?.raw?.classification?.kingdom?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.kingdom + '"' : undefined
        });

        taxonomyTable.push({
            fieldCode: "phylum", fieldName: "Phylum",
            text: data?.processed?.classification?.phylum || data?.raw?.classification?.phylum,
            url: data?.processed?.classification?.phylumID ? `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.phylumID}` : undefined,
            original: (data?.processed?.classification?.phylum && data?.raw?.classification?.phylum?.toLowerCase() != data?.raw?.classification?.phylum?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.phylum + '"' : undefined
        });

        taxonomyTable.push({
            fieldCode: "classs", fieldName: "Class",
            text: data?.processed?.classification?.classs || data?.raw?.classification?.classs,
            url: data?.processed?.classification?.classID ? `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.classID}` : undefined,
            original: (data?.processed?.classification?.classs && data?.raw?.classification?.classs?.toLowerCase() != data?.raw?.classification?.classs?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.classs + '"' : undefined
        });

        taxonomyTable.push({
            fieldCode: "order", fieldName: "Order",
            text: data?.processed?.classification?.order || data?.raw?.classification?.order,
            url: data?.processed?.classification?.orderID ? `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.orderID}` : undefined,
            original: (data?.processed?.classification?.order && data?.raw?.classification?.order?.toLowerCase() != data?.raw?.classification?.order?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.order + '"' : undefined
        });

        taxonomyTable.push({
            fieldCode: "family", fieldName: "Family",
            text: data?.processed?.classification?.family || data?.raw?.classification?.family,
            url: data?.processed?.classification?.familyID ? `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.familyID}` : undefined,
            original: (data?.processed?.classification?.family && data?.raw?.classification?.family?.toLowerCase() != data?.raw?.classification?.family?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.family + '"' : undefined
        });

        taxonomyTable.push({
            fieldCode: "genus", fieldName: "Genus",
            text: data?.processed?.classification?.genus || data?.raw?.classification?.genus,
            url: data?.processed?.classification?.genusID ? `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.genusID}` : undefined,
            original: (data?.processed?.classification?.genus && data?.raw?.classification?.genus?.toLowerCase() != data?.raw?.classification?.genus?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.genus + '"' : undefined
        });

        taxonomyTable.push({
            fieldCode: "species", fieldName: "Species",
            style: {fontStyle: 'italic'},
            text: data?.processed?.classification?.species || data?.raw?.classification?.species ||
                (data?.raw?.classification?.specificEpithet && data?.raw?.classification?.genus ?
                    `${data?.raw?.classification?.genus} ${data?.raw?.classification?.specificEpithet}` : undefined),
            url: data?.processed?.classification?.speciesID ? `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.processed?.classification?.speciesID}` : undefined,
            original: (data?.processed?.classification?.species && data?.raw?.classification?.species?.toLowerCase() != data?.raw?.classification?.species?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.classification?.species + '"' : undefined
        });


        if (data?.raw?.occurrence?.associatedTaxa) {
            taxonomyTable.push({
                fieldCode: "associatedTaxa", fieldName: "Associated species",
                text: data?.raw?.occurrence?.associatedTaxa,
                url: `${import.meta.env.VITE_SPECIES_URL_PREFIX}/${data?.raw?.occurrence?.associatedTaxa.replace('  ', ' ')}`
            });
        }

        if (data?.raw?.classification?.taxonomicIssue && data?.raw?.classification?.taxonomicIssue.length > 0) {
            taxonomyTable.push({
                fieldCode: "taxonomicIssue", fieldName: "Taxonomic issues",
                text: data?.processed?.classification?.taxonomicIssue
            });
        }

        if (data?.processed?.classification?.nameMatchMetric) {
            taxonomyTable.push({
                fieldCode: "nameMatchMetric", fieldName: "Name match metric",
                text: data?.processed?.classification?.nameMatchMetric
            });
        }

        // the extra fields will be added later after compareRecord is fetched, and we expect that to take longer than this to complete

        setTaxonomyTable(taxonomyTable);
    }

    function createGeospatialTable(data: RecordResult) {
        let geospatialTable: InfoTableRow[] = [];

        geospatialTable.push({
            fieldCode: "higherGeography", fieldName: "Higher geography",
            text: data?.raw?.location?.higherGeography
        });

        geospatialTable.push({
            fieldCode: "country", fieldName: "Country",
            text: data?.processed?.location?.country || data?.processed?.location?.countryCode || data?.raw?.location?.country,
            original: data?.processed?.location?.country && data?.raw?.location?.country && (data?.processed?.location?.country?.toLowerCase() != data?.raw?.location?.country?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.location?.country + '"' : ''
        });

        geospatialTable.push({
            fieldCode: "state", fieldName: "State or territory",
            text: data?.processed?.location?.stateProvince || data?.raw?.location?.stateProvince,
            original: data?.processed?.location?.stateProvince && data?.raw?.location?.stateProvince && (data?.processed?.location?.stateProvince?.toLowerCase() != data?.raw?.location?.stateProvince?.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.location?.stateProvince + '"' : ''
        });

        geospatialTable.push({
            fieldCode: "locality", fieldName: "Local government area",
            text: data?.processed?.location?.lga || data?.raw?.location?.lga
        });

        geospatialTable.push({
            fieldCode: "locality", fieldName: "Locality",
            text: data?.processed?.location?.locality || data?.raw?.location?.locality,
            original: data?.processed?.location?.locality && data?.raw?.location?.locality && (data.processed.location.locality.toLowerCase() != data.raw.location.locality.toLowerCase()) ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data.raw.location.locality + '"' : ''
        });

        geospatialTable.push({
            fieldCode: "locality", fieldName: "Biogeographic region",
            text: data?.processed?.location?.ibra || data?.raw?.location?.ibra
        });

        geospatialTable.push({
            fieldCode: "habitat", fieldName: "Habitat",
            text: data?.processed?.location?.habitat || data?.raw?.location?.habitat,
            original: data?.raw?.location?.habitat && data?.raw?.location?.habitat != data?.processed?.location?.habitat ?
                intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.location?.habitat + '"' : ''
        });

        let latitudeText: number | undefined;
        let originalLatText: string | undefined;
        if (isClubView() && data?.sensitive && data?.raw?.location?.decimalLatitude) {
            latitudeText = data.raw.location.decimalLatitude;
        } else {
            latitudeText = data?.processed?.location?.decimalLatitude || data?.raw?.location?.decimalLatitude;

            if (data?.raw?.location?.decimalLatitude && data?.raw?.location?.decimalLatitude != data?.processed?.location?.decimalLatitude) {
                originalLatText = intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.location?.decimalLatitude + '"';
            }
        }
        geospatialTable.push({
            fieldCode: "latitude", fieldName: "Latitude",
            text: latitudeText !== undefined ? latitudeText.toString() : undefined,
            original: originalLatText
        });

        let longitudeText: number | undefined;
        let originalLngText: string | undefined;
        if (isClubView() && data?.sensitive && data?.raw?.location?.decimalLongitude) {
            longitudeText = data.raw.location.decimalLongitude;
        } else {
            longitudeText = data?.processed?.location?.decimalLongitude || data?.raw?.location?.decimalLongitude;

            if (data?.raw?.location?.decimalLongitude && data?.raw?.location?.decimalLongitude != data?.processed?.location?.decimalLongitude) {
                originalLngText = intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.location?.decimalLongitude + '"';
            }
        }
        geospatialTable.push({
            fieldCode: "longitude", fieldName: "Longitude",
            text: longitudeText !== undefined ? longitudeText.toString() : undefined,
            original: originalLngText
        });

        let geodeticDatumText: string | undefined;
        let originalDatumText: string | undefined;
        if (isClubView() && data?.sensitive && data?.raw?.location?.geodeticDatum) {
            geodeticDatumText = data.raw.location.geodeticDatum;
        } else {
            geodeticDatumText = data?.processed?.location?.geodeticDatum || data?.raw?.location?.geodeticDatum;

            if (data?.raw?.location?.geodeticDatum && data?.raw?.location?.geodeticDatum != data?.processed?.location?.geodeticDatum) {
                originalDatumText = intl.formatMessage({
                    id: 'recordcore.span03',
                    defaultMessage: 'Supplied as'
                }) + ' "' + data?.raw?.location?.geodeticDatum + '"';
            }
        }
        geospatialTable.push({
            fieldCode: "geodeticDatum", fieldName: "Geodetic datum",
            text: geodeticDatumText,
            original: originalDatumText
        });

        geospatialTable.push({
            fieldCode: "verbatimCoordinateSystem", fieldName: "Verbatim coordinate system",
            text: data?.raw?.location?.verbatimCoordinateSystem
        });

        geospatialTable.push({
            fieldCode: "verbatimLocality", fieldName: "Verbatim locality",
            text: data?.raw?.location?.verbatimLocality
        });

        geospatialTable.push({
            fieldCode: "waterBody", fieldName: "Water body",
            text: data?.raw?.location?.waterBody
        });

        geospatialTable.push({
            fieldCode: "minimumDepthInMeters", fieldName: "Minimum depth in metres",
            text: data?.raw?.location?.minimumDepthInMeters
        });

        geospatialTable.push({
            fieldCode: "maximumDepthInMeters", fieldName: "Maximum depth in metres",
            text: data?.raw?.location?.maximumDepthInMeters
        });

        geospatialTable.push({
            fieldCode: "minimumElevationInMeters", fieldName: "Minimum elevation in metres",
            text: data?.raw?.location?.minimumElevationInMeters
        });

        geospatialTable.push({
            fieldCode: "maximumElevationInMeters", fieldName: "Maximum elevation in metres",
            text: data?.raw?.location?.maximumElevationInMeters
        });

        geospatialTable.push({
            fieldCode: "island", fieldName: "Island",
            text: data?.raw?.location?.island
        });

        geospatialTable.push({
            fieldCode: "islandGroup", fieldName: "Island group",
            text: data?.raw?.location?.islandGroup
        });

        geospatialTable.push({
            fieldCode: "locationRemarks", fieldName: "Location remarks",
            text: data?.raw?.location?.locationRemarks
        });

        geospatialTable.push({
            fieldCode: "fieldNotes", fieldName: "Field notes",
            text: data?.raw?.location?.fieldNotes
        });

        if (data?.raw?.location?.decimalLatitude || data?.raw?.location?.decimalLongitude) {
            geospatialTable.push({
                fieldCode: "coordinatePrecision", fieldName: "Coordinate precision",
                text: data?.raw?.location?.coordinatePrecision || 'Unknown'
            });
        }

        geospatialTable.push({
            fieldCode: "coordinateUncertaintyInMeters", fieldName: "Coordinate uncertainty in metres",
            text: data?.raw?.location?.coordinateUncertaintyInMeters
        });

        geospatialTable.push({
            fieldCode: "generalisedInMetres", fieldName: "Coordinates generalised",
            text:
                data?.processed?.occurrence?.dataGeneralizations && data?.processed?.occurrence?.dataGeneralizations.includes('is already generalised') ?
                    data?.processed?.occurrence?.dataGeneralizations
                    : (data?.processed?.occurrence?.dataGeneralizations ?
                        intl.formatMessage({
                            id: 'recordcore.cg.label',
                            defaultMessage: 'Due to sensitivity concerns, the coordinates of this record have been generalised'
                        }) + ' ' +
                        data?.processed?.occurrence?.dataGeneralizations : '') +
                    (isClubView() ? ' ' + intl.formatMessage({
                        id: 'recordcore.cg.label2',
                        defaultMessage: 'NOTE: current user has "club view" and thus coordinates are not generalise.'
                    }) : '')

        });

        geospatialTable.push({
            fieldCode: "informationWithheld", fieldName: "Information withheld",
            text: data?.processed?.occurrence?.informationWithheld
        });


        geospatialTable.push({
            fieldCode: "georeferenceVerificationStatus", fieldName: "Georeference verification status",
            text: data?.raw?.location?.georeferenceVerificationStatus
        });

        geospatialTable.push({
            fieldCode: "georeferenceSources", fieldName: "Georeference sources",
            text: data?.raw?.location?.georeferenceSources
        });

        geospatialTable.push({
            fieldCode: "georeferenceProtocol", fieldName: "Georeference protocol",
            text: data?.raw?.location?.georeferenceProtocol
        });

        geospatialTable.push({
            fieldCode: "georeferencedBy", fieldName: "Georeferenced by",
            text: data?.raw?.location?.georeferencedBy
        });

        // the extra fields will be added later after compareRecord is fetched, and we expect that to take longer than this to complete
        setGeospatialTable(geospatialTable);
    }

    function createEventTable(data: RecordResult, eventHierarchy: any) {
        let eventTable: InfoTableRow[] = [];

        eventTable.push({
            fieldCode: "datasetName", fieldName: "Dataset / Survey Name",
            text: data?.raw?.event?.datasetName
        });

        eventTable.push({
            fieldCode: "eventID", fieldName: "Event ID",
            text: data?.raw?.event?.eventID,
            url: eventHierarchy ? import.meta.env.VITE_APP_EVENTS_EVENTURL + data?.raw?.event?.eventID : undefined
        });

        eventTable.push({
            fieldCode: "parentEventID", fieldName: "Parent Event ID",
            text: data?.raw?.event?.parentEventID,
            url: eventHierarchy ? import.meta.env.VITE_APP_EVENTS_EVENTURL + data?.raw?.event?.parentEventID : undefined
        });

        eventTable.push({
            fieldCode: "eventHierarchy", fieldName: "Event hierarchy",
            text: eventHierarchy && eventHierarchy.join(' / ')
        });

        eventTable.push({
            fieldCode: "fieldNumber", fieldName: "Field number",
            text: data?.raw?.occurrence?.fieldNumber
        });

        eventTable.push({
            fieldCode: "identificationRemarks", fieldName: "Identification remarks",
            text: data?.raw?.identification?.identificationRemarks
        });

        eventTable.push({
            fieldCode: "occurrenceDate",
            fieldName: data?.processed?.occurrence?.basisOfRecord?.includes('specimen') ?
                intl.formatMessage({id: 'recordcore.occurrencedatelabel.01', defaultMessage: 'Collecting date'}) :
                intl.formatMessage({id: 'recordcore.occurrencedatelabel.02', defaultMessage: 'Record date'}),
            text: getEventDateText(data),
            original: intl.formatMessage({
                id: 'recordcore.span03',
                defaultMessage: 'Supplied as'
            }) + ' "' + (data?.raw?.event?.eventDate || ("Year: " + data?.raw?.event?.year + ", Month: " + data?.raw?.event?.month + ", Day: " + data?.raw?.event?.day)) + '"'
        });

        eventTable.push({
            fieldCode: "samplingProtocol", fieldName: "Sampling protocol",
            text: data?.raw?.occurrence?.samplingProtocol
        });

        // the extra fields will be added later after compareRecord is fetched, and we expect that to take longer than this to complete

        setEventTable(eventTable);
    }

    function createMiscTable(data: RecordResult) {
        let miscTable: InfoTableRow[] = [];

        if (!data?.raw?.miscProperties) {
            return;
        }

        for (const [key, value] of Object.entries(data.raw.miscProperties).sort()) {
            if (!dwcExcludeFields.has(key)) {
                let label = camelCaseToHuman(key);
                miscTable.push({
                    fieldCode: key, fieldName: label,
                    text: value as string
                });
            }
        }

        setMiscTable(miscTable);
    }

    function getEventDateText(data: RecordResult): string {
        // No processed eventDate, but raw eventDate exists and no year/month/day
        if (!data?.processed?.event?.eventDate && data?.raw?.event?.eventDate &&
            !data?.raw?.event?.year && !data?.raw?.event?.month && !data?.raw?.event?.day) {
            return intl.formatMessage({id: 'recordcore.occurrencedatelabel.03', defaultMessage: 'date not supplied'});
        }

        // Processed eventDate exists
        if (data?.processed?.event?.eventDate) {
            return data.processed.event.eventDate;
        }

        // No processed eventDate, but year/month/day exists
        if (
            !data?.processed?.event?.eventDate &&
            (data?.processed?.event?.year || data?.processed?.event?.month || data?.processed?.event?.day)
        ) {
            const year = data.processed.event.year ?? "";
            const month = data.processed.event.month ?? "";
            const day = data.processed.event.day ?? "";
            return intl.formatMessage({id: 'recordcore.occurrencedatelabel.04', defaultMessage: 'Year'}) + ': ' + year +
                intl.formatMessage({id: 'recordcore.occurrencedatelabel.05', defaultMessage: 'Month'}) + ': ' + month +
                intl.formatMessage({id: 'recordcore.occurrencedatelabel.06', defaultMessage: 'Day'}) + ': ' + day;
        }

        return "";
    }

    function getLinkForUserId(userName?: string, userId?: string, dataResourceUid?: string, occurrenceId?: string): string {
        let url = '';

        if (userName) {
            if (dataResourceUid == import.meta.env.VITE_ALA_SIGHTINGS_DR && userId) {
                // ALA sightings
                url = `${import.meta.env.VITE_ALA_SIGHTINGS_URL}/spotter/${encodeURIComponent(userId)}`;
            } else if (dataResourceUid == import.meta.env.VITE_INATURALIST_DR && userId) {
                // iNaturalist
                url = `${import.meta.env.VITE_INATURALIST_URL}/people/${encodeURIComponent(userId)}`;
            } else if (dataResourceUid == import.meta.env.VITE_FLICKR_DR && occurrenceId) {
                // Flickr
                url = `${import.meta.env.VITE_FLICKR_URL}/photos/${occurrenceId.replace(/^https:\/\/www\.flickr\.com\/photos\/(.*?)\/\d+\//, '$1')}`;
            }
        }

        return url;
    }

    return <>
        <div id="occurrenceDataset">
            {/* sandboxUploadSourceLinks template deprecated */}
            <h3><FormattedMessage defaultMessage={'Dataset'} id={'recordcore.occurencedataset.title'}/></h3>
            <table className="occurrenceTable table table-bordered table-striped table-condensed" id="datasetTable">
                <tbody>
                {datasetTable && datasetTable.map((row: InfoTableRow, idx: number) =>
                    <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                        text={row.text} url={row.url} original={row.original}
                                        originalUrl={row.originalUrl}/>
                )}
                {datasetTableExtra && datasetTableExtra.map((row: InfoTableRow, idx: number) =>
                    <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                        text={row.text} url={row.url} original={row.original}
                                        originalUrl={row.originalUrl}/>
                )}
                </tbody>
            </table>
        </div>

        {((eventTable && Object.keys(eventTable).length > 0) || (eventTableExtra && Object.keys(eventTableExtra).length > 0)) &&
            <div id="occurrenceEvent">
                <h3>Event</h3>
                <table className="occurrenceTable table table-bordered table-striped table-condensed" id="eventTable">
                    <tbody>
                    {eventTable && eventTable.map((row: InfoTableRow, idx: number) =>
                        <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                            text={row.text} url={row.url} original={row.original}
                                            originalUrl={row.originalUrl}/>
                    )}
                    {eventTableExtra && eventTableExtra.map((row: InfoTableRow, idx: number) =>
                        <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                            text={row.text} url={row.url} original={row.original}
                                            originalUrl={row.originalUrl}/>
                    )}
                    </tbody>
                </table>
            </div>
        }

        {((taxonomyTable && Object.keys(taxonomyTable).length > 0) || (taxonomyTableExtra && Object.keys(taxonomyTableExtra).length > 0)) &&
            <div id="occurrenceTaxonomy">
                <h3>Taxonomy</h3>
                <table className="occurrenceTable table table-bordered table-striped table-condensed" id="taxonomyTable">
                    <tbody>
                    {taxonomyTable && taxonomyTable.map((row: InfoTableRow, idx: number) =>
                        <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                            text={row.text} url={row.url} original={row.original}
                                            originalUrl={row.originalUrl}/>
                    )}
                    {taxonomyTableExtra && taxonomyTableExtra.map((row: InfoTableRow, idx: number) =>
                        <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                            text={row.text} url={row.url} original={row.original}
                                            originalUrl={row.originalUrl}/>
                    )}
                    </tbody>
                </table>
            </div>
        }

        {((geospatialTable && Object.keys(geospatialTable).length > 0) || (geospatialTableExtra && Object.keys(geospatialTableExtra).length > 0)) &&
            <div id="occurrenceGeospatial">
                <h3>Geospatial</h3>
                <table className="occurrenceTable table table-bordered table-striped table-condensed" id="geospatialTable">
                    <tbody>
                    {geospatialTable && geospatialTable.map((row: InfoTableRow, idx: number) =>
                        <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                            text={row.text} url={row.url} original={row.original}
                                            originalUrl={row.originalUrl}/>
                    )}
                    {geospatialTableExtra && geospatialTableExtra.map((row: InfoTableRow, idx: number) =>
                        <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                            text={row.text} url={row.url} original={row.original}
                                            originalUrl={row.originalUrl}/>
                    )}
                    </tbody>
                </table>
            </div>
        }

        {miscTable && Object.keys(miscTable).length > 0 && <div id="additionalProperties">
            <h3>Additional properties</h3>
            <table className="occurrenceTable table table-bordered table-striped table-condensed"
                   id="miscellaneousPropertiesTable">
                <tbody>
                {miscTable.map((row: InfoTableRow, idx: number) =>
                    <OccurrenceTableRow key={idx} fieldCode={row.fieldCode} fieldName={row.fieldName} style={row.style}
                                        text={row.text} url={row.url} original={row.original}
                                        originalUrl={row.originalUrl}/>
                )}
                </tbody>
            </table>
        </div>
        }
    </>;
}

export default RecordCore;
