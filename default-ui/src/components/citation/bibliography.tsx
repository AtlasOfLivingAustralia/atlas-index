import {} from "react";

interface BibliographyProps {

}

function Bibliography({resource}: BibliographyProps) {

    return <>
        <pre>{JSON.stringify(resource, null, 2)}</pre>
    </>
}

export default Bibliography;
