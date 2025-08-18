/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight'
import {FontAwesomeIconLite} from "../index.ts";

interface Breadcrumb {
    title: string | React.ReactNode;
    href: string | undefined | null;
}

const Breadcrumbs = ({breadcrumbs}: { breadcrumbs: Breadcrumb[] }) => {
    const breadcrumbItems = breadcrumbs.map((breadcrumb: Breadcrumb, index: number) => {
        return <li className="breadcrumb-item" key={index}>
            {index > 0 && <FontAwesomeIconLite icon={faChevronRight} className={"breadcrumb-icon"}/>}
            {index < breadcrumbs.length - 1 && breadcrumb.href ?
                // Cannot use react-router-dom Link here. It does work with dev mode, but not the build.
                <a href={breadcrumb.href}>{breadcrumb.title}</a>
                : <>{breadcrumb.title}</>
            }
        </li>;
    });

    return <section id="breadcrumb">
        <div className="container-fluid">
            <div className="row">
                <nav aria-label="Breadcrumb" role="navigation">
                    <ol className="breadcrumb-list breadcrumb">
                        {breadcrumbItems}
                    </ol>
                </nav>
            </div>
        </div>
    </section>
}

export default Breadcrumbs;
export type {Breadcrumb};
