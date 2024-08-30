export const getValueByFieldPath = (formValues: Record<string, any>, fieldPath: string): any => {
    return fieldPath.split('.').reduce((acc, key) => acc && acc[key], formValues);
};