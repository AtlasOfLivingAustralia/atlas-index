import { NavigateFunction } from 'react-router-dom';

interface TaxonDescription {
    name: string;
    url: string;
    attribution: string;

    [key: string]: string;
}

interface GenericViewProps {
    queryString?: String | undefined;
    fq: string;
    facetDefinitions: {
        [key: string]: {
            label: string;
            order: number;
            parseFacetFn?: (facet: any, facetList: any[]) => void;
            lessNumber?: number; // number of facet items to show before "show more" option
            more?: boolean; // whether to show "show more" option
        };
    };
    sortByDate?: boolean;
    customFacets?: string[]; // additional facets to fetch in the query
    addCustomFacetsFn?: ({
        url,
        getFacets,
        thisFacetFqs,
        parentData,
        setCustomFacetData,
    }: CustomFacetFn) => void;
    renderListItemFn: ({ item, navigate, wide, searchTerm }: RenderItemParams) => any;
    renderTileItemFn: ({ item, navigate, wide, searchTerm }: RenderItemParams) => any;
    resourceLinks?: { url: string; label: string }[];
}

interface RenderItemElements {
    image?: React.ReactNode;
    title: React.ReactNode;
    extra?: React.ReactNode;
    description?: React.ReactNode;
    clickFn?: () => void;
    url?: string;
}

interface RenderItemParams {
    item: any;
    navigate: NavigateFunction;
    wide: boolean;
    isMobile: boolean;
    searchTerm?: string | null; // used for highlighting search term in the description
}

interface CustomFacetFn {
    url: string;
    getFacets: boolean;
    thisFacetFqs: string[];
    parentData: any;
    setCustomFacetData: any;
}

export type {
    TaxonDescription,
    GenericViewProps,
    RenderItemParams,
    CustomFacetFn,
    RenderItemElements,
};
