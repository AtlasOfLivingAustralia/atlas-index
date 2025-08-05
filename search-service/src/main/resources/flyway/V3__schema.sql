CREATE TABLE taxon_data
(
    taxon_concept_id varchar(255),
    key              varchar(255) NOT NULL,
    scientific_name  varchar(255),
    value            text,
    PRIMARY KEY (taxon_concept_id, key)
);

CREATE INDEX idx_taxon_data_taxon_concept_id ON taxon_data (taxon_concept_id);
CREATE INDEX idx_taxon_data_key ON taxon_data (key);
