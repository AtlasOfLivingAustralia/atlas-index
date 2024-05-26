import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useRef, useState} from "react";
import {Breadcrumb, ListsUser, QualityProfile} from "../api/sources/model.ts";
import {Tab, Tabs} from "react-bootstrap";
import QualityProfileItem from "../components/dq/qualityProfileItem.tsx";

function DataQualityAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const currentUser = useContext(UserContext) as ListsUser;
    const [profiles, setProfiles] = useState<QualityProfile[]>([]);
    const [profile, setProfile] = useState<QualityProfile>();
    const [tab, setTab] = useState('profiles');
    const [saving, setSaving] = useState(false);

    const uploadFile = useRef(null)

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Data Quality Admin', href: '/data-quality-admin'},
        ]);
        if (currentUser && !currentUser?.isLoading()) {
            fetchProfiles();
        }
    }, [currentUser]);

    function fetchProfiles() {
        fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/dq', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + currentUser.user()?.access_token,
            }
        }).then(response => {
            if (response.ok) {
                response.json().then(json => {
                    setProfiles(json);
                    setSaving(false);
                })
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
                'Authorization': 'Bearer ' + currentUser.user()?.access_token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(profile)
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
        const blob = new Blob([data], {type: "application/json;charset=utf-8"});
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.href = url;
        link.download = profile.shortName + ".json"; // replace with your file name
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
            contactName: (currentUser.user()?.profile.given_name + ' ' + currentUser.user()?.profile.family_name).trim(),
            contactEmail: currentUser.user()?.profile.email || '',
            enabled: true,
            isDefault: false,
            categories: [],
            displayOrder: profiles.length
        })
        setTab('profile')
    }

    function redrawProfileJson() {
        setProfile(JSON.parse(JSON.stringify(profile)));
    }

    function updateProfile(profile: QualityProfile) {
        setProfile(profile);
    }

    function clickUpload() {
        // @ts-ignore
        uploadFile.current.click()
    }

    return (
        <div className="container-fluid">
            <h2>Data Quality Admin {saving && "... saving ..."}</h2>
            {!currentUser?.isAdmin() &&
                <p>User {currentUser?.user()?.profile?.name} is not authorised to access these tools.</p>
            }
            {currentUser?.isAdmin() &&
                <>
                    <Tabs
                        id="data-quality-tabs"
                        activeKey={tab}
                        onSelect={(k) => setTab("" + k)}
                        className=""
                    >
                        <Tab eventKey="profiles" title="List">

                            <input type="file" ref={uploadFile} style={{display: 'none'}}
                                   onChange={e => readFile(e)}/>
                            <button className="btn border-black" onClick={() => addProfile()}>
                                Add a profile
                            </button>
                            <button className="btn border-black ms-1" onClick={() => clickUpload()}>
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
                                {profiles && profiles.map((profileItem, idx) => (
                                    <tr key={idx}>
                                        <td>{profileItem.id}</td>
                                        <td>
                                            <div onClick={() => {
                                                setProfile(profileItem);
                                                setTab('profile');
                                            }} className="text-reset">{profileItem.name}</div>
                                        </td>
                                        <td>{profileItem.shortName}</td>
                                        <td><input type="checkbox" defaultChecked={profileItem.enabled}
                                                   disabled={profileItem.isDefault}
                                                   onChange={() => {
                                                       profileItem.enabled = !profileItem.enabled;
                                                       save(profileItem)
                                                   }}/></td>
                                        <td>
                                            <div className="d-flex">
                                                <button className="btn border-black ms-1" onClick={() => {
                                                    profileItem.isDefault = true;
                                                    save(profileItem);
                                                }} disabled={profileItem.isDefault || !profileItem.enabled}>Default
                                                </button>
                                                <button className="btn border-black ms-1" onClick={() => {
                                                    fetch(import.meta.env.VITE_APP_BIE_URL + '/v2/admin/dq?id=' + profileItem.id, {
                                                        method: 'DELETE',
                                                        headers: {
                                                            'Authorization': 'Bearer ' + currentUser.user()?.access_token,
                                                        }
                                                    }).then(response => {
                                                        if (response.ok) {
                                                            fetchProfiles();
                                                        }
                                                    });
                                                }} disabled={profileItem.isDefault}>Delete
                                                </button>
                                                <button className="btn border-black ms-1"
                                                        onClick={() => downloadProfile(profileItem)}>
                                                    Download
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
                            {profile &&
                                <QualityProfileItem profile={profile} updateProfile={updateProfile} save={save}/>}
                            <br/>
                            <button className="btn border-black" onClick={() => redrawProfileJson()}>Refresh JSON
                            </button>
                            <pre>
                                {profile && JSON.stringify(profile, null, 2)}
                            </pre>
                        </Tab>
                    </Tabs>
                </>
            }
        </div>
    );
}

export default DataQualityAdmin;
