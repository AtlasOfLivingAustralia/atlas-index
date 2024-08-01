import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
// import {Tab, Tabs} from "react-bootstrap";
import MapView from "../components/species/mapView.tsx";
import ClassificationView from "../components/species/classificationView.tsx";
import DescriptionView from "../components/species/descriptionView.tsx";
import ImagesView from "../components/species/imagesView.tsx";
import NamesView from "../components/species/namesView.tsx";
import StatusView from "../components/species/statusView.tsx";
import TraitsView from "../components/species/traitsView.tsx";
import DatasetsView from "../components/species/datasetsView.tsx";
import ResourcesView from "../components/species/resourcesView.tsx";

function Species({setBreadcrumbs, queryString}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void,
    queryString?: string
}) {
    const [tab, setTab] = useState('map');

    const [result, setResult] = useState({});
    const [resultV1, setResultV1] = useState({});

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Species', href: '/species'},
        ]);
    }, []);

    useEffect(() => {
        let request = [queryString?.split("=")[1]]
        fetch(import.meta.env.VITE_APP_BIE_URL + "/v2/species", {
            method: 'POST',
            body: JSON.stringify(request),
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => setResult(data[0]))

        fetch(import.meta.env.VITE_APP_BIE_URL + "/v1/species/" + request, {
            headers: {
                'Content-Type': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                setResultV1(data)
            })

    }, [queryString]);

    return (
        <>
            {result &&
                <>
                    <div className="speciesPageBackground">
                    <div className="container-fluid speciesPageBackground speciesPage">
                        <div className="row justify-content-center">
                            <div id="speciesListHeader" className="d-flex ps-0">
                                <div className="speciesHeaderText">
                                    <div className="speciesName">{result.name}</div>
                                    <div className="speciesTypeTag">{result.rank}</div>
                                    {result.commonName && result.commonName.map((name, idx) =>
                                        idx < 3 && <div key={idx} className="speciesVernacular">{name}</div>
                                    )}
                                    <div className="speciesLink" onClick={() => setTab('names')}>See names</div>
                                    <div className="speciesTextSummary">{result.nameComplete}</div>

                                    <div className="speciesInvasive d-flex">
                                        <div className="bi bi-flag-fill speciesInvasiveFlag"></div>
                                        <div>This species is <span className="speciesInvasiveLink"
                                                                   onClick={() => setTab('status')}>considered invasive</span> in
                                            some part of Australia and may be of biosecurity concern.
                                        </div>
                                    </div>
                                </div>
                                <div className="speciesImageBlock">
                                    {result.image && result.image.split(',').map((id, idx) =>
                                            idx == 0 && <div className="speciesImg">
                                                <img
                                                    src={"https://images-test.ala.org.au/image/proxyImageThumbnail?imageId=" + id}></img>
                                            </div>
                                    )}
                                </div>
                                <div className="speciesImageBlockTall">
                                    {result.image && result.image.split(',').map((id, idx) =>
                                            idx == 0 && <div className="speciesImgTall">
                                                <img
                                                    src={"https://images-test.ala.org.au/image/proxyImageThumbnail?imageId=" + id}></img>
                                            </div>
                                    )}
                                    {result.image && result.image.split(',').map((id, idx) =>
                                            idx == 0 && <div className="speciesImgTall">
                                                <img
                                                    src={"https://images-test.ala.org.au/image/proxyImageThumbnail?imageId=" + id}></img>
                                            </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    </div>
                    <div className="container-fluid speciesPage">
                        <div className="row justify-content-center">
                            <Tabs
                                id="result-tabs"
                                activeKey={tab}
                                onSelect={(k) => setTab(k || '')}
                                transition={false}
                            >
                                <Tab eventKey="map" title="Occurrence map">
                                    <MapView result={result} tab={tab}/>
                                </Tab>
                                <Tab eventKey="classification" title="Classification">
                                    <ClassificationView result={result}/>
                                </Tab>
                                <Tab eventKey="description" title="Description">
                                    <DescriptionView result={result}/>
                                </Tab>
                                <Tab eventKey="media" title="Images and sounds">
                                    <ImagesView result={result}/>
                                </Tab>
                                <Tab eventKey="names" title="Names">
                                    <NamesView result={result} resultV1={resultV1}/>
                                </Tab>
                                <Tab eventKey="status" title="Status">
                                    <StatusView result={result} resultV1={resultV1}/>
                                </Tab>
                                <Tab eventKey="traits" title="Traits">
                                    <TraitsView result={result} resultV1={resultV1}/>
                                </Tab>
                                <Tab eventKey="datasets" title="Datasets">
                                    <DatasetsView result={result} resultV1={resultV1}/>
                                </Tab>
                                <Tab eventKey="resources" title="Resources">
                                    <ResourcesView result={result} resultV1={resultV1}/>
                                </Tab>
                            </Tabs>
                        </div>
                    </div>

                    <div className="speciesFooter speciesPage">
                        <div className="speciesFooterLine"></div>
                        <div className="bi bi-arrow-up-circle-fill float-end speciesFooterUp"
                            onClick={() => window.scrollTo(0, 0)}></div>
                    </div>
                </>
            }
        </>
    );
}

export default Species;
