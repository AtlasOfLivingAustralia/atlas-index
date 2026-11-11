/*
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import {Breadcrumb, useUser} from '@ala/common-ui';
import {useEffect, useState} from 'react';
import {Button, Form, Modal, Tab, Tabs} from 'react-bootstrap';
import {Link, useNavigate, useParams} from 'react-router-dom';
import ImageViewer, {type ImageRectangle} from '../components/imageViewer.tsx';
import {imageApi, tagApi} from '../api/endpoints.ts';
import {ApiError} from '../api/client.ts';
import type {ImageDetail as ImageDetailType, MetadataEntry} from '../api/types.ts';
import {canEdit, isAdmin} from '../config/roles.ts';
import './ImageDetail.css';

function MetadataTable({entries, onRemove, removeDisabled}: { entries: MetadataEntry[]; onRemove?: (key: string) => void; removeDisabled?: boolean }) {
    if (entries.length === 0) return <div className="text-muted">No entries.</div>;
    return (
        <table className="table table-sm table-striped">
            <tbody>
            {entries.map(e => (
                <tr key={e.key}>
                    <th style={{width: '30%'}}>{e.key}</th>
                    <td>{e.value}</td>
                    {onRemove && (
                        <td style={{width: 1}}>
                            <button
                                type="button"
                                className="btn-close btn-sm"
                                aria-label={`Remove metadata ${e.key}`}
                                disabled={removeDisabled}
                                onClick={() => onRemove(e.key)}
                            />
                        </td>
                    )}
                </tr>
            ))}
            </tbody>
        </table>
    );
}

export default function ImageDetail({setBreadcrumbs}: {
    setBreadcrumbs: (crumbs: Breadcrumb[]) => void;
}) {
    const {imageId} = useParams<{ imageId: string }>();
    const navigate = useNavigate();
    const {userInfo} = useUser();
    const apiUrl = import.meta.env.VITE_APP_API_URL;

    const [image, setImage] = useState<ImageDetailType | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<ApiError | null>(null);

    const [newTag, setNewTag] = useState('');
    const [newMetaKey, setNewMetaKey] = useState('');
    const [newMetaValue, setNewMetaValue] = useState('');
    const [actionError, setActionError] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [pendingSubimage, setPendingSubimage] = useState<ImageRectangle | null>(null);
    const [subimageDescription, setSubimageDescription] = useState('');

    function load(signal?: AbortSignal) {
        if (!imageId) return;
        setLoading(true);
        setError(null);
        imageApi
            .getDetail(apiUrl, imageId, signal)
            .then(setImage)
            .catch((err: ApiError) => {
                if (err?.name === 'AbortError') return;
                setError(err);
            })
            // React StrictMode aborts the first development request before
            // immediately starting the real one. Do not let that stale
            // request clear the loading state and briefly render an empty
            // detail page while the active request is still in flight.
            .finally(() => {
                if (!signal?.aborted) setLoading(false);
            });
    }

    useEffect(() => {
        const controller = new AbortController();
        load(controller.signal);
        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiUrl, imageId]);

    useEffect(() => {
        setBreadcrumbs([
            {title: 'Home', href: import.meta.env.VITE_HOME_URL},
            {title: 'Images', href: '/'},
            {title: image?.title || image?.originalFilename || imageId || 'Image', href: '#'}
        ]);
    }, [image, imageId]);

    async function runAction(action: () => Promise<ImageDetailType>) {
        setBusy(true);
        setActionError(null);
        try {
            const updated = await action();
            setImage(updated);
            return true;
        } catch (err) {
            setActionError((err as ApiError)?.message ?? 'Action failed');
            return false;
        } finally {
            setBusy(false);
        }
    }

    if (loading) {
        return <div className="d-flex mt-5"><div className="spinner-border ms-auto me-auto" data-testid="image-detail-loading"/></div>;
    }

    if (error) {
        if (error.isUnauthorized) {
            return <div className="alert alert-warning" data-testid="image-detail-unauthorized">You do not have permission to view this image.</div>;
        }
        if (error.status === 404) {
            return <div className="alert alert-secondary" data-testid="image-detail-not-found">Image not found.</div>;
        }
        return <div className="alert alert-danger" data-testid="image-detail-error">{error.message}</div>;
    }

    if (!image) {
        return <div className="alert alert-secondary">No image data available.</div>;
    }

    const canModify = canEdit(userInfo) && !image.deleted;
    /**
     * Creating a brand-new tag requires the admin-gated
     * `POST /api/v2/admin/tags` endpoint, so only admins can add a tag that
     * doesn't already exist. Detaching an already-attached tag only needs
     * its known id (no lookup/creation involved), so that stays gated on
     * `canModify` instead.
     */
    const canCreateTags = isAdmin(userInfo) && !image.deleted;
    const currentImageId = image.imageId;

    function deleteCurrentImage() {
        if (!window.confirm('Delete this image? This cannot be undone.')) return;
        setBusy(true);
        imageApi
            .deleteImage(apiUrl, currentImageId)
            .then(() => navigate('/'))
            .catch(err => setActionError((err as ApiError)?.message ?? 'Delete failed'))
            .finally(() => setBusy(false));
    }

    return (
        <div className="container-fluid image-detail" data-testid="image-detail">
            <div className="image-detail__layout">
                <main className="image-detail__viewer-column">
                    <div className="image-detail__viewer-shell">
                    {image.isImage ? (
                        <ImageViewer
                            apiUrl={apiUrl}
                            imageId={image.imageId}
                            width={image.width}
                            height={image.height}
                            tileZoomLevels={image.tileZoomLevels}
                            downloadUrl={image.originalUrl}
                            busy={busy}
                            onCreateSubimage={canModify ? setPendingSubimage : undefined}
                        />
                    ) : image.isAudio ? (
                        <audio controls src={image.imageUrl} style={{width: '100%'}} data-testid="audio-player"/>
                    ) : image.isDocument ? (
                        <div className="alert alert-light border" data-testid="document-preview">
                            Document preview is not embeddable. <a href={image.originalUrl} target="_blank" rel="noreferrer">Open the original document</a>.
                        </div>
                    ) : (
                        <img src={image.imageUrl} alt={image.title} style={{maxWidth: '100%'}}/>
                    )}
                    </div>

                    {image.parentImageId && (
                        <section className="image-detail__parent" data-testid="parent-image-section">
                            <div className="image-detail__section-heading">
                                <div>
                                    <h2>Parent image</h2>
                                    <p>This image was created from a region of the image below</p>
                                </div>
                                <i className="bi bi-diagram-2" aria-hidden="true"/>
                            </div>
                            <Link className="image-detail__parent-link" to={`/image/${encodeURIComponent(image.parentImageId)}`}>
                                <img src={image.parentImageThumbnailUrl} alt={`Parent image ${image.parentImageTitle || image.parentImageId}`}/>
                                <span>
                                    <strong>{image.parentImageTitle || 'Parent image'}</strong>
                                    <small>{image.parentImageId}</small>
                                </span>
                                <i className="bi bi-arrow-right" aria-hidden="true"/>
                            </Link>
                        </section>
                    )}

                    <section className="image-detail__subimages" data-testid="subimages-section">
                        <div className="image-detail__section-heading">
                            <div>
                                <h2>Sub-images</h2>
                                <p>Regions created from this image</p>
                            </div>
                            <span className="image-detail__count">{image.subimages.length}</span>
                        </div>
                        {image.subimages.length > 0 ? (
                            <div className="image-detail__subimage-grid">
                                {image.subimages.map(si => (
                                    <Link key={si.imageId} className="image-detail__subimage" to={`/image/${encodeURIComponent(si.imageId)}`}>
                                        <img src={si.thumbnailUrl} alt={`Sub-image ${si.imageId}`}/>
                                        <span>{si.imageId}</span>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="image-detail__empty-subimages">
                                <i className="bi bi-bounding-box" aria-hidden="true"/>
                                <span>No sub-images have been created from this image.</span>
                            </div>
                        )}
                    </section>
                </main>

                <aside className="image-detail__info" aria-label="Image information">
                    <div className="image-detail__info-header">
                        <div className="image-detail__eyebrow">Image details</div>
                        <h1>{image.title || image.originalFilename || image.imageId}</h1>
                        {image.originalFilename && image.title !== image.originalFilename && <div className="image-detail__filename">{image.originalFilename}</div>}
                    </div>

                    <div className="mb-2">
                        <strong>Tags</strong>
                        <div className="d-flex flex-wrap gap-1 mt-1" data-testid="tag-list">
                            {image.tags.length === 0 && <span className="text-muted">No tags.</span>}
                            {image.tags.map(tag => (
                                <span key={tag.id} className="badge bg-secondary d-flex align-items-center gap-1">
                                    {tag.path}
                                    {canModify && (
                                        <button
                                            type="button"
                                            className="btn-close btn-close-white btn-sm"
                                            aria-label={`Remove tag ${tag.path}`}
                                            disabled={busy}
                                            onClick={() => runAction(() => imageApi.detachTag(apiUrl, image.imageId, tag.id))}
                                        />
                                    )}
                                </span>
                            ))}
                        </div>
                        {canCreateTags && (
                            <Form
                                className="d-flex gap-2 mt-2"
                                onSubmit={e => {
                                    e.preventDefault();
                                    if (!newTag) return;
                                    runAction(async () => {
                                        const {tag} = await tagApi.create(apiUrl, newTag);
                                        return imageApi.attachTag(apiUrl, image.imageId, tag.id);
                                    }).then(() => setNewTag(''));
                                }}
                            >
                                <Form.Control size="sm" placeholder="Add tag (e.g. Botany/Leaf)" value={newTag} onChange={e => setNewTag(e.target.value)} data-testid="add-tag-input"/>
                                <Button size="sm" type="submit" disabled={busy || !newTag}>Add</Button>
                            </Form>
                        )}
                    </div>

                    {canModify && (
                        <div className="mb-3">
                            <Button
                                size="sm"
                                variant="outline-danger"
                                disabled={busy}
                                onClick={deleteCurrentImage}
                                data-testid="delete-image"
                            >
                                Delete image
                            </Button>
                        </div>
                    )}

                    {isAdmin(userInfo) && !image.deleted && (
                        <div className="mb-3">
                            <strong>Admin actions</strong>
                            <div className="d-flex flex-wrap gap-2 mt-1">
                                <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    disabled={busy}
                                    onClick={() => runAction(() => imageApi.regenerateDerivatives(apiUrl, image.imageId).then(() => imageApi.getDetail(apiUrl, image.imageId)))}
                                    data-testid="regenerate-derivatives"
                                >
                                    Regenerate derivatives
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    disabled={busy}
                                    onClick={() => runAction(() => imageApi.resetTiles(apiUrl, image.imageId).then(() => imageApi.getDetail(apiUrl, image.imageId)))}
                                    data-testid="reset-tiles"
                                >
                                    Reset tiles
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline-secondary"
                                    disabled={busy}
                                    onClick={() => runAction(() => imageApi.setHarvestable(apiUrl, image.imageId, !image.harvestable))}
                                    data-testid="toggle-harvestable"
                                >
                                    {image.harvestable ? 'Mark not harvestable' : 'Mark harvestable'}
                                </Button>
                            </div>
                        </div>
                    )}

                    {actionError && <div className="alert alert-danger py-1 px-2" data-testid="action-error">{actionError}</div>}

                    <Tabs id="metadata-tabs" defaultActiveKey="core" className="mb-2">
                        <Tab eventKey="core" title="Core">
                            <MetadataTable entries={image.coreMetadata}/>
                        </Tab>
                        <Tab eventKey="system" title="System">
                            <MetadataTable entries={image.systemMetadata}/>
                        </Tab>
                        <Tab eventKey="embedded" title="Embedded">
                            <MetadataTable entries={image.embeddedMetadata}/>
                        </Tab>
                        <Tab eventKey="user" title="User">
                            <MetadataTable
                                entries={image.userMetadata}
                                onRemove={canModify ? key => runAction(() => imageApi.removeMetadataKey(apiUrl, image.imageId, key)) : undefined}
                                removeDisabled={busy}
                            />
                            {canModify && (
                                <Form
                                    className="d-flex gap-2 mt-2"
                                    onSubmit={e => {
                                        e.preventDefault();
                                        if (!newMetaKey) return;
                                        runAction(() => imageApi.updateMetadata(apiUrl, image.imageId, {[newMetaKey]: newMetaValue})).then(() => {
                                            setNewMetaKey('');
                                            setNewMetaValue('');
                                        });
                                    }}
                                >
                                    <Form.Control size="sm" placeholder="Key" value={newMetaKey} onChange={e => setNewMetaKey(e.target.value)}/>
                                    <Form.Control size="sm" placeholder="Value" value={newMetaValue} onChange={e => setNewMetaValue(e.target.value)}/>
                                    <Button size="sm" type="submit" disabled={busy || !newMetaKey}>Add</Button>
                                </Form>
                            )}
                        </Tab>
                        <Tab eventKey="dataResource" title="Data resource">
                            <MetadataTable entries={image.dataResourceMetadata}/>
                        </Tab>
                    </Tabs>
                </aside>
            </div>

            <Modal show={pendingSubimage !== null} onHide={() => !busy && setPendingSubimage(null)} centered aria-labelledby="create-subimage-title">
                <Form onSubmit={event => {
                                event.preventDefault();
                                if (!pendingSubimage) return;
                                const rect = pendingSubimage;
                                runAction(() => imageApi.createSubimage(apiUrl, image.imageId, rect, subimageDescription))
                                    .then(success => {
                                        if (!success) return;
                                        setPendingSubimage(null);
                                        setSubimageDescription('');
                                    });
                            }}>
                    <Modal.Header closeButton closeVariant="white">
                        <Modal.Title id="create-subimage-title">Create sub-image</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Form.Label htmlFor="subimage-description">Description</Form.Label>
                        <Form.Control id="subimage-description" value={subimageDescription} onChange={event => setSubimageDescription(event.target.value)} autoFocus/>
                    </Modal.Body>
                    <Modal.Footer>
                        <Button variant="outline-secondary" type="button" disabled={busy} onClick={() => setPendingSubimage(null)}>Cancel</Button>
                        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create sub-image'}</Button>
                    </Modal.Footer>
                </Form>
            </Modal>
        </div>
    );
}
