interface TaskType {
    log: {
        id: string;
        task: string;
        modified: number;
        message: string;
        modifiedDate: string;
    }[];
    description: string;
    enabled: boolean;
}
type Task = {
    name?: string;
    description?: string;
    enabled?: boolean;
    log?: {
        id?: string;
        task?: string;
        modified?: number;
        message?: string;
        modifiedDate?: string;
    }[];
    instructions?: React.ReactNode;
    lastRun?: string;
    schedule?: string;
};

type Tasks = {
    [key: string]: Task;
};

interface AtlasLog {
    queues: {
        [key: string]: {
            activeCount: number;
            queueSize: number;
            description: string;
            queueCapacity: number;
        };
    };
    tasks: {
        [key: string]: TaskType;
    };
}

interface QualityFilter {
    id: number;
    enabled: boolean;
    description: string;
    filter: string;
    displayOrder: number;
    inverseFilter: string;
}

interface QualityCategory {
    id: number;
    enabled: boolean;
    name: string;
    label: string;
    description: string;
    displayOrder: number;
    inverseFilter: string;
    qualityFilters: QualityFilter[];
}

interface QualityProfile {
    id: number;
    name: string;
    shortName: string;
    description: string;
    contactName: string;
    contactEmail: string;
    enabled: boolean;
    isDefault: boolean;
    displayOrder: number;
    dateCreated: Date | undefined;
    lastUpdated: Date | undefined;
    categories: QualityCategory[];
}

interface Fq {
    name: string;
    fq: string;
    href: string;
}

interface Institution {
    name: string;
    collections: Fq[];
}

interface AdvancedSearch {
    speciesGroups: Fq[];
    institutions: Institution[];
    countries: Fq[];
    states: Fq[];
    ibra: Fq[];
    imcra: Fq[];
    lga: Fq[];
    typeStatus: Fq[];
    basisOfRecord: Fq[];
    dataResources: Fq[];
}

interface FacetItem {
    label: string;
    count: number;
    fq: string;
}

interface Facet {
    label: string;
    facets: FacetItem[];
}

interface GroupedFacetData {
    [key: string]: Facet[];
}

interface DataQualityInfo {
    profile: string;
    unfilteredCount: number | undefined;
    selectedFilters: string[] | undefined;
    expand: boolean;
}

interface FieldInfo {
    name: string;
    description: string;
    dataType: string;
    indexed: boolean;
    stored: boolean;
    multiValued: boolean;
    info: string;
    dwcTerm: string;
    category: string;
}

interface IndexFields {
    [key: string]: FieldInfo;
}

interface DescriptionItem {
    field: string;
    source: string;
    value: string;
    original: string;
}

export type {
    AtlasLog,
    TaskType,
    QualityProfile,
    QualityCategory,
    QualityFilter,
    AdvancedSearch,
    Fq,
    Institution,
    GroupedFacetData,
    DataQualityInfo,
    FieldInfo,
    IndexFields,
    Task,
    Tasks,
    DescriptionItem
};
