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
    user: User,
    userId: string,
    isAdmin: boolean,
    roles: string[]
}

export type {Breadcrumb, ListsUser, AtlasLog, TaskType}
