import {User} from "oidc-client-ts";
import {NavigateFunction} from "react-router-dom";

interface Breadcrumb {
    title: string | React.ReactNode;
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

interface TaxonDescription {
    name: string;
    url: string;
    attribution: string;

    [key: string]: string;
}

interface GenericViewProps {
    queryString?: String | undefined
    fq: string
    facetDefinitions: {
        [key: string]: {
            label: string
            order: number
            parseFacetFn?: (facet: any, facetList: any[]) => void
        }
    }
    sortByDate?: boolean
    addCustomFacetsFn?: ({url, getFacets, parentData, setCustomFacetData}: CustomFacetFn) => void
    renderListItemFn: ({item, navigate, wide}: RenderItemParams) => any
    renderTileItemFn: ({item, navigate, wide}: RenderItemParams) => any
}

interface RenderItemParams {
    item: any;
    navigate: NavigateFunction;
    wide: boolean; // The "all" page item is wider than the item on the page that also has "refine results" on the left
}

interface CustomFacetFn {
    url: string,
    getFacets: boolean,
    thisFacetFqs: string[],
    parentData: any,
    setCustomFacetData: any
}

export type {
    Breadcrumb,
    ListsUser,
    AtlasLog,
    TaskType,
    AdvancedSearch,
    AdvancedSearchInputs,
    Fq,
    Institution,
    GroupedFacetData,
    FieldInfo,
    IndexFields,
    TaxonDescription,
    GenericViewProps,
    RenderItemParams,
    CustomFacetFn
};
