import {User} from "oidc-client-ts";

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

export type {Breadcrumb, ListsUser, AtlasLog, TaskType, QualityProfile, QualityCategory, QualityFilter}
