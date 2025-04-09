import {QualityCategory, QualityProfile} from "../../api/sources/model.ts";
import {useEffect, useState} from "react";
import QualityCategoryItem from "./qualityCategoryItem.tsx";
import {Table, TableTd, TableTr, TableTbody, Button, Textarea} from "@mantine/core";


function QualityProfileItem(props: {
    profile: QualityProfile,
    updateProfile: (profile: QualityProfile) => void
    save: (profile: QualityProfile) => void
}) {
    const [profile, setProfile] = useState<QualityProfile>(props.profile);
    const [profileDirty, setProfileDirty] = useState<boolean>(false);

    useEffect(() => {
        setProfile(props.profile);
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
                qualityFilters: []
            });
            props.updateProfile(JSON.parse(JSON.stringify(profile)));

            //setProfile({...profile});
            setProfileDirty(true);
        }
    }

    function deleteCategory(category: QualityCategory) {
        if (profile) {
            // update display
            profile.categories = profile.categories.filter(c => c.displayOrder != category.displayOrder);
            setProfile({...profile});

            // update parent
            props.profile.categories = props.profile.categories.filter(c => c.displayOrder != category.displayOrder);
            setProfileDirty(true);
        }
    }

    function updateShortName(shortName: string) {
        // update display
        profile.shortName = shortName;
        setProfile({...profile});

        // update parent
        props.profile.shortName = shortName
        setProfileDirty(true);
    }

    function updateName(name: string) {
        // update display
        profile.name = name;
        setProfile({...profile});

        // update parent
        props.profile.name = name
        setProfileDirty(true);
    }

    function updateDescription(description: string) {
        // update display
        profile.description = description;
        setProfile({...profile});

        // update parent
        props.profile.description = description
        setProfileDirty(true);
    }

    function updateContactName(contactName: string) {
        // update display
        profile.contactName = contactName;
        setProfile({...profile});

        // update parent
        props.profile.contactName = contactName
        setProfileDirty(true);
    }

    function updateContactEmail(contactEmail: string) {
        // update display
        profile.contactEmail = contactEmail;
        setProfile({...profile});

        // update parent
        props.profile.contactEmail = contactEmail
        setProfileDirty(true);
    }

    return <Table className="table table-sm">
        <TableTbody>
        <TableTr>
            <TableTd>Name ({profile.id})</TableTd>
            <TableTd><Textarea value={profile.name}
                               cols={50}
                       onChange={e => updateName(e.target.value)}/></TableTd>
        </TableTr>
        <TableTr>
            <TableTd>Short Name</TableTd>
            <TableTd><Textarea value={profile.shortName}
                               cols={50}
                       onChange={e => updateShortName(e.target.value)}/></TableTd>
        </TableTr>
        <TableTr>
            <TableTd>Description</TableTd>
            <TableTd>
        <Textarea value={profile.description}
                  rows={3}
                  cols={50}
                  onChange={e => updateDescription(e.target.value)}></Textarea>
            </TableTd>
        </TableTr>
        <TableTr>
            <TableTd>Contact Name</TableTd>
            <TableTd><Textarea value={profile.contactName}
                               cols={50}
                       onChange={e => updateContactName(e.target.value)}/></TableTd>
        </TableTr>
        <TableTr>
            <TableTd>Contact Email</TableTd>
            <TableTd><Textarea value={profile.contactEmail}
                               cols={50}
                       onChange={e => updateContactEmail(e.target.value)}/></TableTd>
        </TableTr>
        <TableTr>
            <TableTd colSpan={2}>
                <div className="d-flex">
                    <Button className="btn border-black btn-primary"
                        onClick={() => props.save(profile)}
                            disabled={!profileDirty}>Save
                    </Button>
                    <Button className="btn border-black ms-1"
                            onClick={() => addCategory()}>Add category
                    </Button>
                </div>
                <br/>
                <br/>
                <div className="d-flex flex-column">
                    {profile.categories.map((category, idx) => (
                        <QualityCategoryItem key={idx} category={category}
                                             parentCategory={props.profile.categories.find(it => it.displayOrder == category.displayOrder)}
                                             setProfileDirty={setProfileDirty}
                                             deleteCategory={deleteCategory}/>
                    ))}
                </div>
            </TableTd>
        </TableTr>
        </TableTbody>
    </Table>
}

export default QualityProfileItem;
