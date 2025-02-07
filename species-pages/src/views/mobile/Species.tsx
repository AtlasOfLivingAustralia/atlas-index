import React from 'react';
import classes from '../search.module.css'
import {Accordion} from '@mantine/core';
import MapView from "../../components/species/mapView.tsx";
import ClassificationView from "../../components/species/classificationView.tsx";
import DescriptionView from "../../components/species/descriptionView.tsx";
import ImagesView from "../../components/species/imagesView.tsx";
import NamesView from "../../components/species/namesView.tsx";
import StatusView from "../../components/species/statusView.tsx";
import TraitsView from "../../components/species/traitsView.tsx";
import DatasetsView from "../../components/species/datasetsView.tsx";
import ResourcesView from "../../components/species/resourcesView.tsx";

function Species({ data, descriptions }: { data: any; descriptions: any }) {

    const panels = [
         { id: 'map', title: 'Occurrence Map', component: <MapView result={data} /> },
         { id: 'classification', title: 'Classification', component: <ClassificationView result={data}/> },
         { id: 'description', title: 'Descriptions', component: <DescriptionView descriptions={descriptions}/> },
         { id: 'images', title: 'Images and sounds', component: <ImagesView result={data}/> },
         { id: 'names', title: 'Names', component: <NamesView result={data}/> },
         { id: 'status', title: 'Status', component: <StatusView result={data}/> },
         { id: 'traits', title: 'Traits', component: <TraitsView result={data}/> },
         { id: 'datasets', title: 'Datasets', component: <DatasetsView result={data}/> },
         { id: 'resources', title: 'Resources', component: <ResourcesView result={data}/> }
    ];

    return (
            <Accordion
                className={classes.mobile}
                multiple // Optional: Allow multiple panels to be open at once
                chevronPosition="left" // Chevron on the left for better UX
                //defaultValue={"map"}
            >
                {panels.map((panel) => (
                    <Accordion.Item value={panel.id} key={panel.id}>
                        <Accordion.Control>
                                {panel.title}
                            </Accordion.Control>
                        <Accordion.Panel>{panel.component}</Accordion.Panel>
                    </Accordion.Item>
                ))}
            </Accordion>
    );
}

export default Species;
