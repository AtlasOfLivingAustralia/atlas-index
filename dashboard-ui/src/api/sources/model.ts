interface AutocompleteItem {
    lsid: string,
    name: string
}

type Table = {
    name?: string;
    header?: string[];
    rows: TableRow[];
};

type NameUrl = {
    name: string;
    url?: string;
};

type TablesSection = {
    date: number;
    count?: number;
    url?: string;
    imageUrl?: string;
    mostRecent?: NameUrl;
    tables: Table[];
};

type TableRow = {
    name: string;
    url?: string;
    values: (number | string)[];
};

type DashboardJson = {
    basisOfRecord: TablesSection;
    digivol: TablesSection;
    species: TablesSection;
    collections: TablesSection;
    reasonDownloads: TablesSection;
    nationalSpeciesLists: TablesSection;
    recordsByDate: TablesSection;
    specimenTypes: TablesSection;
    speciesGroup: TablesSection;
    emailDownloads: TablesSection;
    usageStats: TablesSection;
    image: TablesSection;
    conservation: TablesSection;
    dataProviderUid: TablesSection;
    decade: TablesSection;
    institutionUid: TablesSection;
    kingdoms: TablesSection;
    bhl: TablesSection;
    spatialLayers: TablesSection;
    states: TablesSection;
    datasets: TablesSection;
    occurrenceCount: TablesSection;
};

type TreeItemObj = {
    fq: string | undefined;
    count: number;
    label: string;
};

export type {
    AutocompleteItem,
    Table,
    TablesSection,
    TableRow,
    DashboardJson,
    NameUrl,
    TreeItemObj
};
