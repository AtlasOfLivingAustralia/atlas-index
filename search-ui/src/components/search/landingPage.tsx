/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {useNavigate} from "react-router-dom";
import {RenderItemElements, RenderItemParams} from "../../api/sources/model.ts";
import featuredPages from '../../config/featuredPages.json';
import classes from "./search.module.css";
import {renderGenericTileItemFn, TileImage} from "./util.tsx";

function LandingPage({isMobile}: { isMobile: boolean }) {

    const navigate = useNavigate();

    function renderTileItemFn({item, isMobile}: RenderItemParams){
        const elements: RenderItemElements = {
            image: <TileImage image={item.imageUrl} fit={'cover'} isMobile={isMobile}/>,
            title: <>
                <span className={classes.listItemName} style={{marginBottom: '8px'}}>
                    {item.title}
                </span>
                {item.description && (
                    <span style={{marginTop: '13px'}} className={classes.listDescription} title={item.description}>
                        {item.description}
                    </span>
                )}
            </>,
            url: item.url
        };
        return renderGenericTileItemFn(isMobile, elements);
    };

    return <div style={{maxWidth: '1200px', marginLeft: 'auto', marginRight: 'auto', marginTop: (isMobile ? '20px' : '120px')}} >
        <div style={{fontFamily: 'Roboto', fontWeight: '600', fontSize: '26px', lineHeight: '32px', color: '#C44D34', textAlign: (isMobile ? 'left' : 'center')}}>
            Featured pages</div>
        <div className="row" style={{marginTop: '30px'}}>
            {featuredPages && featuredPages.map((item: any, index: number) => (
                <div className={isMobile ? 'col-12' : 'col-3'} key={index}
                     style={{
                         paddingLeft: '20px',
                         paddingRight: '20px',
                         marginBottom: isMobile ? '15px' : '30px'
                     }}>
                    {renderTileItemFn({item, navigate, wide: true, isMobile})}
                </div>
            ))}
        </div>
    </div>;
}

export default LandingPage;
