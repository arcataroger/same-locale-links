import {Canvas, FieldGroup, Form, SelectField} from 'datocms-react-ui';
import {Field, RenderFieldExtensionCtx} from "datocms-plugin-sdk";
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

const getRecordsByIds = async ({ids, accessToken}: {
    ids: string[],
    accessToken: string
}): Promise<Item[]> => {
    const DatoClient = new Client({apiToken: accessToken!})

    const records = await DatoClient.items.list({
        filter: {
            ids: ids.join(), // The plugin ctx gives us an array of strings, but the CMA expects a CSV string
        },
    })
    return records
}

const getValueByFieldPath = (formValues: Record<string, any>, fieldPath: string): any => {
    return fieldPath.split('.').reduce((acc, key) => acc && acc[key], formValues);
};

export const SameLocaleLinks = ({ctx}: PropTypes) => {
    const {
        locale,
        field,
        itemTypes,
        currentUserAccessToken,
        loadItemTypeFields,
        setFieldValue,
        fieldPath,
        formValues
    } = ctx;

    // @ts-expect-error We don't have strong typing for item type validations yet
    const linkableItemTypeIds: string[] = field.attributes.validators['items_item_type']['item_types'] // Array of item type IDs

    const [linkableRecords, setLinkableRecords] = useState<Item[]>([])
    const [titleFieldsByItemTypeId, setTitleFieldsByItemTypeId] = useState<{ [key: string]: string }>({})
    const [localizedFieldsByItemTypeId, setLocalizedFieldsByItemTypeId] = useState<{ [key: string]: string[] }>({})
    const [selectedRecords, setSelectedRecords] = useState<{ value: string, label: string }[] | null>(null);

    useEffect(() => {
        (async () => {
            for (const itemTypeId of linkableItemTypeIds) {
                const fieldsForThisItemType: Field[] =  await loadItemTypeFields(itemTypeId)
                const titleFieldId: string | undefined = itemTypes?.[itemTypeId]?.relationships?.title_field?.data?.id ?? undefined
                const titleField = fieldsForThisItemType.find(field => field.id === titleFieldId)
                if (titleField && titleField.attributes.api_key) {
                    setTitleFieldsByItemTypeId(prevState => ({
                        ...prevState,
                        [itemTypeId]: titleField.attributes.api_key
                    }))
                }

                const localizedFields = fieldsForThisItemType.filter(field => field.attributes.localized).map(field => field.attributes.api_key)
                setLocalizedFieldsByItemTypeId(prevState => ({...prevState, [itemTypeId]: localizedFields}))
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemTypes, linkableItemTypeIds, locale])

    const linkedRecordIds = useMemo<string[]>(() => getValueByFieldPath(formValues, fieldPath), [formValues, fieldPath])

    useEffect(() => {
        (async () => {
            const records = await getRecordsByIds({ids: linkedRecordIds, accessToken: currentUserAccessToken!})

            setSelectedRecords(records.map(record => {
                const titleField = titleFieldsByItemTypeId[record.item_type.id]

                // @ts-expect-error We don't know the title field's type
                const recordName = record[titleField]?.[locale]

                return {
                    value: record.id,
                    label: recordName ?? record.id
                }
            }))
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [linkedRecordIds, locale, titleFieldsByItemTypeId])

    useEffect(() => {
        if (!currentUserAccessToken) {
            return
        }

        (async () => {

            const recordsFromCMA = await getRecordsByItemTypes({
                itemTypes: linkableItemTypeIds,
                accessToken: currentUserAccessToken! // TODO require this permission
            });

            setLinkableRecords(recordsFromCMA)
        })()

    }, [currentUserAccessToken, itemTypes, locale, linkableItemTypeIds])

    const linkableRecordsWithAnyFieldInThisLocale = useMemo<Item[]>(() => {
        const filteredRecords = linkableRecords.filter(record => {
            const fields = localizedFieldsByItemTypeId[record.item_type.id]
            if (!fields?.length) return false
            // @ts-expect-error We don't know what the record fields are, but that's OK as long as they have a non-empty locale
            return fields.some(field => record[field][locale])
        })
        return filteredRecords
    }, [localizedFieldsByItemTypeId, linkableRecords, locale])

    useEffect(() => {
        if (selectedRecords === null) return
        if (selectedRecords === getValueByFieldPath(formValues, fieldPath)) return
        const selectedRecordIds = selectedRecords.map(record => record.value)
        setFieldValue(fieldPath, selectedRecordIds)
    }, [selectedRecords, setFieldValue, fieldPath, formValues])

    return (
        <Canvas ctx={ctx}>
            <Form>
                <FieldGroup>
                    <SelectField
                        name={`same-locale-links-${fieldPath}`}
                        id={`same-locale-links-${fieldPath}`}
                        label={`Only showing records in locale "${locale}"`}
                        hint={`${selectedRecords?.length ?? 0} records selected`}
                        placeholder={selectedRecords ? 'Click to select' : 'Loading, please wait...'}
                        value={selectedRecords}
                        selectInputProps={{
                            isMulti: true,
                            options: linkableRecordsWithAnyFieldInThisLocale.map(item => {
                                const {id, item_type} = item;
                                const itemTypeId = item_type.id
                                const titleFieldName = titleFieldsByItemTypeId[itemTypeId]
                                // @ts-expect-error
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
        </Canvas>
    );
}