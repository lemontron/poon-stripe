export const appendSearchParam = (body, key, value) => {
	if (Array.isArray(value)) {
		value.forEach((item, i) => appendSearchParam(body, `${key}[${i}]`, item));
	} else if (value && typeof value === 'object') {
		Object.entries(value).forEach(([childKey, childValue]) => {
			appendSearchParam(body, `${key}[${childKey}]`, childValue);
		});
	} else {
		body.append(key, value);
	}
};

export const createSearchParams = data => {
	const body = new URLSearchParams();
	Object.entries(data).forEach(([key, value]) => appendSearchParam(body, key, value));
	return body;
};
