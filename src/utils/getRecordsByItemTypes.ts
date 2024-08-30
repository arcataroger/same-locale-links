import type {Item} from "@datocms/cma-client/dist/types/generated/SimpleSchemaTypes";
import {Client} from "@datocms/cma-client";

export const getRecordsByItemTypes = async ({itemTypes, accessToken}: {
    itemTypes: string[],
    accessToken: string
}): Promise<Item[]> => {
    const DatoClient = new Client({apiToken: accessToken!})

    const records = await DatoClient.items.list({
        filter: {
            type: itemTypes.join(), // The plugin ctx gives us an array of strings, but the CMA expects a CSV string
        },
    })
    return records
}