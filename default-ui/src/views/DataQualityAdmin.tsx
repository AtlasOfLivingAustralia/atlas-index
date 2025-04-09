import UserContext from "../helpers/UserContext.ts";
import {useContext, useEffect, useRef, useState} from "react";
import {Breadcrumb, ListsUser, QualityProfile} from "../api/sources/model.ts";
import QualityProfileItem from "../components/dq/qualityProfileItem.tsx";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";
import {Modal} from "react-bootstrap";
import {Table, TableTh, TableTd, TableTr, TableTbody, Button, Title, Container, Grid} from "@mantine/core";

function DataQualityAdmin({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const currentUser = useContext(UserContext) as ListsUser;
    const [profiles, setProfiles] = useState<QualityProfile[]>([]);
    const [profile, setProfile] = useState<QualityProfile>();
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

    function reorder(list: any, startIndex: number, endIndex: number) {
        const result = Array.from(list);
        const [removed] = result.splice(startIndex, 1);
        result.splice(endIndex, 0, removed);

        return result;
    };

    function fetchProfiles() {
        setSaving(true);
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

    const onDragEnd = (result: any) => {
        // dropped outside the list
        if (!result.destination) {
            return;
        }

        const items = reorder(
            profiles,
            result.source.index,
            result.destination.index
        );

        // Update the displayOrder for each profile in the reordered list
        const updatedProfiles = items.map((profile, index) => ({ ...profile, displayOrder: index }));

        setProfiles(updatedProfiles);
        for (let i = 0; i < profiles.length; i++) {
            if (profiles[i].displayOrder !== updatedProfiles[i].displayOrder) {
                save(updatedProfiles[i]);
            }
        }

    };

    return (
        <Container>
            <Grid mt={{ base: 'xs', lg: 'md'}} mb="lg" gutter={0}>
                <Title>Data Quality Admin {saving && "... saving ..."}</Title>
                {!currentUser?.isAdmin() &&
                    <p>User {currentUser?.user()?.profile?.name} is not authorised to access these tools.</p>
                }
                {currentUser?.isAdmin() &&
                    <>

                        <input type="file" ref={uploadFile} style={{display: 'none'}}
                               onChange={e => readFile(e)}/>
                        <Button className="btn border-black" onClick={() => addProfile()}>
                            Add a profile
                        </Button>
                        <Button className="btn border-black ms-1" onClick={() => clickUpload()}>
                            Import a profile
                        </Button>
                        <br/>
                        <br/>

                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="profiles-list">
                                {(provided) => (
                                    <Table className="table table-bordered" {...provided.droppableProps} ref={provided.innerRef}>
                                        <>
                                        <TableTr>
                                            <TableTh></TableTh>
                                            <TableTh>Id</TableTh>
                                            <TableTh>Name</TableTh>
                                            <TableTh>short-name</TableTh>
                                            <TableTh>enabled</TableTh>
                                            <TableTh></TableTh>
                                        </TableTr>
                                        </>
                                        <TableTbody>
                                        {profiles && profiles.slice()
                                            .sort((a, b) => a.displayOrder - b.displayOrder)
                                            .map((profileItem, index) => (
                                                <Draggable key={profileItem.id} draggableId={`profile-${profileItem.id}`} index={index}>
                                                    {(provided) => (
                                                        <TableTr ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps}>
                                                            <TableTd style={{ cursor: 'grab' }}>☰</TableTd>
                                                            <TableTd>{profileItem.id}</TableTd>
                                                            <TableTd>
                                                                <div onClick={() => setProfile(profileItem)} className="text-reset" style={{ cursor: 'pointer' }}>{profileItem.name}</div>
                                                            </TableTd>
                                                            <TableTd>{profileItem.shortName}</TableTd>
                                                            <TableTd>
                                                                <input type="checkbox" defaultChecked={profileItem.enabled} disabled={profileItem.isDefault} onChange={() => {
                                                                    profileItem.enabled = !profileItem.enabled;
                                                                    save(profileItem);
                                                                }} />
                                                            </TableTd>
                                                            <TableTd>
                                                                <div className="d-flex">
                                                                    <Button className="btn border-black ms-1" onClick={() => {
                                                                        profileItem.isDefault = true;
                                                                        save(profileItem);
                                                                    }} disabled={profileItem.isDefault || !profileItem.enabled}>Default</Button>
                                                                    <Button className="btn border-black ms-1" onClick={() => {
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
                                                                    }} disabled={profileItem.isDefault}>Delete</Button>
                                                                    <Button className="btn border-black ms-1" onClick={() => downloadProfile(profileItem)}>Download</Button>
                                                                </div>
                                                                <br />
                                                            </TableTd>
                                                        </TableTr>
                                                    )}
                                                </Draggable>
                                            ))}
                                        {provided.placeholder}
                                        </TableTbody>
                                    </Table>
                                )}
                            </Droppable>
                        </DragDropContext>
                        {profile && (
                            <Modal show={true} onHide={() => setProfile(undefined)} size="lg">
                                <Modal.Header closeButton>
                                    <Modal.Title>{profile.id === 0 ? "New Profile" : "Edit Profile"}</Modal.Title>
                                </Modal.Header>
                                <Modal.Body>
                                    <QualityProfileItem profile={profile} updateProfile={updateProfile} save={save} />
                                </Modal.Body>
                            </Modal>
                        )}
                    </>
                }
            </Grid>
        </Container>
    );
}

export default DataQualityAdmin;