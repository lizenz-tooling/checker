export const filterAttributes = (
	attributes: string[] | null | undefined,
	json: Record<string, unknown>
): Record<string, unknown> => {
	let filteredJson = json;

	if (attributes) {
		filteredJson = {};
		for (const attribute of attributes) {
			filteredJson[attribute] = json[attribute];
		}
	}

	return filteredJson;
};
