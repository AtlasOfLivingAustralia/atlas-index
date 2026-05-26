/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FormattedMessage, useIntl } from 'react-intl';
import { Menu, MenuItem, Typeahead } from 'react-bootstrap-typeahead';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

function AdvancedSearch() {
    const intl = useIntl();
    const navigate = useNavigate();

    // Per-facet cache: undefined = not yet fetched, null = loading, Fq[] = loaded
    const [advancedOptions, setAdvancedOptions] = useState<Record<string, { name: string; fq: string }[] | null | undefined>>({});

    const fetchFacet = useCallback((facet: string) => {
        setAdvancedOptions(prev => {
            if (prev[facet] !== undefined) return prev;
            return { ...prev, [facet]: null };
        });
        const qc = (import.meta.env.VITE_QUERY_CONTEXT || '') ? `&qc=${import.meta.env.VITE_QUERY_CONTEXT}` : '';
        const url = `${import.meta.env.VITE_APP_BIOCACHE_URL}/occurrences/search?q=*:*&pageSize=0&facets=${facet}&flimit=-1${qc}`;
        fetch(url)
            .then(res => res.json())
            .then(data => {
                const facetResult = data?.facetResults?.find((fr: any) => fr.fieldName === facet);
                const values = facetResult
                    ? facetResult.fieldResult.map((fr: any) => ({ name: fr.label, fq: fr.fq }))
                    : [];
                setAdvancedOptions(prev => ({ ...prev, [facet]: values }));
            });
    }, []);

    const [advancedText, setAdvancedText] = useState('');
    const [advancedTaxa1, setAdvancedTaxa1] = useState('');
    const [advancedTaxa2, setAdvancedTaxa2] = useState('');
    const [advancedTaxa3, setAdvancedTaxa3] = useState('');
    const [advancedTaxa4, setAdvancedTaxa4] = useState('');
    const [advancedRawTaxon, setAdvancedRawTaxon] = useState('');
    const [advancedSpeciesGroup, setAdvancedSpeciesGroup] = useState('');
    const [advancedInstitution, setAdvancedInstitution] = useState('');
    const [advancedCountry, setAdvancedCountry] = useState('');
    const [advancedState, setAdvancedState] = useState('');
    const [advancedIbra, setAdvancedIbra] = useState('');
    const [advancedImcra, setAdvancedImcra] = useState('');
    const [advancedLga, setAdvancedLga] = useState('');
    const [advancedTypeStatus, setAdvancedTypeStatus] = useState('');
    const [advancedBasisOfRecord, setAdvancedBasisOfRecord] = useState('');
    const [advancedDataResource, setAdvancedDataResource] = useState<any[]>([]);
    const [advancedCollector, setAdvancedCollector] = useState('');
    const [advancedCatalogue, setAdvancedCatalogue] = useState('');
    const [advancedRecord, setAdvancedRecord] = useState('');
    const [advancedBeginDate, setAdvancedBeginDate] = useState('');
    const [advancedEndDate, setAdvancedEndDate] = useState('');

    function advancedSearch() {
        let fqParts: string[] = [];
        if (advancedText) fqParts.push(`text:${advancedText}`);

        let taxaParts = [];
        if (advancedTaxa1) taxaParts.push(`taxa:"${advancedTaxa1.replace(/"/g, '\\"')}"`);
        if (advancedTaxa2) taxaParts.push(`taxa:${advancedTaxa2.replace(/"/g, '\\"')}"`);
        if (advancedTaxa3) taxaParts.push(`taxa:${advancedTaxa3.replace(/"/g, '\\"')}"`);
        if (advancedTaxa4) taxaParts.push(`taxa:${advancedTaxa4.replace(/"/g, '\\"')}"`);
        if (taxaParts.length > 0) {
            fqParts.push(`(${taxaParts.join(' OR ')})`);
        }

        if (advancedRawTaxon) fqParts.push(`raw_scientificName:${advancedRawTaxon}`);
        if (advancedSpeciesGroup) fqParts.push(advancedSpeciesGroup);
        if (advancedInstitution) fqParts.push(advancedInstitution);
        if (advancedCountry) fqParts.push(advancedCountry);
        if (advancedState) fqParts.push(advancedState);
        if (advancedIbra) fqParts.push(advancedIbra);
        if (advancedImcra) fqParts.push(advancedImcra);
        if (advancedLga) fqParts.push(advancedLga);
        if (advancedTypeStatus) fqParts.push(advancedTypeStatus);
        if (advancedBasisOfRecord) fqParts.push(advancedBasisOfRecord);
        if (advancedDataResource.length > 0) {
            fqParts.push(advancedDataResource[0].fq);
        }
        if (advancedCollector) fqParts.push(`collector_text:(${advancedCollector})`);
        if (advancedCatalogue) fqParts.push(`catalogNumber:(${advancedCatalogue})`);
        if (advancedRecord) fqParts.push(`recordNumber:(${advancedRecord})`);
        if (advancedBeginDate || advancedEndDate) {
            const begin = advancedBeginDate ? advancedBeginDate + 'T00:00:00Z' : '*';
            const end = advancedEndDate ? advancedEndDate + 'T23:59:59Z' : '*';
            fqParts.push(`eventDate:[${begin} TO ${end}]`);
        }
        const fq = fqParts.map(part => `fq=${encodeURIComponent(part)}`).join('&');
        navigate(`/occurrences/search?${fq}`);
    }

    function advancedClear() {
        setAdvancedText('');
        setAdvancedTaxa1('');
        setAdvancedTaxa2('');
        setAdvancedTaxa3('');
        setAdvancedTaxa4('');
        setAdvancedRawTaxon('');
        setAdvancedSpeciesGroup('');
        setAdvancedInstitution('');
        setAdvancedCountry('');
        setAdvancedState('');
        setAdvancedIbra('');
        setAdvancedImcra('');
        setAdvancedLga('');
        setAdvancedTypeStatus('');
        setAdvancedBasisOfRecord('');
        setAdvancedDataResource([]);
        setAdvancedCollector('');
        setAdvancedCatalogue('');
        setAdvancedRecord('');
        setAdvancedBeginDate('');
        setAdvancedEndDate('');
    }

    return (
        <div className="container-fluid">
            <div className="mb-3 row mt-2">
                <h4><FormattedMessage id="advancedsearch.title01" defaultMessage="Find records that have"/></h4>
                <div className="mb-3 row align-items-center text-end align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="text">
                        <FormattedMessage id="advancedsearch.table01col01.title" defaultMessage="ALL of these words (full text)"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <input type="text" className="dataset form-control" value={advancedText}
                               onChange={e => setAdvancedText(e.target.value)}/>
                    </div>
                </div>

                <h4><FormattedMessage id="advancedsearch.title02" defaultMessage="Find records for ANY of the following taxa (matched/processed taxon concepts)"/></h4>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="taxa_1"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="taxa_1" className="name_autocomplete form-control" value={advancedTaxa1}
                               onChange={e => setAdvancedTaxa1(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="taxa_2"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="taxa_2" className="name_autocomplete form-control"
                               value={advancedTaxa2}
                               onChange={e => setAdvancedTaxa2(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end" id="taxon_row_3">
                    <label className="col-md-2 control-label" htmlFor="taxa_3"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="taxa_3" className="name_autocomplete form-control"
                               value={advancedTaxa3}
                               onChange={e => setAdvancedTaxa3(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end" id="taxon_row_4">
                    <label className="col-md-2 control-label" htmlFor="taxa_4"><FormattedMessage id="advancedsearch.table02col01.title" defaultMessage="Species/Taxon"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="taxa_4" className="name_autocomplete form-control"
                               value={advancedTaxa4}
                               onChange={e => setAdvancedTaxa4(e.target.value)}/>
                    </div>
                </div>

                <h4 className="margin-bottom-half-1"><FormattedMessage id="advancedsearch.allfields.title" defaultMessage="Find records that specify the following fields"/></h4>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="raw_taxon_name"><FormattedMessage id="advancedsearch.table03col01.title" defaultMessage="Raw Scientific Name"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="raw_taxon_name" className="dataset form-control" value={advancedRawTaxon}
                               onChange={e => setAdvancedRawTaxon(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="species_group"><FormattedMessage id="advancedsearch.table04col01.title" defaultMessage="Species Group"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="species_group"
                                value={advancedSpeciesGroup}
                                onFocus={() => fetchFacet('speciesGroup')}
                                onChange={e => setAdvancedSpeciesGroup(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table04col01.option.label" defaultMessage="-- select a species group --"/></option>
                            {advancedOptions?.speciesGroup === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.speciesGroup && advancedOptions.speciesGroup.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="institution_collection">
                        <FormattedMessage id="advancedsearch.table05col01.title" defaultMessage="Institution or Collection"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="institution_collection"
                                value={advancedInstitution}
                                onFocus={() => { fetchFacet('institutionUid'); fetchFacet('collectionUid'); }}
                                onChange={e => setAdvancedInstitution(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table05col01.option01.label" defaultMessage="-- select an institution or collection --"/></option>
                            {advancedOptions?.institutionUid === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.institutionUid && advancedOptions.institutionUid.map((institution: any, idx: number) =>
                                <optgroup key={idx} label={institution.name}>
                                    <option value={institution.fq}><FormattedMessage id="advancedsearch.table05col01.option02.label" defaultMessage="All records from"/> {institution.name}</option>
                                    {advancedOptions?.collectionUid && advancedOptions?.collectionUid.filter(c => c.name.startsWith(institution.name)).map((collection: any, idx: number) =>
                                        <option key={idx} value={collection.fq}>{collection.name.substring(institution.name.length) ||
                                            (" " + intl.formatMessage({id:"advancedsearch.table05col01.option03.label", defaultMessage:"Collection"}))}</option>
                                    )}
                                </optgroup>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="country"><FormattedMessage id="advancedsearch.table06col01.title" defaultMessage="Country"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="country" value={advancedCountry}
                                onFocus={() => fetchFacet('country')}
                                onChange={e => setAdvancedCountry(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table06col01.option.label" defaultMessage="-- select a country --"/></option>
                            {advancedOptions?.country === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.country && advancedOptions.country.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="state"><FormattedMessage id="advancedsearch.table06col02.title" defaultMessage="State/Territory"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="state"
                                value={advancedState}
                                onFocus={() => fetchFacet('state')}
                                onChange={e => setAdvancedState(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table06col02.option.label" defaultMessage="-- select a state/territory --"/></option>
                            {advancedOptions?.state === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.state && advancedOptions.state.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="ibra"><abbr
                        title="Interim Biogeographic Regionalisation of Australia">IBRA</abbr> <FormattedMessage id="advancedsearch.table06col03.title" defaultMessage="region"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="ibra" value={advancedIbra}
                                onFocus={() => fetchFacet('cl1048')}
                                onChange={e => setAdvancedIbra(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table06col03.option.label" defaultMessage="-- select an IBRA region --"/></option>
                            {advancedOptions?.cl1048 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl1048 && advancedOptions.cl1048.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="imcra"><abbr
                        title="Integrated Marine and Coastal Regionalisation of Australia">IMCRA</abbr> <FormattedMessage id="advancedsearch.table06col04.title" defaultMessage="region"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="imcra" value={advancedImcra}
                                onFocus={() => fetchFacet('cl21')}
                                onChange={e => setAdvancedImcra(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table06col04.option.label" defaultMessage="-- select an IMCRA region --"/></option>
                            {advancedOptions?.cl21 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl21 && advancedOptions.cl21.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="lga"><FormattedMessage id="advancedsearch.table06col05.title" defaultMessage="Local Govt. Area"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="lga" value={advancedLga}
                                onFocus={() => fetchFacet('cl959')}
                                onChange={e => setAdvancedLga(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table06col05.option.label" defaultMessage="-- select local government area--"/></option>
                            {advancedOptions?.cl959 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl959 && advancedOptions.cl959.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="type_status"><FormattedMessage id="advancedsearch.table07col01.title" defaultMessage="Type Status"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="type_status"
                                value={advancedTypeStatus}
                                onFocus={() => fetchFacet('typeStatus')}
                                onChange={e => setAdvancedTypeStatus(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table07col01.option.label" defaultMessage="-- select a type status --"/></option>
                            {advancedOptions?.typeStatus === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.typeStatus && advancedOptions.typeStatus.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="basis_of_record"><FormattedMessage id="advancedsearch.table08col01.title" defaultMessage="Basis of record"/></label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="basis_of_record" value={advancedBasisOfRecord}
                                onFocus={() => fetchFacet('basisOfRecord')}
                                onChange={e => setAdvancedBasisOfRecord(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.table08col01.option.label" defaultMessage="-- select a basis of record --"/></option>
                            {advancedOptions?.basisOfRecord === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.basisOfRecord && advancedOptions.basisOfRecord.map((item: any, idx: number) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="collector_text"><FormattedMessage id="advancedsearch.collector_text.title" defaultMessage="Collector"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="collector_text" className="dataset form-control"
                               value={advancedCollector}
                               onChange={e => setAdvancedCollector(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="control-label col-md-2"><FormattedMessage id="advancedsearch.dataset.col.label" defaultMessage="dataset name"/></label>
                    <div className="col-md-6 ms-2">
                        <Typeahead
                            id="dataResource-autocomplete"
                            labelKey="name"
                            options={advancedOptions?.dataResourceUid ?? []}
                            isLoading={advancedOptions?.dataResourceUid === null}
                            selected={advancedDataResource}
                            onFocus={() => fetchFacet('dataResourceUid')}
                            onChange={(selected) => {
                                setAdvancedDataResource(selected)
                            }}
                            renderMenu={(results, menuProps) => (
                                <Menu {...menuProps}>
                                    {results.map((result, index) => (
                                        <MenuItem
                                            key={index}
                                            option={result}
                                            position={index}
                                            href={"javascript:"}>
                                            {typeof result === 'string' ? result : result.name}
                                        </MenuItem>
                                    ))}
                                </Menu>
                            )}
                        />
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="catalogue_number"><FormattedMessage id="advancedsearch.table09col01.title" defaultMessage="Catalogue Number"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="catalogue_number" className="form-control" value={advancedCatalogue}
                               onChange={e => setAdvancedCatalogue(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="record_number"><FormattedMessage id="advancedsearch.table09col02.title" defaultMessage="Record Number"/></label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="record_number" className="form-control" value={advancedRecord}
                               onChange={e => setAdvancedRecord(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="startDate"><FormattedMessage id="advancedsearch.table10col01.title" defaultMessage="Begin Date"/></label>
                    <div className="col-md-2 ms-2">
                        <input type="date" id="startDate" className="form-control" value={advancedBeginDate}
                               onChange={e => setAdvancedBeginDate(e.target.value)}/>
                    </div>
                    <div className="col-md-6 text-start">
                        <span className="small ms-2"><FormattedMessage id="advancedsearch.table10col01.des" defaultMessage="(YYYY-MM-DD) leave blank for earliest record date"/></span>
                    </div>
                </div>

                <div className="mb-3 row align-items-center text-end">
                    <label className="col-md-2 control-label" htmlFor="endDate"><FormattedMessage id="advancedsearch.table10col02.title" defaultMessage="End Date"/></label>
                    <div className="col-md-2 ms-2">
                        <input type="date" id="endDate" className="occurrence_date form-control"
                               value={advancedEndDate}
                               onChange={e => setAdvancedEndDate(e.target.value)}/>
                    </div>
                    <div className="col-md-6 text-start">
                        <span className="small ms-2"><FormattedMessage id="advancedsearch.table10col02.des" defaultMessage="(YYYY-MM-DD) leave blank for most recent record date"/></span>
                    </div>
                </div>

                <div className="mb-3 row align-items-center">
                    <div className="col-md-2 ms-3">
                        <button className="btn btn-primary" onClick={() => advancedSearch()}>
                            <FormattedMessage id="advancedsearch.button.submit" defaultMessage="Search"/>
                        </button>
                        <button id="clearAll" className="btn btn-outline-dark ms-2" onClick={() => advancedClear()}>
                            <FormattedMessage id="advancedsearch.button.clear.all" defaultMessage="Clear all"/>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default AdvancedSearch;

