import React from 'react';
import {Accordion, Container, useMantineTheme} from '@mantine/core';
import MapView from "../species/mapView.tsx";
import ClassificationView from "../species/classificationView.tsx";
import DescriptionView from "../species/descriptionView.tsx";
import ImagesView from "../species/imagesView.tsx";
import NamesView from "../species/namesView.tsx";
import StatusView from "../species/statusView.tsx";
import TraitsView from "../species/traitsView.tsx";
import DatasetsView from "../species/datasetsView.tsx";
import ResourcesView from "../species/resourcesView.tsx";

function SpeciesDetailsAccordion({data, descriptions}) {

    const panels = [
         { id: 'map', title: 'Occurrence Map', component: <MapView result={data} /> },
         { id: 'classification', title: 'Classification', component: <ClassificationView result={data}/> },
         { id: 'description', title: 'Descriptions', component: <DescriptionView descriptions={descriptions}/> },
         { id: 'images', title: 'Images and sounds', component: <ImagesView result={data}/> },
         { id: 'names', title: 'Names', component: <NamesView result={data}/> },
         { id: 'status', title: 'Status', component: <StatusView result={data}/> },
         { id: 'traits', title: 'Traits', component: <TraitsView result={data}/> },
         { id: 'datasets', title: 'Datasets', component: <DatasetsView result={data}/> },
         // { id: 'resources', title: 'Resources', component: <ResourcesView result={data}/> }
    ];

    return (
            <Accordion
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

export default SpeciesDetailsAccordion;
