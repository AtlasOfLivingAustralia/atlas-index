/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Tab, Tabs} from "react-bootstrap";
import {useState} from "react";
import {useAuth} from "react-oidc-context";

import {DescriptionItem} from "../../api/sources/model.tsx";

function EditIndexedTaxon() {
    const [guid, setGuid] = useState('');
    const [guidSearched, setGuidSearched] = useState('');
    const [taxonString, setTaxonString] = useState('');
    const [speciesTab, setSpeciesTab] = useState('json');
    const [taxonID, setTaxonID] = useState('');
    const [kingdomName, setKingdomName] = useState('');
    const [familyName, setFamilyName] = useState('');
    const [scientificName, setScientificName] = useState('');
    const [heroDescription, setHeroDescription] = useState('');
    const [saveHeroDescriptionResponse, setSaveHeroDescriptionResponse] = useState('');
    const [descriptionJson, setDescriptionJson] = useState<DescriptionItem[]>([]);
    const [saveDescriptionJsonResponse, setSaveDescriptionJsonResponse] = useState('');
    const [descriptionError, setDescriptionError] = useState('');
    const [previewHtml, setPreviewHtml] = useState('');
    const [preferredImage, setPreferredImage] = useState('');
    const [hiddenImage, setHiddenImage] = useState('');
    const [wikiUrl, setWikiUrl] = useState('');
    const [saveImageResponse, setSaveImageResponse] = useState('');
    const [speciesJsonFilter, setSpeciesJsonFilter] = useState('');
    const [filteredTaxonString, setFilteredTaxonString] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [imageStart, setImageStart] = useState(0);
    const [imageViewMode, setImageViewMode] = useState('all');

    const auth = useAuth();

    const imagePageSize = 100;


    // priority 0 is default, -1 is hidden, 1-5 are priority
    function getImagePriority(imageID: string): number {
        let idxPriority = preferredImage.split(',').indexOf(imageID);
        let idxHidden = hiddenImage.indexOf(imageID);
        if (idxPriority >= 0) {
            return idxPriority + 1;
        } else if (idxHidden >= 0) {
            return -1;
        }
        return 0;
    }

    function searchGuid() {
        setGuidSearched(guid);
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/species', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify([guid]),
        }).then((response) => {
            response.json().then((json) => {
                setTaxonString(JSON.stringify(json, null, 2));
                setImageStart(0);
                setImages([]);
                if (json.length > 0) {
                    setTaxonID(json[0].guid);
                    setKingdomName(json[0].rk_kingdom);
                    setFamilyName(json[0].rk_family);
                    setScientificName(json[0].scientificName);
                    json[0].image
                        ? setPreferredImage(json[0].image)
                        : setPreferredImage('');
                    json[0].hiddenImages_s
                        ? setHiddenImage(json[0].hiddenImages_s)
                        : setHiddenImage('');
                    json[0].heroDescription
                        ? setHeroDescription(json[0].heroDescription)
                        : setHeroDescription('');
                    json[0].wikiUrl_s
                        ? setWikiUrl(json[0].wikiUrl_s)
                        : setWikiUrl('');

                    getDescriptionsJson(json[0].guid);
                }
                setTimeout(() => filterSpeciesJson(speciesJsonFilter), 1);
            });
        });
    }


    function filterSpeciesJson(filterString: string) {
        setSpeciesJsonFilter(filterString);

        // filter each line of the taxonString
        if (filterString && taxonString) {
            let inputRows = taxonString.split('\n');
            let outputRows: string[] = [];
            inputRows.forEach((line: string) => {
                let trimed = line.trim();
                if (
                    line.indexOf(filterString) >= 0 ||
                    trimed.startsWith('[') ||
                    trimed.endsWith(']') ||
                    trimed.startsWith('{') ||
                    trimed.endsWith('}') ||
                    trimed.endsWith('],') ||
                    trimed.endsWith(': [') ||
                    trimed.endsWith(': {') ||
                    trimed.startsWith('},') ||
                    trimed.startsWith('],')
                ) {
                    outputRows.push(line);
                }
            });
            setFilteredTaxonString(outputRows.join('\n'));
        }
    }

    function loadImages() {
        fetch(
            import.meta.env.VITE_APP_BIOCACHE_URL +
            '/occurrences/search?fq=imageID:*&q=lsid:"' +
            taxonID +
            '"&fl=imageID&pageSize=' +
            imagePageSize +
            '&start=' +
            imageStart,
            {
                method: 'GET',
            }
        ).then((response) => {
            setImageStart(imageStart + imagePageSize);
            response.json().then((json) => {
                let list: string[] = [];
                for (let record of json.occurrences) {
                    list.push(record.image);
                }
                setImages([...images, ...list]);
            });
        });
    }

    function buildImageCard(imageID: string, idx: number) {
        let priority: number = getImagePriority(imageID);

        return (
            <div
                key={idx}
                className={
                    'card m-1 ' +
                    (priority > 0
                        ? 'border-success border-5'
                        : priority < 0
                            ? 'border-danger border-5'
                            : 'border-black')
                }
            >
                <a
                    className="card-img-top"
                    target="_blank"
                    href={import.meta.env.VITE_APP_IMAGE_LINK_URL + imageID}
                >
                    <img
                        src={
                            import.meta.env.VITE_APP_IMAGE_THUMBNAIL_URL +
                            imageID
                        }
                    ></img>
                </a>
                <div className="card-body d-flex flex-column">
                    <select
                        className="custom-select mt-auto"
                        value={priority}
                        onChange={(e) =>
                            changeImage(parseInt(e.target.value), imageID)
                        }
                    >
                        <option value="0">Default</option>
                        <option value="-1">Hide Image</option>
                        <option value="1">Image Priority 1</option>
                        <option value="2">Image Priority 2</option>
                        <option value="3">Image Priority 3</option>
                        <option value="4">Image Priority 4</option>
                        <option value="5">Image Priority 5</option>
                    </select>
                </div>
            </div>
        );
    }

    function changeImage(priority: number, imageID: string) {
        let currentPriority = getImagePriority(imageID);
        let hiddenIdx = hiddenImage.indexOf(imageID);

        if (priority < 0 && currentPriority >= 0) {
            // add to hidden
            setHiddenImage(hiddenImage ? hiddenImage + ',' + imageID : imageID);
        } else if (priority >= 0 && hiddenIdx >= 0) {
            // remove from hidden
            setHiddenImage(
                hiddenImage
                    .split(',')
                    .filter((value) => value !== imageID)
                    .join(',')
            );
        }

        if (priority !== currentPriority) {
            // rebuild preferred list and insert or remove it
            let list: string[] = [];
            preferredImage.split(',').forEach((value) => {
                if (list.length < 5) {
                    if (list.length == priority - 1) {
                        list.push(imageID);
                    }
                }
                if (list.length < 5 && value !== imageID) {
                    list.push(value);
                }
            });

            if (priority > 0 && list.indexOf(imageID) < 0) {
                list.push(imageID);
            }

            setPreferredImage(list.join(','));
        }
    }

    function saveHeroDescription() {
        if (!validateHeroDescription()) {
            setSaveHeroDescriptionResponse('Invalid HTML');
            return;
        }

        fetch(import.meta.env.VITE_APP_BIE_URL + '/admin/set', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taxonID: taxonID,
                scientificName: scientificName,
                family: familyName,
                kingdom: kingdomName,
                key: 'heroDescription',
                value: heroDescription,
            }),
        }).then((responsePrefer) => {
            if (!responsePrefer.ok) {
                alert('Error saving hero description: ' + responsePrefer.status + ' ' + responsePrefer.statusText);
            } else {
                // reload
                getDescriptionsJson(taxonID)

                alert('Hero description saved successfully');
            }
            setSaveHeroDescriptionResponse(JSON.stringify(responsePrefer));
        });
    }

    // validate that the hero description is valid HTML
    function validateHeroDescription() : boolean {
        const parser = new DOMParser();
        const doc = parser.parseFromString(heroDescription, 'text/html');
        var isValid = !doc.querySelector('parsererror');
        if (!isValid) {
            setSaveHeroDescriptionResponse('Hero description must be valid HTML');
        } else {
            setSaveHeroDescriptionResponse('Hero description appears to be valid HTML');
        }
        return isValid;
    }

    function previewDescription() {
        var html = '';
        for (let i = 0; i < descriptionJson.length; i++) {
            let item = descriptionJson[i];
            if (item.value) {
                html += "<h3>" + item.source + ": " + item.field + "</h3>";
                html += "<div>" + item.value + "</div>";
                html += "<hr/>";
            }
        }

        setPreviewHtml(html);
    }

    function previewHeroDescription() {
        setPreviewHtml(heroDescription);
    }

    // validate that each value in the descriptionJson is valid plain text or sanitized HTML
    function validateDescriptionJson() : boolean {
        var error = '';
        var isValid = true;
        const parser = new DOMParser();

        for (let i = 0; i < descriptionJson.length; i++) {
            let item = descriptionJson[i];

            if (item.value) {
                const doc = parser.parseFromString(item.value, 'text/html');
                if(doc.querySelector('parsererror')) {
                    isValid = false;
                    error += 'Item ' +item.source + ":" + item.field + ':"' + item.value + '"  is not valid HTML or plain text\n';
                }
            }
        }

        if (error) {
            setDescriptionError(error);
        } else {
            setDescriptionError('appears to be valid');
        }

        return isValid;
    }

    function saveDescriptionJson() {
        var valid = validateDescriptionJson();

        if (!valid) {
            alert('Description JSON is not valid: ' + descriptionError);
            return;
        }

        // prepare request body
        let updatedDescriptionJson = descriptionJson
            .filter(it => it.value !== it.original)
            .map(({ original, ...rest }) => rest);

        fetch(import.meta.env.VITE_APP_BIE_URL + '/admin/set', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taxonID: taxonID,
                scientificName: scientificName,
                family: familyName,
                kingdom: kingdomName,
                key: 'descriptions',
                value: JSON.stringify(updatedDescriptionJson),
            }),
        }).then((responsePrefer) => {
            if (!responsePrefer.ok) {
                alert('Error saving description JSON: ' + responsePrefer.status + ' ' + responsePrefer.statusText);
            } else {
                // reload
                getDescriptionsJson(taxonID);

                alert('Description JSON saved successfully');
            }
            setSaveDescriptionJsonResponse(JSON.stringify(responsePrefer));
        });
    }

    function getDescriptionsJson(taxonID: string) {
        var lsidEncoded = encodeURIComponent(encodeURIComponent(taxonID));

        fetch(import.meta.env.VITE_TAXON_DESCRIPTIONS_URL + '/' + lsidEncoded.substring(lsidEncoded.length - 2) + '/' + lsidEncoded + '.json'
        )
            .then((response) => response.json())
            .then((json) => {
                let descriptionArray = [];
                for (let key in json) {
                    if (json.hasOwnProperty(key)) {
                        let source = json[key].name;
                        for (let field in json[key]) {
                            let item = json[key][field];

                            // Skip if the key is not a valid description category
                            if (field === 'name' || field === 'url' || field === 'attribution') {
                                continue;
                            }

                            descriptionArray.push({
                                source: source,
                                field: field,
                                original: item,
                                value: item
                            });
                        }
                    }
                }
                setDescriptionJson(descriptionArray);
            })
            .catch(() => {
                // This will disable the 'loading' indicator in DescriptionView
                setDescriptionJson([]);
            });
    }

    function saveWikiUrl() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/admin/set', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taxonID: taxonID,
                scientificName: scientificName,
                family: familyName,
                kingdom: kingdomName,
                key: 'wikiUrl_s',
                value: wikiUrl,
            }),
        }).then((responsePrefer) => {
            if (responsePrefer.ok) {
                setSaveImageResponse(JSON.stringify(responsePrefer));
            } else {
                setSaveImageResponse(
                    responsePrefer.status + ': ' + responsePrefer.statusText
                );
            }
        });
    }

    // Saves both the preferred and hidden image values, probably unnecessary to always save both.
    function saveImages() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/admin/set', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                taxonID: taxonID,
                scientificName: scientificName,
                family: familyName,
                kingdom: kingdomName,
                key: 'image',
                value: preferredImage,
            }),
        }).then((responsePrefer) => {
            if (responsePrefer.ok) {
                fetch(import.meta.env.VITE_APP_BIE_URL + '/admin/set', {
                    method: 'POST',
                    headers: {
                        Authorization: 'Bearer ' + auth.user?.access_token,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        taxonID: taxonID,
                        scientificName: scientificName,
                        family: familyName,
                        kingdom: kingdomName,
                        key: 'hiddenImages_s',
                        value: hiddenImage,
                    }),
                }).then((responseHide) => {
                    setSaveImageResponse(
                        responsePrefer.status +
                        ': ' +
                        responsePrefer.statusText +
                        ', ' +
                        responseHide.status +
                        ': ' +
                        responseHide.statusText
                    );
                });
            } else {
                setSaveImageResponse(
                    responsePrefer.status + ': ' + responsePrefer.statusText
                );
            }
        });
    }

    return <>
        <div className="d-flex w-100 align-items-center alert alert-secondary">
            <label>Search taxon ID, linkIdentifier, scientificName, nameComplete or commonName</label>
            <input
                id="guid"
                className="w-50 ms-2"
                value={guid}
                onChange={(e) => {
                    setGuid(e.target.value);
                }}
            />
            <button
                className="btn border-black ms-2"
                onClick={() => searchGuid()}>
                Search
            </button>
        </div>
        {taxonString && <Tabs id="species-tabs" activeKey={speciesTab} onSelect={(k) => setSpeciesTab('' + k)}
                              className="tabs-as-buttons mt-5">
            <Tab eventKey="json" title="Raw indexed JSON - search again to refresh">
                <div style={{marginTop: '30px'}}/>
                <table className="table table-sm">
                    <thead>
                    <tr>
                        <th className="col-2"></th>
                        <th className="col-10"></th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>TaxonID</td>
                        <td>
                            <pre style={{whiteSpace: 'pre-wrap'}}>{taxonID}{' '}(searched for "{guidSearched}")</pre>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <br/>
                <input type="text" placeholder="filter JSON" className="w-100" value={speciesJsonFilter}
                       onChange={(e) => filterSpeciesJson(e.target.value)}/>
                <pre><small>{filteredTaxonString ? (<>{filteredTaxonString}</>) : (<>{taxonString}</>)}</small></pre>
            </Tab>

            <Tab eventKey="images" title="Image preferences">
                <div style={{marginTop: '30px'}}/>
                <table className="table table-sm">
                    <thead>
                    <tr>
                        <th></th>
                        <th></th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>TaxonID</td>
                        <td>
                            <pre style={{whiteSpace: 'pre-wrap',}}>{taxonID}{' '}(searched for "{guidSearched}")</pre>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label htmlFor="preferredImage" className="ms-auto me-1 mb-4" style={{display: 'block'}}>
                                Preferred imageIDs (comma separated, no whitespace)
                            </label>
                        </td>
                        <td>
                            <textarea className="form-control" id="preferredImage" value={preferredImage} rows={3}
                                      onChange={(e) => {
                                          setPreferredImage(e.target.value);
                                      }}></textarea>
                            <button className="btn border-black ms-auto me-5" onClick={() => {
                                setSaveImageResponse('...');
                                saveImages();
                            }}>Save Changes
                            </button>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label htmlFor="hiddenImage" className="ms-auto me-1 mb-4" style={{display: 'block'}}>
                                Hidden imageIDs (comma separated, no whitespace)
                            </label>
                        </td>
                        <td>
                            <textarea className="form-control" id="hiddenImage" value={hiddenImage} rows={3}
                                      onChange={(e) => {
                                          setHiddenImage(e.target.value);
                                      }}></textarea>
                            <button className="btn border-black ms-auto me-5" onClick={() => {
                                setSaveImageResponse('...');
                                saveImages();
                            }}>Save Changes
                            </button>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            <label htmlFor="wikiUrl" className="ms-auto me-1 mb-4" style={{display: 'block'}}>
                                Wikipedia URL (optional, e.g. https://en.wikipedia.org/wiki/Taxon_name)
                            </label>
                            <ul>
                                <li>Use the keyword "hide" to exclude the default Wikipedia URL when there is no replacement</li>
                                <li>Only used by old species pages</li>
                            </ul>
                        </td>
                        <td>
                            <textarea className="form-control" id="wikiUrl" value={wikiUrl} rows={3}
                                      onChange={(e) => {
                                          setWikiUrl(e.target.value);
                                      }}></textarea>
                            <button className="btn border-black ms-auto me-5" onClick={() => {
                                setSaveImageResponse('...');
                                saveWikiUrl();
                            }}>Save Changes
                            </button>
                        </td>
                    </tr>

                    {saveImageResponse && (
                        <tr>
                            <td>Response code</td>
                            <td>
                                <pre>{saveImageResponse}</pre>
                            </td>
                        </tr>
                    )}

                    <tr>
                        <td>Select type of images to list</td>
                        <td>
                            <select className="mb-4" value={imageViewMode}
                                    style={{lineHeight: '34px', height: '34px', borderRadius: '5px',}}
                                    onChange={(e) => setImageViewMode(e.target.value)}>
                                <option value="all">All Images</option>
                                <option value="preferred">Preferred Images</option>
                                <option value="hidden">Hidden Images</option>
                            </select>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <div className="d-flex flex-wrap">
                    {imageViewMode === 'preferred' && preferredImage &&
                        preferredImage.split(',').map((imageID, idx) => {
                            return buildImageCard(imageID, idx);
                        })
                    }
                    {imageViewMode === 'hidden' && hiddenImage &&
                        hiddenImage.split(',').map((imageID, idx) => {
                            return buildImageCard(imageID, idx);
                        })
                    }
                    {imageViewMode === 'all' && images.map((imageID, idx) => {
                        return buildImageCard(imageID, idx);
                    })
                    }
                </div>
                {imageViewMode === 'all' && <button className="btn border-black" onClick={() => loadImages()}>
                    Load More Images</button>
                }
            </Tab>

            <Tab eventKey="descriptions" title="Descriptions">
                <div style={{marginTop: '30px'}}/>
                <table className="table table-sm">
                    <thead>
                    <tr>
                        <th className="col-4"></th>
                        <th className="col-8"></th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr>
                        <td>TaxonID</td>
                        <td>
                            <pre style={{whiteSpace: 'pre-wrap',}}>{taxonID}{' '}(searched for "{guidSearched}")</pre>
                        </td>
                    </tr>
                    <tr>
                        <td>
                            Hero description (HTML)
                            <ul>
                                <li>Must be plain text or sanitized HTML</li>
                            </ul>
                        </td>
                        <td>
                            <textarea id="heroDescription" className="w-100" rows={5} value={heroDescription}
                                      onChange={(e) => {
                                          setHeroDescription(e.target.value);
                                      }}/>
                            <button className="btn border-black"
                                    onClick={() => {
                                        setSaveHeroDescriptionResponse('...');
                                        saveHeroDescription();
                                    }}>
                                Save Changes
                            </button>

                            <button className="btn border-black ms-2"
                                    onClick={() => {
                                        validateHeroDescription();
                                    }}>
                                Validate
                            </button>

                            <button className="btn border-black ms-2"
                                    onClick={() => {
                                        previewHeroDescription();
                                    }}>
                                Preview
                            </button>
                        </td>
                    </tr>

                    {saveHeroDescriptionResponse && (
                        <tr>
                            <td>Response code (Hero Description)</td>
                            <td>
                                <pre>{saveHeroDescriptionResponse}</pre>
                            </td>
                        </tr>
                    )}

                    <tr>
                        <td>Descriptions (JSON).
                            <ul>
                                <li>Set the category value to an empty string to remove it.</li>
                                <li>Category values must be plain text or sanitized HTML.</li>
                            </ul>
                            <span>Validation: <span style={{color: "red"}}>{descriptionError}</span></span>
                        </td>
                        <td>
                            {descriptionJson && descriptionJson.map((item, idx) =>
                                <div key={idx} className="">
                                    <span style={{ fontWeight: "bold" }}>{item.source}: {item.field}</span>
                                    <br/>
                                    <textarea value={item.value} className={"ms-4"} rows={3} cols={150}
                                              onChange={e => {
                                                  const newValue = e.target.value;
                                                  setDescriptionJson(prev =>
                                                      prev.map((desc, i) =>
                                                          i === idx ? { ...desc, value: newValue } : desc
                                                      )
                                                  );
                                              }}/>
                                </div>
                            )}
                            <button className="btn border-black" onClick={() => {
                                setSaveDescriptionJsonResponse('...');
                                saveDescriptionJson();
                            }}>Save Changes
                            </button>

                            <button className="btn border-black ms-2"
                                    onClick={() => {
                                        validateDescriptionJson();
                                    }}>
                                Validate
                            </button>

                            <button className="btn border-black ms-2"
                                    onClick={() => {
                                        previewDescription();
                                    }}>
                                Preview
                            </button>
                        </td>
                    </tr>

                    {saveDescriptionJsonResponse && (
                        <tr>
                            <td>Response code (Description JSON)</td>
                            <td>
                                <pre>{saveDescriptionJsonResponse}</pre>
                            </td>
                        </tr>
                    )}
                    </tbody>
                </table>
            </Tab>
        </Tabs>
        }

        {previewHtml && (
            <div className="modal show d-block" tabIndex={-1} style={{ background: "rgba(0,0,0,0.5)" }}>
                <div className="modal-dialog modal-lg">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h5 className="modal-title">Preview</h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={() => setPreviewHtml("")}></button>
                        </div>
                        <div className="modal-body">
                            <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setPreviewHtml("")}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </>
}

export default EditIndexedTaxon;
