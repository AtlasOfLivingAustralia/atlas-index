import {DataQualityInfo, QualityCategory} from "../../api/sources/model.ts";
import {useState} from "react";
import DataQualityInfoModal from "./dataQualityInfoModal.tsx";
import DataQualitySettingsModal from "./dataQualitySettingsModal.tsx";
import DataQualityFiltersModal from "./dataQualityFiltersModal.tsx";
import DataQualityExcluded from "./dataQualityExcluded.tsx";
import DataQualityCategoryInfoModal from "./dataQualityCategoryInfoModal.tsx";

interface DataQualityProps {
    dataQuality: any[],
    dataQualityInfo: DataQualityInfo,
    queryString: string | undefined,
    addParams: (fqs: string[], removeFqs: string[]) => void,
    updateDataQualityInfo: (dataQualityInfo: DataQualityInfo) => void
}

function DataQuality({
                         dataQuality,
                         dataQualityInfo,
                         queryString,
                         addParams,
                         updateDataQualityInfo
                     }: DataQualityProps) {

    const [expanded, setExpanded] = useState(dataQualityInfo.expand)
    const [showInfo, setShowInfo] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [showFilters, setShowFilters] = useState(false)
    const [currentCategory, setCurrentCategory] = useState<QualityCategory | undefined>(undefined)
    const [showCategoryInfo, setShowCategoryInfo] = useState(false)

    function isDqFilterSelected(cat: any) {
        return (dataQualityInfo.selectedFilters === undefined || dataQualityInfo.selectedFilters.includes(cat.label)) &&
            !(queryString?.includes("disableQualityFilter=" + cat.label + "&") ||
                queryString?.endsWith("disableQualityFilter=" + cat.label));
    }

    function addFilter(cat: QualityCategory) {
        let selectedFilters = dataQualityInfo.selectedFilters || [];
        selectedFilters.push(cat.label);
        updateDataQualityInfo({...dataQualityInfo, selectedFilters: selectedFilters});
    }

    function removeFilter(cat: QualityCategory) {
        let selectedFilters = dataQualityInfo.selectedFilters || [];
        selectedFilters = selectedFilters.filter(f => f !== cat.label);
        updateDataQualityInfo({...dataQualityInfo, selectedFilters: selectedFilters});
    }

    function showCategoryModal(cat: QualityCategory) {
        setCurrentCategory(cat)
        setShowCategoryInfo(true)
    }

    function resetDq() {
        if (queryString) {
            let terms = (queryString.startsWith('?') ? queryString.substring(1) : queryString).split("&");

            let removeParams = [];

            for (let term of terms) {
                if (term.startsWith("qualityProfile=")) {
                    removeParams.push(term)
                } else if (term.startsWith("disableAllQualityFilters=")) {
                    removeParams.push(term)
                } else if (term.startsWith("disableQualityFilter=")) {
                    removeParams.push(term)
                }
            }

            if (removeParams.length > 0) {
                addParams([], removeParams);
            }
        }
    }

    return <> {dataQuality.length > 0 && <>
        <div id="dataQuality" className="container-fluid activeFilters mb-2">
            <div className="d-flex align-items-center">
                <div className="no-wrap" onClick={() => setExpanded(!expanded)} style={{cursor: "pointer"}}>
                    {expanded ?
                        <i className="bi bi-caret-down-fill"></i>
                        :
                        <i className="bi bi-caret-right-fill"></i>
                    }
                    &nbsp;<b className="dqLabel">Data
                    Profile</b>:
                </div>

                <div id="dataQualitySelect" className="form-control border-0">
                    <select className="input-small" value={dataQualityInfo.profile}
                            onChange={(e) => {
                                dataQualityInfo.profile = e.target.value;
                                dataQualityInfo.selectedFilters = undefined;

                                updateDataQualityInfo({...dataQualityInfo})
                            }}>
                        {dataQuality.map((dq, index) =>
                            <option key={index} value={dq.shortName} title="Click to switch profile">{dq.name}</option>
                        )}
                        <option value="disable">Disable data profiles</option>
                    </select>
                </div>

                <div className="DQProfileDetailsLink" onClick={() => setShowInfo(true)}>
                    <i className="bi bi-info-circle-fill tooltips dqLabel"
                       title="Click to view the profile description"></i>
                </div>

                <div className="ms-2">
                    <i className="bi bi-arrow-counterclockwise tooltips dqLabel" title="Reset filters"
                    onClick={() => resetDq()}></i>
                </div>

                <div className="ms-2 no-wrap dqLabel" onClick={() => setShowFilters(true)}>
                    <i className="bi bi-list-check tooltips me-1" title="Enable/Disable multiple filters"></i>
                    Select filters
                </div>

                <div className="ms-auto no-wrap dqLabel">
                    <div id="usersettings" title="Data profile settings" onClick={() => setShowSettings(true)}>
                        <i className="bi bi-gear-fill me-1"></i>Settings
                    </div>
                </div>

                {showInfo && <DataQualityInfoModal
                    onClose={() => setShowInfo(false)}
                    dataQualityInfo={dataQualityInfo}
                    dataQuality={dataQuality}/>}

                {showFilters && <DataQualityFiltersModal
                    onClose={() => setShowFilters(false)}
                    queryString={queryString}
                    dataQualityInfo={dataQualityInfo}
                    updateDataQualityInfo={updateDataQualityInfo}
                    dataQuality={dataQuality}
                    addParams={addParams}/>}

                {showSettings && <DataQualitySettingsModal
                    onClose={() => setShowSettings(false)}
                    queryString={queryString}
                    dataQualityInfo={dataQualityInfo}
                    dataQuality={dataQuality}/>}

            </div>

            <div className="row">
                {expanded && dataQuality.find(dq => dq.shortName === dataQualityInfo.profile)?.categories.map((cat: QualityCategory, idx: number) =>
                    <div key={idx} className="col-6 d-flex dqFilter">
                        <div className=""
                             title={cat.description}>
                            {isDqFilterSelected(cat)}
                            {isDqFilterSelected(cat) ?
                                <i className="bi bi-check-square me-1 dqLabel" onClick={() => removeFilter(cat)}></i>
                                :
                                <i className="bi bi-square me-1 dqLabel" onClick={() => addFilter(cat)}></i>
                            }
                            {cat.name}
                        </div>

                        <i className="bi bi-info-circle tooltips dqLabel ms-1"
                           title="Click for more information and actions"
                           onClick={() => showCategoryModal(cat)}></i>
                        {isDqFilterSelected(cat) &&
                            <div className="ms-1 d-flex" title="Show excluded records">
                                <DataQualityExcluded queryString={queryString} category={cat} addParams={addParams}/>
                            </div>
                        }

                    </div>
                )}
            </div>
            {showCategoryInfo && currentCategory && <DataQualityCategoryInfoModal
                onClose={() => setShowCategoryInfo(false)}
                dataQualityInfo={dataQualityInfo}
                category={currentCategory}
                queryString={queryString}
                addParams={addParams}
            />}
        </div>
    </>}</>
}

export default DataQuality;
