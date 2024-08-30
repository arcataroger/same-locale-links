import {Canvas, FieldGroup, Form, SelectField} from 'datocms-react-ui';
import {type Field, RenderFieldExtensionCtx} from "datocms-plugin-sdk";
import {useEffect, useMemo, useState} from "react";
import type {Item} from '@datocms/cma-client/dist/types/generated/SimpleSchemaTypes'
import {getRecordsByItemTypes} from "../utils/getRecordsByItemTypes";
import {getRecordsByIds} from "../utils/getRecordsById";
import {getValueByFieldPath} from "../utils/getValueByFieldPath";

export const SameLocaleLinks = ({ctx}: { ctx: RenderFieldExtensionCtx }) => {
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

    // The field's current values from the server
    const linkedRecordIds = useMemo<string[]>(() => getValueByFieldPath(formValues, fieldPath), [formValues, fieldPath])


    // Update the plugin's state whenever the server data changes, and fetch record names too
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

    // We need to fetch the title fields for each linkable item type, because this isn't part of the plugin's context
    useEffect(() => {
        (async () => {
            for (const itemTypeId of linkableItemTypeIds) {
                const fieldsForThisItemType: Field[] = await loadItemTypeFields(itemTypeId)
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


    // Get records we're allowed to link to, based on the field validation alone (no locale filtering yet)
    useEffect(() => {
        (async () => {

            const recordsFromCMA = await getRecordsByItemTypes({
                itemTypes: linkableItemTypeIds,
                accessToken: currentUserAccessToken! // TODO require this permission
            });

            setLinkableRecords(recordsFromCMA)
        })()

    }, [currentUserAccessToken, itemTypes, locale, linkableItemTypeIds])

    // Filter them down by testing to see if ANY of its localized fields has data in the current locale
    const linkableRecordsFilteredByLocale = useMemo<Item[]>(() => {
        const filteredRecords = linkableRecords.filter(record => {
            const fields = localizedFieldsByItemTypeId[record.item_type.id]
            if (!fields?.length) return false
            // @ts-expect-error We don't know what the record fields are, but that's OK as long as they have a non-empty locale
            return fields.some(field => record[field][locale])
        })
        return filteredRecords
    }, [localizedFieldsByItemTypeId, linkableRecords, locale])

    // Update the server when the field data changes locally
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
                            options: linkableRecordsFilteredByLocale.map(item => {
                                const {id, item_type} = item;
                                const itemTypeId = item_type.id
                                const titleFieldName = titleFieldsByItemTypeId[itemTypeId]
                                // @ts-expect-error We don't know the titleFieldName's type
                                if (titleFieldName && item[titleFieldName][locale]) {
                                    // @ts-expect-error
                                    return {value: id, label: item[titleFieldName][locale]}
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