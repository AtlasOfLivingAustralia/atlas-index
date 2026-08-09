import DOMPurify from 'dompurify';
import {IntlShape} from "react-intl";

// Characters that are either HTML or ICU message syntax — not safe to use as a message ID or default message
const UNSAFE_TEXT_RE = /[<>{}']/;

export function translate(intl: IntlShape, text: string | number, field: string | undefined): string {
    if (!text) {
        return '';
    }

    // if text is not a string, convert to string
    text = '' + text;

    // If the value contains HTML tags or ICU-unsafe characters, return it verbatim — attempting
    // to pass it through formatMessage would cause a FORMAT_ERROR in the ICU parser.
    if (UNSAFE_TEXT_RE.test(text)) {
        return text;
    }

    if (field) {
        return intl.formatMessage({id: `${field}.${text}`,
            defaultMessage: intl.formatMessage({id: `${text}`, defaultMessage: text})
        });
    } else {
        return intl.formatMessage({id: `${text}`, defaultMessage: text});
    }
}

export function isUrl(value: string | undefined): boolean {
    if (!value || /\s/.test(value) || !(value.startsWith('http://') || value.startsWith('https://'))) {
        return false;
    }
    try {
        new URL(value);
        return true;
    } catch (_) {
        return false;
    }
}

export function sanitizeBodyText(text: string, openInNewWindow: boolean = true): string {
    const sanitized = DOMPurify.sanitize(text, {
        ALLOWED_TAGS: ['a', 'br', 'i', 'b', 'span'],
        ALLOWED_ATTR: ['href', 'class', 'id', 'rel', 'target'],
        ALLOW_DATA_ATTR: false,
    });

    if (!openInNewWindow) {
        return sanitized;
    }

    return sanitized.replace(/<a /g, '<a target="_blank" ');
}

export function getQc() : string {
    return (import.meta.env.VITE_QUERY_CONTEXT || '') ? `&qc=${import.meta.env.VITE_QUERY_CONTEXT}` : '';
}

export function quoteText(text: string): string {
    if (text && (text.includes(' ') || text.includes(':') || text.includes('(') || text.includes('['))) {
        return `"${text.replace(/"/g, '\\"')}"`;
    }
    return text;
}
