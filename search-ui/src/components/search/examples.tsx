/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState} from "react";
import examplesJson from "../../config/examples.json";

// Example structure in examples.json
// type ExampleGroup = {
//     tab: string;
//     examples: { label: string; query: string;}[];
// };

type ExampleProps = {
    tab: string;
    setQueryAndTab: (query: string, tab: string | undefined) => void;
};

export function Examples({tab, setQueryAndTab}: ExampleProps): React.ReactElement {
    const [examples, setExamples] = useState<{ label: string; query: string; tab?: string }[]>([]);

    useEffect(() => {
        const maxExamplesPerGroup = tab ? 20 : 1;
        var list: any [] = [];
        examplesJson.forEach(group => {
            if (!tab || group.tab === tab) {
                // extract maxExamplesPerGroup random examples from this group, and add them to the list
                const shuffledExamples = group.examples.sort(() => 0.5 - Math.random());
                const selectedExamples : {label: string; query: string, tab?: string}[] = shuffledExamples.slice(0, maxExamplesPerGroup);
                // set the tab value for each example
                selectedExamples.forEach(example => {
                    example.tab = group.tab;
                });
                list.push(...selectedExamples);
            }
        });
        setExamples(list);
    }, []);

    return (
        <div style={{maxWidth: 600, margin: "30px auto 0 auto", textAlign: "center"}}>
            <p>
                Use the search bar above to find species, datasets, species lists, data projects, spatial
                layers,
                locations, general content and help articles.
            </p>
            <br/>
            <h4>Examples</h4>
            <div>
                <ul style={{
                    margin: "auto",
                    maxWidth: 400,
                    textAlign: "center",
                    paddingLeft: 0,
                    listStyle: "none"
                }}>
                    {examples && examples.map((example, i) =>
                        <li key={i} style={{marginBottom: 4}}>
                            <a
                                onClick={() => setQueryAndTab(example.query, example.tab)}
                                style={{textDecoration: "underline", color: "#212121", cursor: "pointer"}}
                            >
                                {example.label}
                            </a>
                        </li>
                    )}
                </ul>
            </div>
        </div>
    );
}
