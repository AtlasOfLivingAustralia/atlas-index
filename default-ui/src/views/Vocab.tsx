import {useEffect, useState} from "react";
import {Breadcrumb} from "../api/sources/model.ts";
import {Accordion} from "react-bootstrap";
import React from "react";

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
            <div className="container-fluid">
                <h2>Vocabulary</h2>
                <>
                    <Accordion defaultActiveKey="0">
                        <Accordion.Item key="0" eventKey="0">
                            <Accordion.Header><span className="fw-bold">Vocab Index</span></Accordion.Header>
                            <Accordion.Body>
                                <pre><small>{indexString}</small></pre>
                            </Accordion.Body>
                        </Accordion.Item>
                        {Object.entries(vocabs).map((entry, index) =>
                            <React.Fragment key={index}>
                                <Accordion.Item eventKey={(index + 1).toString()}>
                                    <Accordion.Header>{entry[0]}</Accordion.Header>
                                    <Accordion.Body>
                                        <div className="row">
                                            <div className="col">
                                                <pre><small>{entry[1]}</small></pre>
                                            </div>
                                        </div>
                                    </Accordion.Body>
                                </Accordion.Item>
                            </React.Fragment>
                        )}

                    </Accordion>
                </>

            </div>
        </>
    );
}

export default Vocabulary;
