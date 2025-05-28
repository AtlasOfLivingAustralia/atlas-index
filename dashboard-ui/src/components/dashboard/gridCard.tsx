/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

type GridCardProps = {
    headerNum?: string | number;
    header: React.ReactNode;
    children: React.ReactNode;
};

const GridCard = ({headerNum, header, children}: GridCardProps) => {
    return (
        <div className='dashboardPanel card'>
            <div className={'dashboardPanelHeader card-header'}>
                <h1 className="dashboardH1">{headerNum} {header}</h1>
            </div>
            <div className={"dashboardPanelBody card-body"}>
                {children}
            </div>
        </div>
    )
}

export default GridCard;
