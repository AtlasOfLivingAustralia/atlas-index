// import Modal from "react-bootstrap/esm/Modal";
import {DataQualityInfo} from "../../api/sources/model.ts";
import {useEffect, useState} from "react";

interface DataQualityInfoModalProps {
    onClose: () => void,
    dataQualityInfo: DataQualityInfo,
    dataQuality: any[]
}

function DataQualityInfoModal({onClose, dataQualityInfo, dataQuality}: DataQualityInfoModalProps) {

    const [data, setData] = useState({});

    useEffect(() => {
        for (let dq of dataQuality) {
            if (dq.shortName === dataQualityInfo.profile) {
                setData(dq)
            }
        }
    }, [dataQualityInfo]);

    function infoUrl(fq: string) {
        let match = fq.match(/-?assertions:(\w+)/);
        if (match && match.length > 1) {
            return "https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/" + match[1];
        }

        match = fq.match(/-?(\w+):/);
        if (match && match.length > 1) {
            return "https://github.com/AtlasOfLivingAustralia/ala-dataquality/wiki/" + match[1];
        }

        return null;
    }
    return <>
        <Modal show={true} onHide={onClose} size="xl">
            <Modal.Header closeButton>
            </Modal.Header>
            <Modal.Body>
                <h4 className="dqH4">Data quality profile description</h4>
                <table className="table table-bordered table-condensed table-striped">
                    <tbody>
                    <tr>
                        <td>Profile name</td>
                        {/*@ts-ignore*/}
                        <td>{data.name}</td>
                    </tr>
                    <tr>
                        <td>Profile short name</td>
                        {/*@ts-ignore*/}
                        <td>{data.shortName}</td>
                    </tr>
                    <tr>
                        <td>Profile description</td>
                        {/*@ts-ignore*/}
                        <td>{data.description}
                        </td>
                    </tr>
                    <tr>
                        <td>Owner</td>
                        {/*@ts-ignore*/}
                        <td>{data.contactName}</td>
                    </tr>
                    <tr>
                        <td>Contact</td>
                        {/*@ts-ignore*/}
                        <td><a target="_blank" href={"mailto: " + data.contactEmail}>{data.contactEmail}</a>
                        </td>
                    </tr>
                    </tbody>
                </table>

                <h4 className="dqH4">Filter categories:</h4>

                {/*@ts-ignore*/}
                {data.categories && data.categories.map((cat, idx) => <>
                    <div className="dqCategory">
                        <b>{cat.name}</b><br/>
                        <div className="dqCategoryDesc">{cat.description}</div>
                    </div>
                    <table
                        className="table cat-table table-bordered table-condensed table-striped">
                        <tbody>
                        <tr>
                            <th>Filter description</th>
                            <th>Filter value</th>
                            <th>Further information</th>
                        </tr>

                        {/*@ts-ignore*/}
                        {cat.qualityFilters.map((filter, idx) =>
                            <tr key={idx}>
                                <td className="filter-description">
                                    {filter.description}
                                </td>
                                <td className="filter-value no-wrap">
                                    {filter.filter}</td>
                                <td className="filter-wiki">
                                    {infoUrl(filter.filter) && <a href={infoUrl(filter.filter) || ''} target="_blank">Link</a>}
                                </td>
                            </tr>
                        )}

                        </tbody>
                    </table>

                </>)}

            </Modal.Body>
            <Modal.Footer>
                <div className="d-flex w-100">
                    <a href="https://support.ala.org.au/support/solutions/articles/6000240256-getting-started-with-the-data-quality-filters"
                       target="_blank">Learn More</a>

                    <button className="btn btn-default btn-sm border-black ms-auto" onClick={() => onClose()}>Close
                    </button>
                </div>
            </Modal.Footer>
        </Modal>
    </>
}

export default DataQualityInfoModal;


//                 <h4>Filter categories:</h4>
//
//
//                 <div>
//                     <b>Exclude spatially suspect records</b><br/>
//                     Exclude records with a spatially suspect flag.
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation="{&quot;false&quot;:&quot;Spatially suspect&quot;}"
//                     data-filters="[&quot;-spatiallyValid:\&quot;false\&quot;&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records where spatial validity is &quot;false&quot;"></td>
//                         <td className="filter-value">
//                             <span>-spatiallyValid:"false"</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude records based on scientific name quality</b><br/>
//                     Exclude records with scientific name related quality
//                     assertions
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation="{&quot;TAXON_MATCH_NONE&quot;:{&quot;name&quot;:&quot;TAXON_MATCH_NONE&quot;,&quot;description&quot;:&quot;Matching to the taxonomic backbone cannot be done cause there was no match at all or severalmatches with too little information to keep them apart (homonyms).&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;UNKNOWN_KINGDOM&quot;:{&quot;name&quot;:&quot;UNKNOWN_KINGDOM&quot;,&quot;description&quot;:&quot;Kingdom provided doesn't match a known kingdom e.g. Animalia, Plantae&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;INVALID_SCIENTIFIC_NAME&quot;:{&quot;name&quot;:&quot;INVALID_SCIENTIFIC_NAME&quot;,&quot;description&quot;:&quot;The scientific name provided is not structured as a valid scientific name. Also catches rank values or values such as \&quot;UNKNOWN\&quot;&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;TAXON_HOMONYM&quot;:{&quot;name&quot;:&quot;TAXON_HOMONYM&quot;,&quot;description&quot;:&quot;The supplied name and hierarchy is not enough to uniquely determine the name&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;TAXON_SCOPE_MISMATCH&quot;:{&quot;name&quot;:&quot;TAXON_SCOPE_MISMATCH&quot;,&quot;description&quot;:&quot;The supplied hints do not match the final name match&quot;,&quot;wiki&quot;:&quot;Wiki&quot;}}"
//                     data-filters="[&quot;-assertions:TAXON_MATCH_NONE&quot;,&quot;-assertions:INVALID_SCIENTIFIC_NAME&quot;,&quot;-assertions:TAXON_HOMONYM&quot;,&quot;-assertions:UNKNOWN_KINGDOM&quot;,&quot;-assertions:TAXON_SCOPE_MISMATCH&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion that the scientific name provided does not match any of the names lists used by the ALA.  For a full explanation of the ALA name matching process see https://github.com/AtlasOfLivingAustralia/ala-name-matching"></td>
//                         <td className="filter-value">
//                             <span>-assertions:TAXON_MATCH_NONE</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion that the scientific name provided is not structured as a valid scientific name. Also catches rank values or values such as &quot;UNKNOWN&quot;"></td>
//                         <td className="filter-value">
//                             <span>-assertions:INVALID_SCIENTIFIC_NAME</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion that the name and classification supplied can't be used to choose between 2 homonyms"></td>
//                         <td className="filter-value">
//                             <span>-assertions:TAXON_HOMONYM</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion that kingdom provided doesn't match a known kingdom e.g. Animalia, Plantae"></td>
//                         <td className="filter-value">
//                             <span>-assertions:UNKNOWN_KINGDOM</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion that the scientific name provided in the record does not match the expected taxonomic scope of the resource e.g. Mammal records attributed to bird watch group"></td>
//                         <td className="filter-value">
//                             <span>-assertions:TAXON_SCOPE_MISMATCH</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude records with additional spatial quality
//                         issues</b><br/>
//                     Exclude records with location related data quality
//                     assertions
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation="{&quot;PRESUMED_NEGATED_LATITUDE&quot;:{&quot;name&quot;:&quot;PRESUMED_NEGATED_LATITUDE&quot;,&quot;description&quot;:&quot;Record appears to be referencing a location in the wrong hemisphere&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;PRESUMED_SWAPPED_COORDINATE&quot;:{&quot;name&quot;:&quot;PRESUMED_SWAPPED_COORDINATE&quot;,&quot;description&quot;:&quot;Latitude and longitude appear to be swapped&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;COORDINATES_CENTRE_OF_STATEPROVINCE&quot;:{&quot;name&quot;:&quot;COORDINATES_CENTRE_OF_STATEPROVINCE&quot;,&quot;description&quot;:&quot;Coordinates are the exact centre of the state or territory&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;COORDINATES_CENTRE_OF_COUNTRY&quot;:{&quot;name&quot;:&quot;COORDINATES_CENTRE_OF_COUNTRY&quot;,&quot;description&quot;:&quot;Coordinates are the exact centre of the country&quot;,&quot;wiki&quot;:&quot;Wiki&quot;},&quot;PRESUMED_NEGATED_LONGITUDE&quot;:{&quot;name&quot;:&quot;PRESUMED_NEGATED_LONGITUDE&quot;,&quot;description&quot;:&quot;Record appears to be referencing a location in the wrong hemisphere&quot;,&quot;wiki&quot;:&quot;Wiki&quot;}}"
//                     data-filters="[&quot;-establishmentMeans:\&quot;MANAGED\&quot;&quot;,&quot;-decimalLatitude:0&quot;,&quot;-decimalLongitude:0&quot;,&quot;-assertions:\&quot;PRESUMED_SWAPPED_COORDINATE\&quot;&quot;,&quot;-assertions:\&quot;COORDINATES_CENTRE_OF_STATEPROVINCE\&quot;&quot;,&quot;-assertions:\&quot;COORDINATES_CENTRE_OF_COUNTRY\&quot;&quot;,&quot;-assertions:\&quot;PRESUMED_NEGATED_LATITUDE\&quot;&quot;,&quot;-assertions:\&quot;PRESUMED_NEGATED_LONGITUDE\&quot;&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion of the occurence is cultivated or escaped from captivity"></td>
//                         <td className="filter-value">
//                             <span>-establishmentMeans:"MANAGED"</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion of latitude value provided is zero"></td>
//                         <td className="filter-value">
//                             <span>-decimalLatitude:0</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion of longitude value provided is zero"></td>
//                         <td className="filter-value">
//                             <span>-decimalLongitude:0</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion of  latitude and longitude have been transposed"></td>
//                         <td className="filter-value">
//                             <span>-assertions:"PRESUMED_SWAPPED_COORDINATE"</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion of coordinates are the exact centre of the state or territory"></td>
//                         <td className="filter-value">
//                             <span>-assertions:"COORDINATES_CENTRE_OF_STATEPROVINCE"</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with an assertion of  coordinates are the exact centre of the country"></td>
//                         <td className="filter-value">
//                             <span>-assertions:"COORDINATES_CENTRE_OF_COUNTRY"</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with &quot;Latitude is negated&quot; warning"></td>
//                         <td className="filter-value">
//                             <span>-assertions:"PRESUMED_NEGATED_LATITUDE"</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with &quot;Longitude is negated&quot; warning"></td>
//                         <td className="filter-value">
//                             <span>-assertions:"PRESUMED_NEGATED_LONGITUDE"</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude duplicate records</b><br/>
//                     Exclude duplicate records
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation=""
//                     data-filters="[&quot;-(duplicate_status:\&quot;ASSOCIATED\&quot; AND duplicateType:\&quot;DIFFERENT_DATASET\&quot;)&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude duplicates from different datasets that are not the representative record"></td>
//                         <td className="filter-value"><span>-(duplicate_status:"ASSOCIATED" AND duplicateType:"DIFFERENT_DATASET")</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude records based on location uncertainty</b><br/>
//                     Exclude records with high uncertainty
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation=""
//                     data-filters="[&quot;-coordinateUncertaintyInMeters:[10001 TO *]&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records where coordinate uncertainty (in metres) is greater than 10km"></td>
//                         <td className="filter-value"><span>-coordinateUncertaintyInMeters:[10001 TO *]</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude records with unresolved user annotations</b><br/>
//                     Exclude records with open user assertions
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation="{&quot;50001&quot;:&quot;Open issue&quot;,&quot;50005&quot;:&quot;Unconfirmed&quot;}"
//                     data-filters="[&quot;-userAssertions:50001&quot;,&quot;-userAssertions:50005&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with unresolved user  assertions"></td>
//                         <td className="filter-value">
//                             <span>-userAssertions:50001</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records with unconfirmed  user assertions"></td>
//                         <td className="filter-value">
//                             <span>-userAssertions:50005</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude records that are environmental outliers</b><br/>
//                     Exclude records that are an outlier (not within the expected
//                     range) against 3 or more environmental layers according to a
//                     reverse jacknife test
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation=""
//                     data-filters="[&quot;-outlierLayerCount:[3 TO *]&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records where outlier layer count is 3 or more"></td>
//                         <td className="filter-value"><span>-outlierLayerCount:[3 TO *]</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude records based on record type</b><br/>
//                     Exclude environmental DNA and fossil specimen records
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation="{&quot;FOSSIL_SPECIMEN&quot;:&quot;Fossil specimen&quot;}"
//                     data-filters="[&quot;-basisOfRecord:\&quot;FOSSIL_SPECIMEN\&quot;&quot;,&quot;-(basisOfRecord:\&quot;MATERIAL_SAMPLE\&quot; AND contentTypes:\&quot;Environmental DNA\&quot;)&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records where Record type is &quot;Fossil specimen&quot;"></td>
//                         <td className="filter-value">
//                             <span>-basisOfRecord:"FOSSIL_SPECIMEN"</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records where Record type is &quot;EnvironmentalDNA&quot;"></td>
//                         <td className="filter-value"><span>-(basisOfRecord:"MATERIAL_SAMPLE" AND contentTypes:"Environmental DNA")</span>
//                         </td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude absence records</b><br/>
//                     Exclude absence records
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation=""
//                     data-filters="[&quot;-occurrenceStatus:ABSENT&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records where Presence/Absence is &quot;absent&quot;"></td>
//                         <td className="filter-value">
//                             <span>-occurrenceStatus:ABSENT</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//                 <div>
//                     <b>Exclude records pre 1700</b><br/>
//                     Exclude records with event date pre 1700
//                 </div>
//                 <table
//                     className="table cat-table table-bordered table-condensed table-striped scrollTable"
//                     data-translation=""
//                     data-filters="[&quot;-year:[* TO 1700]&quot;]">
//                     <tbody>
//                     <tr>
//                         <th>Filter description</th>
//                         <th>Filter value</th>
//                         <th>Further information</th>
//                     </tr>
//
//
//                     <tr>
//                         <td className="filter-description"
//                             data-val="Exclude all records where year is prior to 1700"></td>
//                         <td className="filter-value">
//                             <span>-year:[* TO 1700]</span></td>
//                         <td className="filter-wiki"></td>
//                     </tr>
//
//
//                     </tbody>
//                 </table>
//
//
//             </div>
//             <div className="modal-footer">
//                 <a href="https://support.ala.org.au/support/solutions/articles/6000240256-getting-started-with-the-data-quality-filters"
//                    target="_blank" type="button"
//                    className="btn btn-link pull-left">Learn More</a>
//                 <button className="btn btn-default" data-dismiss="modal">Close
//                 </button>
//             </div>
//         </div>
//     </div>
// </div>
