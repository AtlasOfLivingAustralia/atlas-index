import { User } from "oidc-client-ts";

interface Breadcrumb {
    title: string;
    href: string | undefined | null;
}

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

interface AtlasLog {
    queues: {
        [key: string]: {
            activeCount: number,
            queueSize: number,
            description: string,
            queueCapacity: number
        }
    };
    tasks: {
        [key: string]: TaskType;
    };
}

interface ListsUser {
    user: () => User | null | undefined,
    userId: () => string,
    isAdmin: () => boolean,
    roles: () => string[],
    isLoading: () => boolean
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
    name: string
    shortName: string
    description: string
    contactName: string
    contactEmail: string
    enabled: boolean
    isDefault: boolean
    displayOrder: number
    dateCreated: Date | undefined
    lastUpdated: Date | undefined
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

interface AdvancedSearchInputs {
    advancedText: string;
    advancedTaxa: string[];
    advancedRawTaxon: string;
    advancedSpeciesGroup: string;
    advancedInstitution: string;
    advancedCountry: string;
    advancedState: string;
    advancedIbra: string;
    advancedImcra: string;
    advancedLga: string;
    advancedTypeStatus: string;
    advancedBasisOfRecord: string;
    advancedDataResource: string | null;
    advancedCollector: string;
    advancedCatalogue: string;
    advancedRecord: string;
    advancedBeginDate: string;
    advancedEndDate: string;
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
    name: string,
    description: string,
    dataType: string,
    indexed: boolean,
    stored: boolean,
    multiValued: boolean,
    info: string,
    dwcTerm: string,
    category: string
}

interface IndexFields {
    [key: string]: FieldInfo;
}

export type {
    Breadcrumb,
    ListsUser,
    AtlasLog,
    TaskType,
    QualityProfile,
    QualityCategory,
    QualityFilter,
    AdvancedSearch,
    AdvancedSearchInputs,
    Fq,
    Institution,
    GroupedFacetData,
    DataQualityInfo,
    FieldInfo,
    IndexFields
};
