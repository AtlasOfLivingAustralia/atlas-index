/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';
import {QualityCategory, QualityProfile} from '../../api/sources/model.ts';
import classes from './quality.module.css';
import QualityCategoryItem from './qualityCategoryItem.tsx';

function QualityProfileItem(props: {
    profile: QualityProfile;
    updateProfile: (profile: QualityProfile) => void;
    save: (profile: QualityProfile) => void;
}) {
    const [profile, setProfile] = useState<QualityProfile>(props.profile);
    const [profileDirty, setProfileDirty] = useState<boolean>(false);

    useEffect(() => {
        setProfile(props.profile);
        setProfileDirty(false);
    }, [props.profile]);

    function addCategory() {
        if (profile) {
            profile.categories.push({
                id: 0,
                enabled: true,
                name: 'New Category',
                label: 'new-category',
                description: '',
                displayOrder: profile.categories.length,
                inverseFilter: '',
                qualityFilters: [],
            });
            props.updateProfile(JSON.parse(JSON.stringify(profile)));

            //setProfile({...profile});
            setProfileDirty(true);
        }
    }

    function deleteCategory(category: QualityCategory) {
        if (profile) {
            // update display
            profile.categories = profile.categories.filter(
                (c) => c.displayOrder != category.displayOrder
            );
            setProfile({...profile});

            // update parent
            props.profile.categories = props.profile.categories.filter(
                (c) => c.displayOrder != category.displayOrder
            );
            setProfileDirty(true);
        }
    }

    function updateShortName(shortName: string) {
        // update display
        profile.shortName = shortName;
        setProfile({...profile});

        // update parent
        props.profile.shortName = shortName;
        setProfileDirty(true);
    }

    function updateName(name: string) {
        // update display
        profile.name = name;
        setProfile({...profile});

        // update parent
        props.profile.name = name;
        setProfileDirty(true);
    }

    function updateDescription(description: string) {
        // update display
        profile.description = description;
        setProfile({...profile});

        // update parent
        props.profile.description = description;
        setProfileDirty(true);
    }

    function updateContactName(contactName: string) {
        // update display
        profile.contactName = contactName;
        setProfile({...profile});

        // update parent
        props.profile.contactName = contactName;
        setProfileDirty(true);
    }

    function updateContactEmail(contactEmail: string) {
        // update display
        profile.contactEmail = contactEmail;
        setProfile({...profile});

        // update parent
        props.profile.contactEmail = contactEmail;
        setProfileDirty(true);
    }

    return (
        <>
            <h4 className={"pt-4"}>Profile</h4>
            <div className={"p-2 mb-2 rounded " + classes.infoBg}>
                <table className={"table table-sm table-borderless"}>
                    <tbody>
                    <tr>
                        <td>Name (id: {profile.id})</td>
                        <td>
                            <input
                                type="text"
                                value={profile.name}
                                className="w-50"
                                onChange={(e) => updateName(e.target.value)}
                                maxLength={255}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Short Name</td>
                        <td>
                            <input
                                type="text"
                                value={profile.shortName}
                                className="w-50"
                                onChange={(e) => updateShortName(e.target.value)}
                                maxLength={255}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Description</td>
                        <td>
                        <textarea
                            value={profile.description}
                            rows={3}
                            cols={50}
                            onChange={(e) => updateDescription(e.target.value)}
                            maxLength={1000}
                        ></textarea>
                        </td>
                    </tr>
                    <tr>
                        <td>Contact Name</td>
                        <td>
                            <input
                                type="text"
                                value={profile.contactName}
                                className="w-50"
                                onChange={(e) => updateContactName(e.target.value)}
                                maxLength={255}
                            />
                        </td>
                    </tr>
                    <tr>
                        <td>Contact Email</td>
                        <td>
                            <input
                                type="text"
                                value={profile.contactEmail}
                                className="w-50"
                                onChange={(e) => updateContactEmail(e.target.value)}
                                maxLength={255}
                            />
                        </td>
                    </tr>
                    </tbody>
                </table>
            </div>
            <div>
                <table className="table table-sm">
                    <tbody>
                    <tr>
                        <td colSpan={2}>
                            <div className="d-flex">
                                <button
                                    className="btn border-black btn-primary"
                                    style={{ color: !profileDirty ? '#000' : '#fff' }}
                                    onClick={() => props.save(profile)}
                                    disabled={!profileDirty}
                                >
                                    Save Changes
                                </button>
                                <span className={"ms-2 mt-2"}
                                      style={{verticalAlign: "bottom"}}>Last saved {profile.lastUpdated ? new Date(profile.lastUpdated).toLocaleString() : "never"}</span>
                            </div>
                            <hr/>
                            <h4>Summary</h4>
                            <div className="d-flex flex-column p-3 rounded"
                                 style={{backgroundColor: "#e9e9e9", border: "1px solid"}}>
                                <ul>
                                    {profile.categories.slice().sort((a, b) => a.id - b.id).map((category) =>
                                        <li key={category.displayOrder}>
                                            <span>{category.label}</span>
                                            <span style={{
                                                color: '#c7254e',
                                                marginLeft: '15px'
                                            }}>{category.qualityFilters && category.qualityFilters.map((f) => f.filter).join(' AND ')}</span>
                                        </li>
                                    )}
                                </ul>
                            </div>
                            <hr/>
                            <h4>Categories</h4>
                            <div className="d-flex flex-column">
                                {profile.categories.slice().sort((a, b) => a.id - b.id).map((category, idx) => (
                                    <QualityCategoryItem
                                        key={idx}
                                        category={category}
                                        actualCategory={props.profile.categories.find(
                                            (it) =>
                                                it.displayOrder ==
                                                category.displayOrder
                                        )}
                                        setProfileDirty={setProfileDirty}
                                        deleteCategory={deleteCategory}
                                    />
                                ))}
                            </div>
                        </td>
                    </tr>
                    </tbody>
                </table>
                <button
                    className="btn border-black ms-1"
                    onClick={() => addCategory()}
                >
                    Add category
                </button>
            </div>
        </>
    );
}

export default QualityProfileItem;
