/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import React, {useEffect, useState} from 'react';
import examplesJson from '../../config/examples.json';

// Example structure in examples.json
// type ExampleGroup = {
//     tab: string;
//     examples: { label: string; query: string;}[];
// };

type ExampleProps = {
    asText: boolean;
    tab: string;
    setQueryAndTab: (query: string, tab: string | undefined) => void;
};

export function Examples({asText, tab, setQueryAndTab}: ExampleProps): React.ReactElement {
    const [examples, setExamples] = useState<{ label: string; query: string; tab?: string }[]>([]);

    useEffect(() => {
        const maxExamplesPerGroup = tab ? 20 : 1;
        var list: any[] = [];
        examplesJson.forEach((group) => {
            if (!tab || tab == 'all' || group.tab === tab || true) { // always include examples from all tabs
                // extract maxExamplesPerGroup random examples from this group, and add them to the list
                const shuffledExamples = group.examples.sort(() => 0.5 - Math.random());
                const selectedExamples: {
                    label: string;
                    query: string;
                    tab?: string;
                }[] = shuffledExamples.slice(0, maxExamplesPerGroup);
                // set the tab value for each example
                selectedExamples.forEach((example) => {
                    example.tab = group.tab;
                });
                list.push(...selectedExamples);
            }
        });
        // shuffle the final list
        list = list.sort(() => 0.5 - Math.random());
        // get top 5
        list = list.slice(0,5);
        // sort by query
        list.sort((a, b) => a.query.localeCompare(b.query));
        setExamples(list);
    }, []);

    return <>
        {examples && examples.map((example, i) => (
            <React.Fragment key={i}>
                {asText ? (
                    <>
                        <a onClick={() => setQueryAndTab(example.query, example.tab)}
                           style={{textDecoration: 'underline', color: '#212121', cursor: 'pointer'}}>
                            {example.query}
                        </a>
                        {i < examples.length - 1 && <>,&nbsp;</>}
                    </>
                ) : (
                    <a onClick={() => setQueryAndTab(example.query, example.tab)}
                       className={"btn btn-primary btn-sm me-2 mb-2"}
                       style={{cursor: 'pointer'}}>
                        {example.query}
                    </a>
                )}
            </React.Fragment>
        ))}
    </>
}
