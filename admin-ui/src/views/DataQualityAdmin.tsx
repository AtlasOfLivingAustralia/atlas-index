import { useEffect, useRef, useState } from 'react';
import { QualityProfile } from '../api/sources/model.ts';
import { Tab, Tabs } from 'react-bootstrap';
import QualityProfileItem from '../components/dq/qualityProfileItem.tsx';
import { useAuth } from 'react-oidc-context';
import Menu from '../components/menu.tsx';
import { Breadcrumb } from '@ala/common-ui';

function DataQualityAdmin({
    setBreadcrumbs,
}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const [profiles, setProfiles] = useState<QualityProfile[]>([]);
    const [profile, setProfile] = useState<QualityProfile>();
    const [tab, setTab] = useState('profiles');
    const [saving, setSaving] = useState(false);

    const uploadFile = useRef(null);
    const auth = useAuth();

    const isAdmin =
        auth.isAuthenticated &&
        Array.isArray(auth.user?.profile?.['cognito:groups']) &&
        auth.user.profile['cognito:groups'].includes('admin');

    useEffect(() => {
        setBreadcrumbs([
            { title: 'Home', href: import.meta.env.VITE_HOME_URL },
            { title: 'Admin', href: '/' },
            { title: 'Data Quality', href: '/data-quality-admin' },
        ]);
        if (isAdmin) {
            fetchProfiles();
        }
    }, [auth]);

    function fetchProfiles() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/dq', {
            method: 'GET',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
            },
        }).then((response) => {
            if (response.ok) {
                response.json().then((json) => {
                    setProfiles(json);
                    setSaving(false);
                });
            } else {
                setSaving(false);
            }
        });
    }

    function readFile(e: any) {
        var file = e.target.files[0];
        if (!file) {
            return;
        }
        var reader = new FileReader();
        reader.onload = function (e: any) {
            var contents = e.target.result;
            save(JSON.parse(contents));
        };
        reader.readAsText(file);
    }

    function save(profile: QualityProfile) {
        setSaving(true);
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/dq', {
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + auth.user?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profile),
        }).then(() => {
            // reload all profiles
            fetchProfiles();

            // reset to list view
            setTab('profiles');

            // clear the profile
            setProfile(undefined);
        });
    }

    function downloadProfile(profile: QualityProfile) {
        const data = JSON.stringify(profile, null, 2);
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

    function redrawProfileJson() {
        profile && setProfile(JSON.parse(JSON.stringify(profile)));
    }

    function updateProfile(profile: QualityProfile) {
        setProfile(profile);
    }

    function clickUpload() {
        // @ts-ignore
        uploadFile.current.click();
    }

    return (
        <div className="d-flex flex-row">
            <Menu />
            <div className={'p-3'}>
                {!isAdmin && (
                    <p>
                        User {auth.user?.profile?.name} is not authorised to
                        access these tools.
                    </p>
                )}
                {isAdmin && (
                    <>
                        {saving && (
                            <div className={'alert alert-info'}>
                                save in progress...
                            </div>
                        )}
                        <p>
                            Create, edit, import, download, delete data quality
                            profiles.
                        </p>
                        <Tabs
                            id="data-quality-tabs"
                            activeKey={tab}
                            onSelect={(k) => setTab('' + k)}
                            className=""
                        >
                            <Tab eventKey="profiles" title="List">
                                <input
                                    type="file"
                                    ref={uploadFile}
                                    style={{ display: 'none' }}
                                    onChange={(e) => readFile(e)}
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
                                <br />
                                <br />

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
                                        {profiles &&
                                            profiles.map((profileItem, idx) => (
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
                                                            defaultChecked={
                                                                profileItem.enabled
                                                            }
                                                            disabled={
                                                                profileItem.isDefault
                                                            }
                                                            onChange={() => {
                                                                profileItem.enabled =
                                                                    !profileItem.enabled;
                                                                save(
                                                                    profileItem
                                                                );
                                                            }}
                                                        />
                                                    </td>
                                                    <td>
                                                        <div className="d-flex">
                                                            <button
                                                                className="btn border-black ms-1"
                                                                onClick={() => {
                                                                    profileItem.isDefault = true;
                                                                    save(
                                                                        profileItem
                                                                    );
                                                                }}
                                                                disabled={
                                                                    profileItem.isDefault ||
                                                                    !profileItem.enabled
                                                                }
                                                            >
                                                                Default
                                                            </button>
                                                            <button
                                                                className="btn border-black ms-1"
                                                                onClick={() => {
                                                                    fetch(
                                                                        import.meta
                                                                            .env
                                                                            .VITE_APP_BIE_URL +
                                                                            '/v2/admin/dq?id=' +
                                                                            profileItem.id,
                                                                        {
                                                                            method: 'DELETE',
                                                                            headers:
                                                                                {
                                                                                    Authorization:
                                                                                        'Bearer ' +
                                                                                        auth
                                                                                            .user
                                                                                            ?.access_token,
                                                                                },
                                                                        }
                                                                    ).then(
                                                                        (
                                                                            response
                                                                        ) => {
                                                                            if (
                                                                                response.ok
                                                                            ) {
                                                                                fetchProfiles();
                                                                            }
                                                                        }
                                                                    );
                                                                }}
                                                                disabled={
                                                                    profileItem.isDefault
                                                                }
                                                            >
                                                                Delete
                                                            </button>
                                                            <button
                                                                className="btn border-black ms-1"
                                                                onClick={() =>
                                                                    downloadProfile(
                                                                        profileItem
                                                                    )
                                                                }
                                                            >
                                                                Download
                                                            </button>
                                                            <button
                                                                className="btn border-black ms-1"
                                                                onClick={() => {
                                                                    setProfile(
                                                                        profileItem
                                                                    );
                                                                    setTab(
                                                                        'profile'
                                                                    );
                                                                }}
                                                            >
                                                                Edit
                                                            </button>
                                                        </div>
                                                        <br />
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
                                        <br />
                                        <button
                                            className="btn border-black"
                                            onClick={() => redrawProfileJson()}
                                        >
                                            Refresh JSON
                                        </button>
                                        <pre>
                                            {profile &&
                                                JSON.stringify(
                                                    profile,
                                                    null,
                                                    2
                                                )}
                                        </pre>
                                    </>
                                )}
                                {!profile && (
                                    <div style={{ marginTop: '30px' }}>
                                        On the "List" tab, click an "Edit"
                                        button beside a profile to begin
                                        editing.
                                    </div>
                                )}
                            </Tab>
                        </Tabs>
                    </>
                )}
            </div>
        </div>
    );
}

export default DataQualityAdmin;
