/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useEffect, useState} from 'react';

enum Severity {
    INFO = "INFO",
    WARNING = "WARNING",
    DANGER = "DANGER"
}

interface Messages {
    [key: string]: {
        message: string; // HTML string
        severity: Severity;
        updated: string; // ISO 8601 date string, e.g. 2024-03-04T00:00+10:00
        closable?: boolean; // default: false
    };
}

function isoToLong(isoString: string): number {
    return new Date(isoString).getTime();
}

const BANNER_LAST_CLOSED_STORAGE_KEY_PREFIX = 'bannerLastClosed_';

/**
 * Banner component to display messages from an external source.
 * - fetches the messages from VITE_BANNER_MESSAGES_URL, if present
 * - displays the "global" and VITE_BANNER_SCOPE messages, if present
 * - applies style depending on severity; DANGER, WARNING, INFO
 * - optional (closable: true) allows user to close a message and for this to persist
 *
 * @constructor
 */
const Banner = () => {
    const [messages, setMessages] = useState<Messages>();

    if (!import.meta.env.VITE_BANNER_MESSAGES_URL) {
        return <></>;
    }

    useEffect(() => {
        fetch(import.meta.env.VITE_BANNER_MESSAGES_URL)
            .then(response => response.json())
            .then(data => {
                // filter out messages that are not for the current scope
                let typedData: Messages = data;
                const filtered = Object.fromEntries(
                    Object.entries(typedData).filter(([key, value]) => {
                        return (key === 'global' || key === import.meta.env.VITE_BANNER_SCOPE) &&
                            value.message.length > 0 && getLastClosed(key) < isoToLong(value.updated);
                    })
                );

                setMessages(filtered);
            });
    }, []);

    function close(scope: string) {
        const now = new Date();
        localStorage.setItem(BANNER_LAST_CLOSED_STORAGE_KEY_PREFIX + scope, now.toISOString());

        // remove this scope from messages
        const updatedMessages = {...messages};
        delete updatedMessages[scope];
        setMessages(updatedMessages);
    }

    function getLastClosed(scope: string): number {
        const lastClosed = localStorage.getItem(BANNER_LAST_CLOSED_STORAGE_KEY_PREFIX + scope);
        return lastClosed ? isoToLong(lastClosed) : 0;
    }

    return <>
        {messages && Object.entries(messages).map(([key, value]) => (
            <div key={key} className={`alert alert-${value.severity.toLowerCase()}`}
                 style={{position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                <div style={{textAlign: 'center'}} dangerouslySetInnerHTML={{__html: value.message}}/>
                {value.closable &&
                    <button onClick={() => close(key)}
                            style={{
                                position: 'absolute',
                                top: '0',
                                right: '0',
                                background: 'none',
                                border: 'none',
                                fontSize: '1.2em',
                                margin: '0.8em'
                            }}
                            aria-label="Close" title="Dismiss message">
                        &times;
                    </button>
                }
            </div>
        ))}
    </>
}

export default Banner;
