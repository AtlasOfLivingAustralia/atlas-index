import {useEffect, useRef, useState} from 'react';
import {QualityProfile} from '../api/sources/model.ts';
import {Tab, Tabs} from 'react-bootstrap';
import QualityProfileItem from '../components/dq/qualityProfileItem.tsx';
import {useAuth} from 'react-oidc-context';
import Menu from '../components/menu.tsx';
import {Breadcrumb} from '@ala/common-ui';

function DataQualityAdmin({
                              setBreadcrumbs,
                          }: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const [profiles, setProfiles] = useState<QualityProfile[]>([]);
    const [profile, setProfile] = useState<QualityProfile>();
    const [tab, setTab] = useState('profiles');
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const uploadFile = useRef<HTMLInputElement>(null);
    const auth = useAuth();

    const isAdmin =
        auth.isAuthenticated &&
        Array.isArray(auth.user?.profile?.['cognito:groups']) &&
        auth.user.profile['cognito:groups'].includes('admin');

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Admin', href: '/'},
            {title: 'Data Quality', href: '/data-quality-admin'},
        ]);
        if (isAdmin) {
            fetchProfiles();
        }
    }, [auth]);

    function fetchProfiles() {
        setLoading(true);
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/dq', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
            },
        }).then((response) => {
            if (response.status === 200) {
                response.json().then((json) => {
                    setProfiles(json);
                    setError(null);
                });
            } else if (response.status === 401) {
                setError("Unauthorized. Please log in.");
            } else if (response.status === 500) {
                setError(`Request failed, server error`);
            } else {
                setError(`Unexpected status: ${response.status}`);
            }
        }).finally(() => {
            setLoading(false);
        });
    }

    function readFile(e: any) {
        let file = e.target.files[0];
        if (!file) {
            return;
        }
        let reader = new FileReader();
        reader.onload = function (e: any) {
            let contents = e.target.result;
            let profile: QualityProfile = JSON.parse(contents);

            // there should be no id field in the profile when creating a new profile, but remove it just in case
            delete (profile as any).id;

            save(profile);
        };
        reader.readAsText(file);
    }

    function save(profile: QualityProfile) {
        // double check that the shortName is unique
        if (profiles.some(p => p.shortName === profile.shortName && p.id !== profile.id)) {
            setError(`Profile with short name "${profile.shortName}" already exists.`);
            return;
        }

        setSaving(true);
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/dq', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profile),
        }).then((response) => {
            if (response.status === 200) {
                // reload all profiles
                fetchProfiles();

                // reset to list view
                setTab('profiles');

                // clear the profile
                setProfile(undefined);
            } else if (response.status === 202) {
                setError("Request accepted but not yet processed.");
            } else if (response.status === 401) {
                setError("Unauthorized. Please log in.");
            } else if (response.status === 500) {
                setError("Request failed, server error.");
            } else {
                setError(`Unexpected status: ${response.status}`);
            }
        }).finally(() => {
            setSaving(false);
        })
    }

    function downloadProfile(profile: QualityProfile) {
        // remove id fields from the profile
        var tmpProfile = JSON.parse(JSON.stringify(profile));
        delete tmpProfile.id;
        if (tmpProfile.categories) {
            for (const category of tmpProfile.categories) {
                delete category.id;
                if (category.qualityFilters) {
                    for (const qualityFilter of category.qualityFilters) {
                        delete qualityFilter.id;
                    }
                }
            }
        }

        const data = JSON.stringify(tmpProfile, null, 2);
        const blob = new Blob([data], {
            type: 'application/json;charset=utf-8',
        });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = profile.shortName + '.json'; // replace with your file name
        link.click();

        URL.revokeObjectURL(url);
    }

    function addProfile() {
        setProfile({
            id: 0,
            dateCreated: undefined,
            lastUpdated: undefined,
            name: 'New Profile',
            shortName: 'new-profile',
            description: '',
            contactName: (
                auth.user?.profile.given_name +
                ' ' +
                auth.user?.profile.family_name
            ).trim(),
            contactEmail: auth.user?.profile.email || '',
            enabled: true,
            isDefault: false,
            categories: [],
            displayOrder: profiles.length,
        });
        setTab('profile');
    }

    function updateProfile(profile: QualityProfile) {
        setProfile(profile);
    }

    function clickUpload() {
        // @ts-ignore
        uploadFile.current.click();
    }

    function deleteProfile(profileItem: QualityProfile) {
        if (!window.confirm(`Are you sure you want to delete the profile ${profileItem.shortName}?`)) {
            return;
        }
        setSaving(true);
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/dq?id=' + profileItem.id, {
                method: 'DELETE',
                headers: {Authorization: 'Bearer ' + auth.user?.access_token}
            }
        ).then((response) => {
            console.log(response);
            if (response.status === 200) {
                fetchProfiles();
            } else if (response.status === 202) {
                setError("Request accepted but not yet processed.");
            } else if (response.status === 401) {
                setError("Unauthorized. Please log in.");
            } else if (response.status === 500) {
                setError("Request failed, server error.");
            } else {
                setError(`Unexpected status: ${response.status}`);
            }
        }).finally(() => {
            setSaving(false);
        })
    }

    return (
        <>
            {(loading || saving || error) &&
                <div
                    className="position-fixed top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
                    style={{background: 'rgba(0,0,0,0.8)', zIndex: 9999}}
                >
                    <div
                        className="bg-white rounded-4 p-4 shadow d-flex flex-column align-items-center justify-content-center min-vw-25"
                        style={{maxWidth: '90vw'}}>

                        <h2 style={{textAlign: 'center'}}>{loading ? "loading..." : (saving ? "saving..." : "Error")}</h2>
                        {error &&
                            <>
                                <p style={{textAlign: 'center'}}>{error}</p>
                                <button className="btn btn-secondary" onClick={() => {
                                    setError(null);
                                    fetchProfiles();
                                }}>Close
                                </button>
                            </>
                        }
                    </div>
                </div>
            }
            <div className="d-flex w-100">
                <Menu/>
                <div className={'flex-grow-1 p-3'}>
                    {!isAdmin && (
                        <p>
                            User {auth.user?.profile?.name} is not authorised to
                            access these tools.
                        </p>
                    )}
                    {isAdmin && <>
                        <p>
                            Create, edit, import, download, delete data quality
                            profiles.
                        </p>
                        <Tabs
                            id="data-quality-tabs"
                            activeKey={tab}
                            onSelect={(k) => setTab('' + k)}
                        >
                            <Tab eventKey="profiles" title="List">
                                <br/>
                                <input
                                    type="file"
                                    ref={uploadFile}
                                    style={{display: 'none'}}
                                    onChange={(e) => {
                                        readFile(e);
                                        if (uploadFile.current instanceof HTMLInputElement) {
                                            uploadFile.current.value = '';
                                        }
                                    }}
                                />
                                <button
                                    className="btn border-black"
                                    onClick={() => addProfile()}
                                >
                                    Add profile
                                </button>
                                <button
                                    className="btn border-black ms-1"
                                    onClick={() => clickUpload()}
                                >
                                    Import a profile
                                </button>
                                <br/>
                                <br/>

                                <table className="table table-bordered">
                                    <thead>
                                    <tr>
                                        <th>Id</th>
                                        <th>Name</th>
                                        <th>short-name</th>
                                        <th>enabled</th>
                                        <th></th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {profiles && profiles.slice().sort((a, b) => a.id - b.id).map((profileItem, idx) => (
                                        <tr key={idx}>
                                            <td>{profileItem.id}</td>
                                            <td className="text-reset">
                                                {profileItem.name}
                                            </td>
                                            <td>
                                                {profileItem.shortName}
                                            </td>
                                            <td>
                                                <input
                                                    type="checkbox"
                                                    defaultChecked={profileItem.enabled}
                                                    disabled={profileItem.isDefault}
                                                    onChange={() => {
                                                        profileItem.enabled = !profileItem.enabled;
                                                        save(profileItem);
                                                    }}
                                                />
                                            </td>
                                            <td>
                                                <div className="d-flex">
                                                    <button
                                                        className="btn btn-secondary border-black ms-1"
                                                        onClick={() => {
                                                            profileItem.isDefault = true;
                                                            save(profileItem);
                                                        }}
                                                        disabled={profileItem.isDefault || !profileItem.enabled}
                                                        style={{backgroundColor: profileItem.isDefault ? '#c7254e' : ''}}
                                                    >Default
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary border-black ms-1"
                                                        onClick={() => deleteProfile(profileItem)}
                                                        disabled={profileItem.isDefault}
                                                    >Delete
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary border-black ms-1"
                                                        onClick={() => downloadProfile(profileItem)}>
                                                        Download
                                                    </button>
                                                    <button
                                                        className="btn btn-secondary border-black ms-1"
                                                        onClick={() => {
                                                            setProfile(profileItem);
                                                            setTab('profile');
                                                        }}>Edit
                                                    </button>
                                                </div>
                                                <br/>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </Tab>
                            <Tab eventKey="profile" title="Edit Profile">
                                {profile && (
                                    <>
                                        <QualityProfileItem
                                            profile={profile}
                                            updateProfile={updateProfile}
                                            save={save}
                                        />
                                    </>
                                )}
                                {!profile && (
                                    <div style={{marginTop: '30px'}}>
                                        On the "List" tab, click an "Edit"
                                        button beside a profile to begin
                                        editing.
                                    </div>
                                )}
                            </Tab>
                        </Tabs>
                    </>
                    }
                </div>
            </div>
        </>
    );
}

export default DataQualityAdmin;
