interface AutocompleteItem {
    lsid: string,
    name: string
}

interface Breadcrumb {
    title: string | React.ReactNode;
    href: string | undefined | null;
}

export type {
    AutocompleteItem,
    Breadcrumb
};
