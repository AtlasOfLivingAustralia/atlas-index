import {IntlShape} from "react-intl";

export function translate(intl: IntlShape, text: string | number, field: string | undefined): string {
    if (!text) {
        return '';
    }

    // if text is not a string, convert to string
    text = '' + text;

    if (field) {
        return intl.formatMessage({id: `${field}.${text}`,
            defaultMessage: intl.formatMessage({id: `${text}`, defaultMessage: text})
        });
    } else {
        return intl.formatMessage({id: `${text}`, defaultMessage: text});
    }
}
