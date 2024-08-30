import {Canvas, FieldGroup, Form, SelectField} from 'datocms-react-ui';
import {RenderFieldExtensionCtx} from "datocms-plugin-sdk";
import {Client} from '@datocms/cma-client'
import {useEffect, useMemo, useState} from "react";
import type {Item} from '@datocms/cma-client/dist/types/generated/SimpleSchemaTypes'

type PropTypes = {
    ctx: RenderFieldExtensionCtx;
};

const getRecordsByItemTypes = async ({itemTypes, accessToken}: {
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

export const SameLocaleLinks = ({ctx}: PropTypes) => {
    const {locale, field, itemTypes, currentUserAccessToken, loadItemTypeFields} = ctx;

    // @ts-expect-error We don't have strong typing for item type validations yet
    const acceptableItemTypes: string[] = field.attributes.validators['items_item_type']['item_types'] // Array of item type IDs

    const [linkableRecords, setLinkableRecords] = useState<Item[]>([])
    const [titleFieldsByItemType, setTitleFieldsByItemType] = useState<{ [key: string]: string }>({})
    const [localizedFieldsByItemType, setLocalizedFieldsByItemType] = useState<{ [key: string]: string[] }>({})
    const [selectedRecords, setSelectedRecords] = useState<{value: string, label:string}[]>([]);

    useEffect(() => {
        if (!currentUserAccessToken) {
            return
        }

        (async () => {
            for (const itemTypeId of acceptableItemTypes) {
                const titleFieldId: string | undefined = itemTypes?.[itemTypeId]?.relationships?.title_field?.data?.id ?? undefined
                const fieldsForThisItemType = await loadItemTypeFields(itemTypeId)

                const titleField = fieldsForThisItemType.find(field => field.id === titleFieldId)
                if (titleField && titleField.attributes.api_key) {
                    setTitleFieldsByItemType(prevState => ({...prevState, [itemTypeId]: titleField.attributes.api_key}))
                }

                const localizedFields = fieldsForThisItemType.filter(field => field.attributes.localized).map(field => field.attributes.api_key)
                setLocalizedFieldsByItemType(prevState => ({...prevState, [itemTypeId]: localizedFields}))
            }

            const recordsFromCMA = await getRecordsByItemTypes({
                itemTypes: acceptableItemTypes,
                accessToken: currentUserAccessToken! // TODO require this permission
            });

            setLinkableRecords(recordsFromCMA)
        })()

    }, [currentUserAccessToken, itemTypes, locale, acceptableItemTypes, loadItemTypeFields])

    const linkableRecordsWithAnyFieldInThisLocale = useMemo(() => {
        // @ts-expect-error We don't know the field type, we just care about whether it has a localized key
        const filteredRecords = linkableRecords.filter(record => localizedFieldsByItemType[record.item_type.id].some(field => record[field][locale]))
        return filteredRecords
    }, [localizedFieldsByItemType, linkableRecords, locale])

    return (
        <Canvas ctx={ctx}>
            <Form>
                <FieldGroup>
                    <SelectField
                        name="multipleOption"
                        id="multipleOption"
                        label="Multiple options"
                        hint="Select one of the options"
                        value={selectedRecords}
                        selectInputProps={{
                            isMulti: true,
                            options: linkableRecordsWithAnyFieldInThisLocale.map(item => {
                                const {id, item_type} = item;
                                const itemTypeId = item_type.id
                                const titleFieldName = titleFieldsByItemType[itemTypeId]
                                // @ts-expect-error Our "record" types aren't set up right between the CMA and plugins SDK :(
                                if (titleFieldName && item[titleFieldName][locale]) {
                                    // @ts-expect-error
                                    return {value: id, label: item[titleFieldName][locale] as string}
                                } else {
                                    return {value: id, label: id}
                                }
                            }),
                        }}
                        onChange={(newValue) => setSelectedRecords([...newValue])}
                    />
                </FieldGroup>
            </Form>

            <h2>Debug</h2>
            <ul>
                <li>Locale: {locale}</li>
                <li>Item types: <pre>{JSON.stringify(acceptableItemTypes, null, 2)}</pre></li>
                <li>Field API keys: <pre>{JSON.stringify(titleFieldsByItemType, null, 2)}</pre></li>
                <li>Acceptable Records: <pre>{JSON.stringify(linkableRecords, null, 2)}</pre></li>
            </ul>
        </Canvas>
    );
}