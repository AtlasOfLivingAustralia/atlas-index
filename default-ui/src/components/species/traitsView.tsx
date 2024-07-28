import {useEffect, useState} from "react";

interface MapViewProps {
    result?: {},
    resultV1?: {}
}

function TraitsView({result, resultV1}: MapViewProps) {

    const [traitsText, setTraitsText] = useState('');
    const [hasMoreValues, setHasMoreValues] = useState(false);
    const [traits, setTraits] = useState({});

    // const traitsCount = [
    //     {
    //         "summary": 16,
    //         "AusTraits": 15,
    //         "taxon": "Podocarpus drouynianus",
    //         "explanation": "There are 16 traits available for Podocarpus drouynianus, with data for 15 further traits in the AusTraits database. These are accessible via the download CSV button or alternatively the entire database can be accessed at doi.org/10.5281/zenodo.10156222"
    //     }
    // ];
    // const traits = {
    //     "numeric_traits": [
    //         {
    //             "unit": "m",
    //             "min": "0.75",
    //             "max": "3",
    //             "mean": "1.88",
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0010023",
    //             "trait_name": "Plant vegetative height"
    //         },
    //         {
    //             "unit": "mm",
    //             "min": "30",
    //             "max": "120",
    //             "mean": "75",
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011213",
    //             "trait_name": "Leaf length"
    //         },
    //         {
    //             "unit": "mm",
    //             "min": "2",
    //             "max": "6",
    //             "mean": "4",
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011214",
    //             "trait_name": "Leaf width"
    //         }
    //     ],
    //     "categorical_traits": [
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030010",
    //             "trait_values": "shrub, tree  *",
    //             "trait_name": "Plant growth form"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030012",
    //             "trait_values": "perennial",
    //             "trait_name": "Life history"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011316",
    //             "trait_values": "simple",
    //             "trait_name": "Leaf compoundness"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030211",
    //             "trait_values": "zoochory",
    //             "trait_name": "Diaspore dispersal syndrome"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030513",
    //             "trait_values": "basal buds",
    //             "trait_name": "Bud bank location"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030652",
    //             "trait_values": "post fire recruitment absent",
    //             "trait_name": "Post-fire recruitment"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030028",
    //             "trait_values": "arbuscular mycorrhizal",
    //             "trait_name": "Plant root structures"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030060",
    //             "trait_values": "dioecious",
    //             "trait_name": "Plant sex type"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0012516",
    //             "trait_values": "strobilus",
    //             "trait_name": "Fruit type"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0012618",
    //             "trait_values": "ovoid",
    //             "trait_name": "Seed shape"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0030024",
    //             "trait_values": "evergreen",
    //             "trait_name": "Leaf phenology"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0012623",
    //             "trait_values": "receptacle",
    //             "trait_name": "Dispersal appendage"
    //         },
    //         {
    //             "taxon_name": "Podocarpus drouynianus",
    //             "definition": "https://w3id.org/APD/traits/trait_0011311",
    //             "trait_values": "linear",
    //             "trait_name": "Leaf shape"
    //         }
    //     ]
    // }

    useEffect(() => {
        if (!result?.guid) {
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + "/trait-count" + getAusTraitsParam(), {
        headers: {
            'Content-Type': 'application/json'}
        })
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    // var text = traitsCount[0].explanation
                    var text = data[0].explanation
                    text = text.replace('AusTraits', '<a className="link" target="_blank" href="' + import.meta.env.VITE_AUSTRAITS_HOME + '">AusTraits</a>')
                    text = text.replace(data[0].taxon, '<i>' + data[0].taxon + '</i>')

                    // replace doi.org[^ ]* with <a className="link">doi.org[^ ]*</a>
                    text = text.replace(/(doi.org[^ ]*)/g, '<a className="link" target="_blank" href="https://$1">$1</a>')

                    setTraitsText(text);
                }
            })

        fetch(import.meta.env.VITE_APP_BIE_URL + "/trait-summary" + getAusTraitsParam(), {
            headers: {
                'Content-Type': 'application/json'}
        })
            .then(response => response.json())
            .then(data => {
                var hasMore = false;
                if (data?.categorical_traits) {
                    data.categorical_traits.forEach(item => {
                        if (item.trait_values.endsWith("*")) {
                            hasMore = true;
                        }
                    })
                    setHasMoreValues(hasMore)
                    setTraits(data)
                }
            })
    }, [result]);

    function getAusTraitsParam() {
        if (result?.name) {
            return "?taxon=" + encodeURIComponent(result.name) + (result.guid.includes("apni") ? "&APNI_ID=" + encodeURIComponent(result.guid.split('/')[result.guid.split('/').length - 1]) : "")
        } else {
            return "";
        }
    }

    return <>
        <div className="traitsView">
            <div className="d-flex">
                <img src={import.meta.env.VITE_APP_AUSTRAITS_LOGO} className="traitsLogo" alt="Austraits logo"/>

                <div className="ms-auto traitsInfo">
                    <div className="traitsInfoText">
                        {traitsText && <div dangerouslySetInnerHTML={{__html: traitsText}}></div>}
                    </div>

                    <div className="traitsButtons d-flex">
                        <a className="btn traitsButtonDefinitions ms-auto" target="_blank" href={import.meta.env.VITE_AUSTRAITS_DEFINITIONS}>AusTraits definitions</a>
                        <a className="btn traitsButtonCsv" target="_blank" href={import.meta.env.VITE_APP_BIE_URL + "/download-taxon-data" + getAusTraitsParam()}>Download CSV</a>
                    </div>
                </div>
            </div>

            <div className="d-flex traitsDataBlock">
                <div className="traitsInfoBox">
                    <div className="classificationAbout">
                        <span className="bi bi-info-circle-fill"></span>
                        About traits
                    </div>
                    <div className="classificationInfoText">
                        <p>
                        The trait data shown here are a selection from <a className="link" target="_blank" href={import.meta.env.VITE_AUSTRAITS_HOME}>AusTraits</a>, an
                        open-source,
                        harmonised database of Australian plant trait data, sourced from individual researchers,
                        government entities (e.g. herbaria) or NGOs across Australia.
                        </p>
                        <p>
                        Traits vary in scope from morphological attributes (e.g. leaf area, seed mass, plant height) to
                        ecological attributes (e.g. fire response, flowering time, pollinators) and physiological
                        measures of performance (e.g. photosynthetic gas exchange, water-use efficiency.)&nbsp;
                        <a className="link" target="_blank">Find out more</a>
                        </p>
                        <p>
                        Source: <a className="link" target="_blank" href={import.meta.env.VITE_AUSTRAITS_DOI}>Zenodo</a>
                        <br/>
                        Rights holder: <a className="link" target="_blank" href={import.meta.env.VITE_AUSTRAITS_HOME}>AusTraits</a>
                        <br/>
                        Provided by: <a className="link" target="_blank" href={import.meta.env.VITE_AUSTRAITS_HOME}>AusTraits</a>
                        </p>
                        <div className="traitsCite">
                            <div className="traitsCiteTitle">How to cite AusTraits data</div>
                            <div className="traitsCiteText">
                            <p>
                                Falster, Gallagher et al (2021) AusTraits, a curated plant trait database for the Australian
                                flora. Scientific Data 8: 254,&nbsp;
                                <a className="link" target="_blank" href="https://doi.org/10.1038/s41597-021-01006-6">https://doi.org/10.1038/s41597-021-01006-6</a>
                                &nbsp;- followed by the ALA url and access date For more information about citing information on the
                                ALA, see - <a className="link" target="_blank" href={import.meta.env.VITE_CITE_URL}>Citing the ALA</a>.
                            </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="ms-auto traitsData">
                    {traits?.categorical_traits?.length > 0  && <>
                        <div className="namesSectionHeader">Categorical Traits</div>
                        {hasMoreValues &&
                            <div className="traitsCategoricalInfo">* Data sources in AusTraits report multiple values for
                                this
                                trait, suggesting variation across the taxon's range and life stages. Please download the
                                raw
                                data with information about the context of data collection to assess whether they are
                                relevant
                                to your project.</div>
                        }
                        <div className="namesRowHeader d-flex">
                            <div className="speciesTableHeaderItem traitsConservationName">Trait Name</div>
                            <div className="speciesTableHeaderItem traitsConservationValue">Trait Value</div>
                            <div className="speciesTableHeaderItem traitsConservationLink">Definition</div>
                        </div>
                        {traits?.categorical_traits.map((item, idx) =>
                            <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                                <div className="speciesTableItem traitsConservationName">{item.trait_name}</div>
                                <div className="speciesTableItem traitsConservationValue">{item.trait_values}</div>
                                <div className="speciesTableItem traitsConservationLink"><a target="_blank"
                                                                                            href={item.definition}>
                                    <div className="bi bi-box-arrow-up-right"></div>
                                </a>
                                </div>
                            </div>
                        )}
                        </>
                    }

                    {traits?.categorical_traits?.length > 0 && traits?.numeric_traits?.length > 0 && <div className="namesSectionFoot"></div>}

                    {traits?.numeric_traits?.length > 0 && <>
                        <div className="namesSectionHeader">Numeric Traits</div>
                        <div className="namesRowHeader d-flex">
                            <div className="speciesTableHeaderItem traitNumericName">Trait Name</div>
                            <div className="speciesTableHeaderItem traitNumericMin">Min</div>
                            <div className="speciesTableHeaderItem traitNumericMean">Mean</div>
                            <div className="speciesTableHeaderItem traitNumericMax">Max</div>
                            <div className="speciesTableHeaderItem traitNumericUnit">Unit</div>
                            <div className="speciesTableHeaderItem traitNumericUrl">Definition</div>
                        </div>
                        {traits?.numeric_traits && traits?.numeric_traits.map((item, idx) =>
                            <div className={"namesRow d-flex " + (idx % 2 == 1 && "namesRowOdd")} key={idx}>
                                <div className="speciesTableItem traitNumericName">{item.trait_name}</div>
                                <div className="speciesTableItem traitNumericMin">{item.min}</div>
                                <div className="speciesTableItem traitNumericMean">{item.mean}</div>
                                <div className="speciesTableItem traitNumericMax">{item.max}</div>
                                <div className="speciesTableItem traitNumericUnit">{item.unit}</div>
                                <div className="speciesTableItem traitNumericUrl"><a target="_blank" href={item.definition}><div className="bi bi-box-arrow-up-right"></div></a></div>
                            </div>
                        )}
                    </>
                    }
                </div>
            </div>

        </div>
    </>
}

export default TraitsView;
