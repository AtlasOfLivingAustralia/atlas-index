import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useRef, useState} from "react";
import {Breadcrumb, ListsUser, QualityProfile} from "../api/sources/model.ts";
// import {Tab, Tabs} from "react-bootstrap";
import QualityProfileItem from "../components/dq/qualityProfileItem.tsx";
import { Box, Button, Code, Container, Divider, Group, Space, Table, Tabs } from "@mantine/core";

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

    const handleTabChange = (value: string | null) => {
        const tabsTab = value || ''; 
        setTab(tabsTab);
    };

    return (
        <>
            <Box>
                <Container size="lg">
                    <Space h="lg" />
                    <h2>Data Quality Admin {saving && "... saving ..."}</h2>
                    {!currentUser?.isAdmin() &&
                        <p>User {currentUser?.user()?.profile?.name} is not authorised to access these tools.</p>
                    }
                    {currentUser?.isAdmin() &&
                        <Tabs
                            id="data-quality-tabs"
                            onChange={handleTabChange}
                            defaultValue={tab}
                            className=""
                        >
                            <Tabs.List>
                                    <Tabs.Tab value="profiles">Lists</Tabs.Tab>
                                    <Tabs.Tab value="profile">Edit profile</Tabs.Tab>
                                </Tabs.List>
                        </Tabs>
                    }
                </Container>
            </Box>
            <Divider />
            <Container size="lg">
                <Space h="lg" />
                {tab === 'profiles' &&
                    <>
                        <Group justify="left">
                            <input type="file" ref={uploadFile} style={{display: 'none'}}
                                    onChange={e => readFile(e)}/>
                            <Button variant="default" onClick={() => addProfile()}>
                                Add a profile
                            </Button>
                            <Button variant="default" onClick={() => clickUpload()}>
                                Import a profile
                            </Button>
                        </Group>
                        <Space h="lg" />
                        <Table striped >
                        <Table.Thead>
                            <Table.Tr>
                                <Table.Th>Id</Table.Th>
                                <Table.Th>Name</Table.Th>
                                <Table.Th>Short-name</Table.Th>
                                <Table.Th>Enabled</Table.Th>
                                <Table.Th></Table.Th>
                            </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                                {profiles && profiles.map((profileItem, idx) => (
                                    <Table.Tr key={idx}>
                                        <Table.Td>{profileItem.id}</Table.Td>
                                        <Table.Td>
                                            <div onClick={() => {
                                                setProfile(profileItem);
                                                setTab('profile');
                                            }} className="text-reset">{profileItem.name}</div>
                                        </Table.Td>
                                        <Table.Td>{profileItem.shortName}</Table.Td>
                                        <Table.Td><input type="checkbox" defaultChecked={profileItem.enabled}
                                                    disabled={profileItem.isDefault}
                                                    onChange={() => {
                                                        profileItem.enabled = !profileItem.enabled;
                                                        save(profileItem)
                                                    }}/></Table.Td>
                                        <Table.Td>
                                            <div className="d-flex">
                                                <Button variant="default" onClick={() => {
                                                    profileItem.isDefault = true;
                                                    save(profileItem);
                                                }} disabled={profileItem.isDefault || !profileItem.enabled}>Default
                                                </Button>
                                                <Button variant="default" onClick={() => {
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
                                                </Button>
                                                <Button variant="default"
                                                        onClick={() => downloadProfile(profileItem)}>
                                                    Download
                                                </Button>
                                            </div>
                                            <br/>
                                        </Table.Td>
                                    </Table.Tr>
                                ))}
                            </Table.Tbody>
                        </Table>
                        
                    </>
                }
                {tab === 'profile' && profile &&
                    <QualityProfileItem profile={profile} updateProfile={updateProfile} save={save}/>
                }
                {tab === 'profile' &&
                    <>
                        <br/>
                        <Button variant="default" onClick={() => redrawProfileJson()}>Refresh 
                            JSON</Button>
                        <Space h="lg" />
                        <Code block>
                            {profile 
                                ? JSON.stringify(profile, null, 2)
                                : 'JSON output appears here...'}
                        </Code>
                    </>
                }
            </Container>

            
        </>
        
    );
}

export default DataQualityAdmin;
