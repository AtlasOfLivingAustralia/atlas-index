import {NavigateFunction} from "react-router-dom";

interface Breadcrumb {
    title: string | React.ReactNode;
    href: string | undefined | null;
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
    customFacets?: string[] // additional facets to fetch in the query
    addCustomFacetsFn?: ({url, getFacets, thisFacetFqs, parentData, setCustomFacetData}: CustomFacetFn) => void
    renderListItemFn: ({item, navigate, wide}: RenderItemParams) => any
    renderTileItemFn: ({item, navigate, wide}: RenderItemParams) => any
    resourceLinks?: {url: string, label: string}[]
}

interface RenderItemElements {
    image?: React.ReactNode;
    title: React.ReactNode;
    extra?: React.ReactNode;
    description?: React.ReactNode;
    clickFn: () => void;
}

interface RenderItemParams {
    item: any;
    navigate: NavigateFunction;
    wide: boolean;
    isMobile: boolean;
}

interface CustomFacetFn {
    url: string,
    getFacets: boolean,
    thisFacetFqs: string[],
    parentData: any,
    setCustomFacetData: any
}

interface AutocompleteItem {
    lsid: string,
    name: string
}

export type {
    Breadcrumb,
    TaxonDescription,
    GenericViewProps,
    RenderItemParams,
    CustomFacetFn,
    AutocompleteItem,
    RenderItemElements
};
