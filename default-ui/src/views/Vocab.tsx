import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
// import {Accordion} from "react-bootstrap";
import React from "react";
import { Accordion, Code, Container } from "@mantine/core";

function Vocabulary({setBreadcrumbs}: { setBreadcrumbs: (crumbs: Breadcrumb[]) => void; }) {

    const [indexString, setIndexString] = useState('');
    const [vocabs, setVocabs] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Default UI', href: '/'},
            {title: 'Vocabulary', href: '/vocab'},
        ]);
        fetchIndex();
    }, []);

    const fetchIndex = async () => {
        const indexResponse: Response = await fetch(import.meta.env.VITE_APP_VOCAB_BASE_URL + 'index.json', {
            method: 'GET'
        });

        const indexJson = await indexResponse.json()
        setIndexString(JSON.stringify(indexJson, null, 2))

        var map: { [key: string]: string } = {}
        for (let item of indexJson.categories) {
            const itemResponse: Response = await fetch(import.meta.env.VITE_APP_VOCAB_BASE_URL + item.path, {
                method: 'GET'
            })

            const itemJson = await itemResponse.json()

            map[item.name] = JSON.stringify(itemJson, null, 2)
        }
        setVocabs(map)
    }

    return (
        <>
            <Container size="lg">
                <h2>Vocabulary</h2>
                <>
                    <Accordion variant="contained" defaultValue="0">
                        <Accordion.Item key="0" value="0">
                            <Accordion.Control><span className="fw-bold">Vocab Index</span></Accordion.Control>
                            <Accordion.Panel style={{backgroundColor: 'var(--mantine-color-body)'}}>
                                <Code block  style={{backgroundColor: 'var(--mantine-color-body)'}}>{indexString}</Code>
                            </Accordion.Panel>
                        </Accordion.Item>
                        {Object.entries(vocabs).map((entry, index) =>
                            <React.Fragment key={index}>
                                <Accordion.Item key={(index + 1).toString()} value={(index + 1).toString()} >
                                    <Accordion.Control>{entry[0]}</Accordion.Control>
                                    <Accordion.Panel style={{backgroundColor: 'var(--mantine-color-body)'}}>
                                        <Code block style={{backgroundColor: 'var(--mantine-color-body)'}}>{entry[1]}</Code>
                                    </Accordion.Panel>
                                </Accordion.Item>
                            </React.Fragment>
                        )}

                    </Accordion>
                </>

            </Container>
        </>
    );
}

export default Vocabulary;
