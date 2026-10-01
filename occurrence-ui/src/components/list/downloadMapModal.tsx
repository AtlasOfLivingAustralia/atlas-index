/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useState } from 'react';
import Modal from 'react-bootstrap/Modal';
import { FormattedMessage } from 'react-intl';
import L from 'leaflet';

interface BaseLayerOption {
    value: string;       // e.g. "baselayer.world"
    displayName: string; // e.g. "Simple World Outline"
}

// VITE_MAP_DOWNLOAD_BASE_LAYERS must be a JSON array of { value, displayName }.
// Use value prefixes "baseMap." for basemaps, and "baseLayer." for base layers.
// e.g. [{"value":"baseMap.world","displayName":"Simple World Outline"},{"value":"baseLayer.aus1","displayName":"States & territories"}]
const BASE_LAYER_OPTIONS: BaseLayerOption[] = JSON.parse(import.meta.env.VITE_MAP_DOWNLOAD_BASE_LAYERS);

interface DownloadMapModalProps {
    onClose: () => void;
    queryString: string | undefined;
    mapRef: React.MutableRefObject<L.Map | null>;
}

function DownloadMapModal({ onClose, queryString, mapRef }: DownloadMapModalProps) {

    const [format, setFormat] = useState('jpg');
    const [dpi, setDpi] = useState('300');
    const [pradiusmm, setPradiusmm] = useState('0.7');
    const [popacity, setPopacity] = useState('0.7');
    const [pcolour, setPcolour] = useState('#0D00FB');
    const [widthmm, setWidthmm] = useState('150');
    const [scale, setScale] = useState('on');
    const [outline, setOutline] = useState('true');
    const [baseLayer, setBaseLayer] = useState(BASE_LAYER_OPTIONS[0]?.value ?? 'baselayer.world');
    const [fileName, setFileName] = useState('MyMap');

    function download() {
        const map = mapRef.current;
        if (!map) return;

        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const extents = `${sw.lng},${sw.lat},${ne.lng},${ne.lat}`;

        const baseQs = (queryString ?? '').replace(/^[?]/, '');

        const url = new URL(`${import.meta.env.VITE_APP_BIOCACHE_URL}/webportal/wms/image`);
        if (baseQs) {
            baseQs.split('&').forEach(part => {
                const eqIdx = part.indexOf('=');
                if (eqIdx === -1) return;
                const k = decodeURIComponent(part.substring(0, eqIdx));
                const v = decodeURIComponent(part.substring(eqIdx + 1));
                if (k) url.searchParams.append(k, v);
            });
        }
        url.searchParams.set('extents', extents);
        url.searchParams.set('format', format);
        url.searchParams.set('dpi', dpi);
        url.searchParams.set('pradiusmm', pradiusmm);
        url.searchParams.set('popacity', popacity);
        url.searchParams.set('pcolour', pcolour.replace('#', '').toUpperCase());
        url.searchParams.set('widthmm', widthmm);
        url.searchParams.set('scale', scale);
        url.searchParams.set('outline', outline);
        url.searchParams.set('outlineColour', '0x000000');

        // Always set both baselayer and baseMap (one will be empty, matching the working URL format)
        if (baseLayer.startsWith('baseMap.')) {
            url.searchParams.set('baseMap', baseLayer.substring(8));
            url.searchParams.set('baseLayer', '');
        } else {
            url.searchParams.set('baseLayer', baseLayer.startsWith('baselayer.') ? baseLayer.substring(10) : baseLayer);
            url.searchParams.set('baseMap', '');
        }

        url.searchParams.set('fileName', `${fileName}.${format.toLowerCase()}`);

        onClose();
        // URLSearchParams encodes spaces as '+' but the biocache service expects '%20'.
        window.open(url.toString().replace(/\+/g, '%20'), '_blank');
    }

    const pointRadiusOptions = ['0.1','0.2','0.3','0.4','0.5','0.6','0.7','0.8','0.9', '1','2','3','4','5','6','7','8','9','10'];
    const opacityOptions = ['1','0.9','0.8','0.7','0.6','0.5','0.4','0.3','0.2','0.1'];

    return (
        <Modal show={true} onHide={onClose}>
            <Modal.Header closeButton>
                <Modal.Title>
                    <FormattedMessage id='map.downloadmap.title' defaultMessage='Download map as image file' />
                </Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-format'>
                        <FormattedMessage id='map.downloadmap.field01.label' defaultMessage='Format' />
                    </label>
                    <div className='col-md-6'>
                        <select id='dm-format' className='form-select' value={format} onChange={e => setFormat(e.target.value)}>
                            <option value='jpg'><FormattedMessage id='map.downloadmap.field01.option01' defaultMessage='JPEG' /></option>
                            <option value='png'><FormattedMessage id='map.downloadmap.field01.option02' defaultMessage='PNG' /></option>
                        </select>
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-dpi'>
                        <FormattedMessage id='map.downloadmap.field02.label' defaultMessage='Quality (DPI)' />
                    </label>
                    <div className='col-md-6'>
                        <select id='dm-dpi' className='form-select' value={dpi} onChange={e => setDpi(e.target.value)}>
                            <option value='100'>100</option>
                            <option value='300'>300</option>
                            <option value='600'>600</option>
                        </select>
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-pradiusmm'>
                        <FormattedMessage id='map.downloadmap.field03.label' defaultMessage='Point radius (mm)' />
                    </label>
                    <div className='col-md-6'>
                        <select id='dm-pradiusmm' className='form-select' value={pradiusmm} onChange={e => setPradiusmm(e.target.value)}>
                            {pointRadiusOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-popacity'>
                        <FormattedMessage id='map.downloadmap.field04.label' defaultMessage='Opacity' />
                    </label>
                    <div className='col-md-6'>
                        <select id='dm-popacity' className='form-select' value={popacity} onChange={e => setPopacity(e.target.value)}>
                            {opacityOptions.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-pcolour'>
                        <FormattedMessage id='map.downloadmap.field05.label' defaultMessage='Color' />
                    </label>
                    <div className='col-md-6'>
                        <input type='color' id='dm-pcolour' className='form-control form-control-color'
                               value={pcolour} onChange={e => setPcolour(e.target.value)} />
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-widthmm'>
                        <FormattedMessage id='map.downloadmap.field06.label' defaultMessage='Width (mm)' />
                    </label>
                    <div className='col-md-6'>
                        <input type='text' id='dm-widthmm' className='form-control'
                               value={widthmm} onChange={e => setWidthmm(e.target.value)} />
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end'>
                        <FormattedMessage id='map.downloadmap.field07.label' defaultMessage='Include scale' />
                    </label>
                    <div className='col-md-6'>
                        <div className='form-check form-check-inline'>
                            <input type='radio' className='form-check-input' id='dm-scale-on' name='dm-scale'
                                   value='on' checked={scale === 'on'} onChange={() => setScale('on')} />
                            <label className='form-check-label' htmlFor='dm-scale-on'>
                                <FormattedMessage id='map.downloadmap.field07.option01' defaultMessage='Yes' />
                            </label>
                        </div>
                        <div className='form-check form-check-inline'>
                            <input type='radio' className='form-check-input' id='dm-scale-off' name='dm-scale'
                                   value='off' checked={scale === 'off'} onChange={() => setScale('off')} />
                            <label className='form-check-label' htmlFor='dm-scale-off'>
                                <FormattedMessage id='map.downloadmap.field07.option02' defaultMessage='No' />
                            </label>
                        </div>
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end'>
                        <FormattedMessage id='map.downloadmap.field08.label' defaultMessage='Outline points' />
                    </label>
                    <div className='col-md-6'>
                        <div className='form-check form-check-inline'>
                            <input type='radio' className='form-check-input' id='dm-outline-yes' name='dm-outline'
                                   value='true' checked={outline === 'true'} onChange={() => setOutline('true')} />
                            <label className='form-check-label' htmlFor='dm-outline-yes'>
                                <FormattedMessage id='map.downloadmap.field08.option01' defaultMessage='Yes' />
                            </label>
                        </div>
                        <div className='form-check form-check-inline'>
                            <input type='radio' className='form-check-input' id='dm-outline-no' name='dm-outline'
                                   value='false' checked={outline === 'false'} onChange={() => setOutline('false')} />
                            <label className='form-check-label' htmlFor='dm-outline-no'>
                                <FormattedMessage id='map.downloadmap.field08.option02' defaultMessage='No' />
                            </label>
                        </div>
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-baseLayer'>
                        <FormattedMessage id='map.downloadmap.field09.label' defaultMessage='Base layer' />
                    </label>
                    <div className='col-md-6'>
                        <select id='dm-baseLayer' className='form-select' value={baseLayer} onChange={e => setBaseLayer(e.target.value)}>
                            {BASE_LAYER_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.displayName}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className='mb-3 row align-items-center'>
                    <label className='col-md-5 control-label text-end' htmlFor='dm-fileName'>
                        <FormattedMessage id='map.downloadmap.field10.label' defaultMessage='File name (without extension)' />
                    </label>
                    <div className='col-md-6'>
                        <input type='text' id='dm-fileName' className='form-control'
                               value={fileName} onChange={e => setFileName(e.target.value)} />
                    </div>
                </div>
            </Modal.Body>
            <Modal.Footer>
                <button className='btn btn-outline-dark' onClick={onClose}>
                    <FormattedMessage id='map.downloadmap.button02.label' defaultMessage='Close' />
                </button>
                <button className='btn btn-primary' onClick={download}>
                    <FormattedMessage id='map.downloadmap.button01.label' defaultMessage='Download map' />
                </button>
            </Modal.Footer>
        </Modal>
    );
}

export default DownloadMapModal;

