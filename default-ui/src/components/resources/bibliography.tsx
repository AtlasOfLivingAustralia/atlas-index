import {} from "react";

interface BibliographyProps {
    resource: { thumbnail: string };
}

function Bibliography({resource}: BibliographyProps) {

    return <>
        <pre>{JSON.stringify(resource, null, 2)}</pre>
    </>
}

export default Bibliography;
