/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { FormattedMessage, useIntl } from 'react-intl';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIconLite } from '@ala/common-ui';
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
import RolloverTooltip from "../rolloverTooltip.tsx";

function AdvancedSearchAvh() {
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

    // Full text search
    const [fullText, setFullText] = useState('');

    // Taxonomy
    const [nameType, setNameType] = useState('taxa');
    const [taxon1, setTaxon1] = useState('');
    const [taxon2, setTaxon2] = useState('');
    const [taxon3, setTaxon3] = useState('');
    const [taxon4, setTaxon4] = useState('');
    const [botanicalGroup, setBotanicalGroup] = useState('');

    // Identification
    const [identifiedBy, setIdentifiedBy] = useState('');
    const [identifiedDateStart, setIdentifiedDateStart] = useState('');
    const [identifiedDateEnd, setIdentifiedDateEnd] = useState('');

    // Record
    const [herbarium, setHerbarium] = useState('');
    const [catalogueNumber, setCatalogueNumber] = useState('');
    const [lastLoadStart, setLastLoadStart] = useState('');
    const [lastLoadEnd, setLastLoadEnd] = useState('');

    // Occurrence
    const [collector, setCollector] = useState('');
    const [recordNumber, setRecordNumber] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [establishmentMeans, setEstablishmentMeans] = useState('');

    // Location
    const [country, setCountry] = useState('');
    const [stateTerritoryProvince, setStateTerritoryProvince] = useState('');
    const [lga, setLga] = useState('');
    const [ibra, setIbra] = useState('');
    const [imcra, setImcra] = useState('');
    const [nzDistrict, setNzDistrict] = useState('');
    const [nzEcoRegion, setNzEcoRegion] = useState('');

    // Herbarium transactions
    const [loanNumber, setLoanNumber] = useState('');
    const [loanDestination, setLoanDestination] = useState('');

    function advancedSearch() {
        let fqParts: string[] = [];

        if (fullText) fqParts.push(`text:${fullText}`);

        // Taxa — 4 fields OR'd together using nameType (taxa or raw_scientificName)
        const taxonFields = [taxon1, taxon2, taxon3, taxon4].filter(Boolean);
        if (taxonFields.length > 0) {
            const taxaParts = taxonFields.map(t => `${nameType}:"${t.replace(/"/g, '\\"')}"`);
            fqParts.push(`(${taxaParts.join(' OR ')})`);
        }

        if (botanicalGroup) fqParts.push(botanicalGroup);

        if (identifiedBy) fqParts.push(`identified_by:(${identifiedBy})`);
        if (identifiedDateStart || identifiedDateEnd) {
            const begin = identifiedDateStart ? identifiedDateStart + 'T00:00:00Z' : '*';
            const end = identifiedDateEnd ? identifiedDateEnd + 'T23:59:59Z' : '*';
            fqParts.push(`dateIdentified:[${begin} TO ${end}]`);
        }

        if (herbarium) fqParts.push(herbarium);
        if (catalogueNumber) fqParts.push(`catalogNumber:(${catalogueNumber})`);
        if (lastLoadStart || lastLoadEnd) {
            const begin = lastLoadStart ? lastLoadStart + 'T00:00:00Z' : '*';
            const end = lastLoadEnd ? lastLoadEnd + 'T23:59:59Z' : '*';
            fqParts.push(`lastModifiedDate:[${begin} TO ${end}]`);
        }

        if (collector) fqParts.push(`collector_text:(${collector})`);
        if (recordNumber) fqParts.push(`recordNumber:(${recordNumber})`);
        if (startDate || endDate) {
            const begin = startDate ? startDate + 'T00:00:00Z' : '*';
            const end = endDate ? endDate + 'T23:59:59Z' : '*';
            fqParts.push(`eventDate:[${begin} TO ${end}]`);
        }
        if (establishmentMeans) fqParts.push(establishmentMeans);

        if (country) fqParts.push(country);
        if (stateTerritoryProvince) fqParts.push(stateTerritoryProvince);
        if (lga) fqParts.push(lga);
        if (ibra) fqParts.push(ibra);
        if (imcra) fqParts.push(imcra);
        if (nzDistrict) fqParts.push(nzDistrict);
        if (nzEcoRegion) fqParts.push(nzEcoRegion);

        if (loanNumber) fqParts.push(`loan_identifier:(${loanNumber})`);
        if (loanDestination) fqParts.push(loanDestination);

        const fq = fqParts.map(part => `fq=${encodeURIComponent(part)}`).join('&');
        navigate(`/occurrences/search?${fq}`);
    }

    function advancedClear() {
        setFullText('');
        setNameType('taxa');
        setTaxon1('');
        setTaxon2('');
        setTaxon3('');
        setTaxon4('');
        setBotanicalGroup('');
        setIdentifiedBy('');
        setIdentifiedDateStart('');
        setIdentifiedDateEnd('');
        setHerbarium('');
        setCatalogueNumber('');
        setLastLoadStart('');
        setLastLoadEnd('');
        setCollector('');
        setRecordNumber('');
        setStartDate('');
        setEndDate('');
        setEstablishmentMeans('');
        setCountry('');
        setStateTerritoryProvince('');
        setLga('');
        setIbra('');
        setImcra('');
        setNzDistrict('');
        setNzEcoRegion('');
        setLoanNumber('');
        setLoanDestination('');
    }

    return (
        <div className="container-fluid avh-search">
            <div className="mb-1 row mt-2">

                {/* ── Full text search ── */}
                <a className="toggleTitle"><FormattedMessage id="advancedsearch.title.fulltext" defaultMessage="Full text search"/></a>

                <div className="mb-3 row align-items-center">
                    <label className="col-md-2 control-label" htmlFor="fulltext">
                        <FormattedMessage id="advancedsearch.fulltext.label" defaultMessage="Text"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="fulltext" className="form-control" value={fullText}
                               onChange={e => setFullText(e.target.value)}/>
                    </div>
                </div>

                <hr/>

                {/* ── Taxonomy ── */}
                <a className="toggleTitle"><FormattedMessage id="advancedsearch.title.taxonomy" defaultMessage="Taxonomy"/></a>

                <div className="mb-2 row">
                    <div className="col-md-8 ms-2 offset-md-2">
                        <div className="form-check">
                            <input type="radio" name="nameType" id="nameType_1" value="taxa"
                                   checked={nameType === 'taxa'} className="form-check-input"
                                   onChange={e => setNameType(e.target.value)}/>
                            <label className="form-check-label" htmlFor="nameType_1">
                                <FormattedMessage id="advancedsearch.nametype.matched" defaultMessage="Matched name"/>&nbsp;
                                <RolloverTooltip text={intl.formatMessage({ id: 'advanced.taxon.tooltip.matched', defaultMessage: 'Results will include known synonyms' })}>
                                    <FontAwesomeIconLite icon={faQuestionCircle}/>
                                </RolloverTooltip>
                            </label>
                        </div>
                        <div className="form-check">
                            <input type="radio" name="nameType" id="nameType_2" value="raw_scientificName"
                                   checked={nameType === 'raw_scientificName'} className="form-check-input"
                                   onChange={e => setNameType(e.target.value)}/>
                            <label className="form-check-label" htmlFor="nameType_2">
                                <FormattedMessage id="advancedsearch.nametype.supplied" defaultMessage="Supplied name"/>&nbsp;
                                <RolloverTooltip text={intl.formatMessage({ id: 'advanced.taxon.tooltip.supplied', defaultMessage: 'Results will not include synonyms' })}>
                                    <FontAwesomeIconLite icon={faQuestionCircle}/>
                                </RolloverTooltip>
                            </label>
                        </div>
                    </div>
                </div>

                {[
                    [taxon1, setTaxon1, 'taxa_1'],
                    [taxon2, setTaxon2, 'taxa_2'],
                    [taxon3, setTaxon3, 'taxa_3'],
                    [taxon4, setTaxon4, 'taxa_4'],
                ].map(([value, setter, id], idx) => (
                    <div className="mb-1 row align-items-center " key={id as string} id={`taxon_row_${idx + 1}`}>
                        <label className="col-md-2 control-label" htmlFor={id as string}>
                            <FormattedMessage id="advancedsearch.taxon.label" defaultMessage="Taxon name"/>
                        </label>
                        <div className="col-md-6 ms-2">
                            <input type="text" id={id as string} className="name_autocomplete form-control"
                                   value={value as string}
                                   onChange={e => (setter as (v: string) => void)(e.target.value)}/>
                        </div>
                    </div>
                ))}

                <div className="mb-3 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="botanical_group">
                        <FormattedMessage id="advancedsearch.botanicalgroup.label" defaultMessage="Botanical group"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="botanical_group"
                                value={botanicalGroup}
                                onFocus={() => fetchFacet('speciesGroup')}
                                onChange={e => setBotanicalGroup(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.botanicalgroup.placeholder" defaultMessage="-- select a botanical group --"/></option>
                            {advancedOptions?.speciesGroup === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.speciesGroup && advancedOptions.speciesGroup.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <hr/>

                {/* ── Identification ── */}
                <a className="toggleTitle"><FormattedMessage id="advancedsearch.title.identification" defaultMessage="Identification"/></a>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="identified_by">
                        <FormattedMessage id="advancedsearch.identifiedby.label" defaultMessage="Identified by"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="identified_by" className="form-control" value={identifiedBy}
                               onChange={e => setIdentifiedBy(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center ">
                    <label className="col-md-2 control-label">
                        <FormattedMessage id="advancedsearch.identificationdate.label" defaultMessage="Identification date"/>
                    </label>
                    <div className="col-md-6 ms-2 d-flex">
                        <input type="date" id="identified_date_start" className="form-control" value={identifiedDateStart}
                               onChange={e => setIdentifiedDateStart(e.target.value)}/>
                        &nbsp;<FormattedMessage id="advancedsearch.date.to" defaultMessage="to"/>&nbsp;
                        <input type="date" id="identified_date_end" className="form-control" value={identifiedDateEnd}
                               onChange={e => setIdentifiedDateEnd(e.target.value)}/>
                    </div>
                </div>

                <hr/>

                {/* ── Record ── */}
                <a className="toggleTitle"><FormattedMessage id="advancedsearch.title.record" defaultMessage="Record"/></a>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="institution_collection">
                        <FormattedMessage id="advancedsearch.herbarium.label" defaultMessage="Herbarium"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="institution_collection"
                                value={herbarium}
                                onFocus={() => fetchFacet('collectionUid')}
                                onChange={e => setHerbarium(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.herbarium.placeholder" defaultMessage="-- select an herbarium --"/></option>
                            {advancedOptions?.collectionUid === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.collectionUid && advancedOptions.collectionUid.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="catalogue_number">
                        <FormattedMessage id="advancedsearch.cataloguenumber.label" defaultMessage="Catalogue number"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="catalogue_number" className="form-control" value={catalogueNumber}
                               onChange={e => setCatalogueNumber(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center ">
                    <label className="col-md-2 control-label">
                        <FormattedMessage id="advancedsearch.recordupdated.label" defaultMessage="Record updated"/>
                    </label>
                    <div className="col-md-6 ms-2 d-flex">
                        <input type="date" id="last_load_start" className="form-control" value={lastLoadStart}
                               onChange={e => setLastLoadStart(e.target.value)}/>
                        &nbsp;<FormattedMessage id="advancedsearch.date.to" defaultMessage="to"/>&nbsp;
                        <input type="date" id="last_load_end" className="form-control" value={lastLoadEnd}
                               onChange={e => setLastLoadEnd(e.target.value)}/>
                    </div>
                </div>

                <hr/>

                {/* ── Occurrence ── */}
                <a className="toggleTitle"><FormattedMessage id="advancedsearch.title.occurrence" defaultMessage="Occurrence"/></a>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="collector">
                        <FormattedMessage id="advancedsearch.collector.label" defaultMessage="Collector"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="collector" className="form-control" value={collector}
                               onChange={e => setCollector(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="record_number">
                        <FormattedMessage id="advancedsearch.collectingnumber.label" defaultMessage="Collecting number"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="record_number" className="form-control" value={recordNumber}
                               onChange={e => setRecordNumber(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label">
                        <FormattedMessage id="advancedsearch.collectingdate.label" defaultMessage="Collecting date"/>
                    </label>
                    <div className="col-md-6 ms-2 d-flex">
                        <input type="date" id="startDate" className="form-control" value={startDate}
                               onChange={e => setStartDate(e.target.value)}/>
                        &nbsp;<FormattedMessage id="advancedsearch.date.to" defaultMessage="to"/>&nbsp;
                        <input type="date" id="endDate" className="form-control" value={endDate}
                               onChange={e => setEndDate(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-3 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="cultivation_status">
                        <FormattedMessage id="advancedsearch.establishmentmeans.label" defaultMessage="Establishment means"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="cultivation_status"
                                value={establishmentMeans}
                                onFocus={() => fetchFacet('cultivationStatus')}
                                onChange={e => setEstablishmentMeans(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.establishmentmeans.placeholder" defaultMessage="-- select an establishment means --"/></option>
                            {advancedOptions?.cultivationStatus === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cultivationStatus && advancedOptions.cultivationStatus.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <hr/>

                {/* ── Location ── */}
                <a className="toggleTitle"><FormattedMessage id="advancedsearch.title.location" defaultMessage="Location"/></a>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="country">
                        <FormattedMessage id="advancedsearch.country.label" defaultMessage="Country"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="country"
                                value={country}
                                onFocus={() => fetchFacet('country')}
                                onChange={e => setCountry(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.country.placeholder" defaultMessage="-- select a country --"/></option>
                            {advancedOptions?.country === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.country && advancedOptions.country.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="state_territory_province">
                        <FormattedMessage id="advancedsearch.state.label" defaultMessage="State, territory or province"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="state_territory_province"
                                value={stateTerritoryProvince}
                                onFocus={() => fetchFacet('stateProvince')}
                                onChange={e => setStateTerritoryProvince(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.state.placeholder" defaultMessage="-- select a state, territory or province --"/></option>
                            {advancedOptions?.stateProvince === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.stateProvince && advancedOptions.stateProvince.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="lga">
                        <FormattedMessage id="advancedsearch.lga.label" defaultMessage="Local government area"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="lga"
                                value={lga}
                                onFocus={() => fetchFacet('cl959')}
                                onChange={e => setLga(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.lga.placeholder" defaultMessage="-- select local government area --"/></option>
                            {advancedOptions?.cl959 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl959 && advancedOptions.cl959.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="ibra">
                        <abbr title="Interim Biogeographic Regionalisation of Australia">IBRA</abbr>{' '}
                        <FormattedMessage id="advancedsearch.ibra.label" defaultMessage="region"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="ibra"
                                value={ibra}
                                onFocus={() => fetchFacet('cl1048')}
                                onChange={e => setIbra(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.ibra.placeholder" defaultMessage="-- select an IBRA region --"/></option>
                            {advancedOptions?.cl1048 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl1048 && advancedOptions.cl1048.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="imcra">
                        <abbr title="Integrated Marine and Coastal Regionalisation of Australia (meso-scale)">IMCRA</abbr>{' '}
                        <FormattedMessage id="advancedsearch.imcra.label" defaultMessage="region"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="imcra"
                                value={imcra}
                                onFocus={() => fetchFacet('cl21')}
                                onChange={e => setImcra(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.imcra.placeholder" defaultMessage="-- select an IMCRA region --"/></option>
                            {advancedOptions?.cl21 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl21 && advancedOptions.cl21.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="nz_districts">
                        <FormattedMessage id="advancedsearch.nzdistrict.label" defaultMessage="NZ Land District"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="nz_districts"
                                value={nzDistrict}
                                onFocus={() => fetchFacet('cl2116')}
                                onChange={e => setNzDistrict(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.nzdistrict.placeholder" defaultMessage="-- select a NZ Land District --"/></option>
                            {advancedOptions?.cl2116 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl2116 && advancedOptions.cl2116.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <div className="mb-3 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="nz_eco_regions">
                        <FormattedMessage id="advancedsearch.nzecoregion.label" defaultMessage="NZ ECO Region"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="nz_eco_regions"
                                value={nzEcoRegion}
                                onFocus={() => fetchFacet('cl2115')}
                                onChange={e => setNzEcoRegion(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.nzecoregion.placeholder" defaultMessage="-- select a NZ ECO region --"/></option>
                            {advancedOptions?.cl2115 === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.cl2115 && advancedOptions.cl2115.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <hr/>

                {/* ── Herbarium transactions ── */}
                <a className="toggleTitle"><FormattedMessage id="advancedsearch.title.herbariumtransactions" defaultMessage="Herbarium transactions"/></a>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="loan_identifier">
                        <FormattedMessage id="advancedsearch.loannumber.label" defaultMessage="Loan number"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <input type="text" id="loan_identifier" className="form-control" value={loanNumber}
                               onChange={e => setLoanNumber(e.target.value)}/>
                    </div>
                </div>

                <div className="mb-1 row align-items-center ">
                    <label className="col-md-2 control-label" htmlFor="loan_destination">
                        <FormattedMessage id="advancedsearch.borrowinginstitution.label" defaultMessage="Borrowing institution"/>
                    </label>
                    <div className="col-md-6 ms-2">
                        <select className="form-select form-control" id="loan_destination"
                                value={loanDestination}
                                onFocus={() => fetchFacet('loanDestinationInstitutionUid')}
                                onChange={e => setLoanDestination(e.target.value)}>
                            <option value=""><FormattedMessage id="advancedsearch.borrowinginstitution.placeholder" defaultMessage="-- select a borrowing institution --"/></option>
                            {advancedOptions?.loanDestinationInstitutionUid === null && <option disabled><FormattedMessage id="advancedsearch.loading" defaultMessage="Loading..."/></option>}
                            {advancedOptions?.loanDestinationInstitutionUid && advancedOptions.loanDestinationInstitutionUid.map((item, idx) =>
                                <option key={idx} value={item.fq}>{item.name}</option>
                            )}
                        </select>
                    </div>
                </div>

                <hr/>

                {/* ── Buttons ── */}
                <div className="mb-1 row align-items-start">
                    <div className="col-md-2">
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

export default AdvancedSearchAvh;

