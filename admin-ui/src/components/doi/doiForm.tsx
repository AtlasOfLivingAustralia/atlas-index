import {useEffect, useState} from 'react';
import { Form, Button } from 'react-bootstrap';
import {useAuth} from "react-oidc-context";


interface DoiFormProps {
    onSubmit: (values: {
        title: string;
        authors: string;
        description: string;
        licence: string;
        applicationUrl: string;
        customLandingPageUrl: string;
        applicationMetadata: string;
        fileUrl: string;
        uploadedFile: File | null;
        providerMetadata: string;
        userId: string;
    }) => void;
}


function DoiForm({ onSubmit }: DoiFormProps) {
    const [title, setTitle] = useState('');
    const [authors, setAuthors] = useState('');
    const [description, setDescription] = useState('');
    const [licence, setLicence] = useState('');
    const [applicationUrl, setApplicationUrl] = useState('');
    const [applicationUrlValid, setApplicationUrlValid] = useState(true);
    const [customLandingPageUrl, setCustomLandingPageUrl] = useState('');
    const [applicationMetadata, setApplicationMetadata] = useState('');
    const [applicationMetadataValid, setApplicationMetadataValid] = useState(true);
    const [fileUrl, setFileUrl] = useState('');
    const [fileUrlValid, setFileUrlValid] = useState(true);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [providerMetadata, setProviderMetadata] = useState('');
    const [providerMetadataValid, setProviderMetadataValid] = useState(true);
    const [userId, setUserId] = useState('');

    const auth = useAuth();

    useEffect(() => {
        if (auth && auth.user) {
            setUserId(auth.user?.profile[import.meta.env.VITE_PROFILE_USERID] as string || '');
        }
    }, [auth]);

    useEffect(() => {
        if (applicationUrl.trim() === '') {
            setApplicationUrlValid(true);
        } else {
            setApplicationUrlValid(isUrl(applicationUrl.trim()));
        }
    }, [applicationUrl]);

    useEffect(() => {
        if (fileUrl.trim() === '') {
            setFileUrlValid(true);
        } else {
            setFileUrlValid(isUrl(fileUrl.trim()));
        }
    }, [fileUrl]);

    useEffect(() => {
        if (providerMetadata.trim() === '') {
            setProviderMetadataValid(true);
        } else {
            setProviderMetadataValid(isJson(providerMetadata.trim()));
        }
    }, [providerMetadata]);

    useEffect(() => {
        if (applicationMetadata.trim() === '') {
            setApplicationMetadataValid(true);
        } else {
            setApplicationMetadataValid(isJson(applicationMetadata.trim()));
        }
    }, [applicationMetadata]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        onSubmit({
            title: title.trim(),
            authors: authors.trim(),
            description: description.trim(),
            licence: licence.trim(),
            applicationUrl: applicationUrl.trim(),
            customLandingPageUrl: customLandingPageUrl.trim(),
            applicationMetadata: applicationMetadata.trim(),
            fileUrl: fileUrl.trim(),
            uploadedFile: uploadedFile,
            providerMetadata: providerMetadata.trim(),
            userId: userId.trim()
        });
    };

    const isFormValid = () => {
        return (
            isJson(providerMetadata.trim()) &&
            title.trim() !== '' &&
            authors.trim() !== '' &&
            description.trim() !== '' &&
            isUrl(applicationUrl.trim()) &&
            userId.trim() !== '' &&
            (isUrl(fileUrl.trim()) || uploadedFile !== null) &&
            (applicationMetadata.trim() == '' || isJson(applicationMetadata.trim()))
        );
    };

    const isJson = (value: string) => {
        try {
            let json = JSON.parse(value);
            return typeof json === 'object' && !Array.isArray(json);
        } catch {
            return false;
        }
    }

    const isUrl = (value: string) => {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    return (
        <Form onSubmit={handleSubmit}>
            <h5>Mint New DOI</h5>
            <Form.Group className="mb-3">
                <Form.Label>Provider Metadata (JSON) <span className="text-danger">* {!providerMetadataValid && "invalid"}</span></Form.Label>
                <Form.Control as="textarea" rows={12} value={providerMetadata} onChange={e => setProviderMetadata(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Title <span className="text-danger">*</span></Form.Label>
                <Form.Control type="text" value={title} onChange={e => setTitle(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Authors <span className="text-danger">*</span></Form.Label>
                <Form.Control type="text" value={authors} onChange={e => setAuthors(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Description <span className="text-danger">*</span></Form.Label>
                <Form.Control as="textarea" rows={2} value={description} onChange={e => setDescription(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Licence</Form.Label>
                <Form.Control type="text" value={licence} onChange={e => setLicence(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Application URL <span className="text-danger">* {!applicationUrlValid && "invalid"}</span></Form.Label>
                <Form.Control type="text" value={applicationUrl} onChange={e => setApplicationUrl(e.target.value)} required />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Custom Landing Page URL</Form.Label>
                <Form.Control type="text" value={customLandingPageUrl} onChange={e => setCustomLandingPageUrl(e.target.value)} />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Application Metadata {!applicationMetadataValid && <span className="text-danger">invalid</span>}</Form.Label>
                <Form.Control as="textarea" rows={2} value={applicationMetadata} onChange={e => setApplicationMetadata(e.target.value)} />
            </Form.Group>

            <hr />
            <h5>File (URL or upload) <span className="text-danger">*</span></h5>
            <Form.Group className="mb-3">
                <Form.Label>File URL {!fileUrlValid && <span className="text-danger">invalid</span>}</Form.Label>
                <Form.Control type="text" value={fileUrl} onChange={e => setFileUrl(e.target.value)} disabled={!!uploadedFile} />
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>Or Upload File</Form.Label>
                <Form.Control type="file" onChange={e => {const input = e.target as HTMLInputElement;setUploadedFile(input.files?.[0] || null);}} disabled={!!fileUrl}/>
            </Form.Group>
            <Form.Group className="mb-3">
                <Form.Label>User Id</Form.Label>
                <Form.Control type="text" value={userId} onChange={e => setUserId(e.target.value)}/>
            </Form.Group>

            <Button variant="primary" type="submit" disabled={!isFormValid()}>Submit</Button>
        </Form>
    );
}

export default DoiForm;
