import React from 'react';

interface FormatNameProps {
    name: string;
    rankId: number;
}

const FormatName: React.FC<FormatNameProps> = ({
    name, rankId
}: FormatNameProps) => {
    // console.log("FormatNameProps", name, rankId);
    return (
        <>
            {rankId && rankId <= 8000 && rankId >= 6000 ? (
                <span style={{ fontStyle: "italic" }}>{name}</span>
            ) : (
                <span>{name}</span>
            )}
        </>
    );
}

export default FormatName;