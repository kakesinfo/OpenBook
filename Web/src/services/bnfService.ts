/**
 * Service client pour interroger la BnF via le backend (/books/bnf/search).
 */

export interface BnfAuthor {
    firstname: string;
    lastname: string;
    type: "Writer" | "Illustrator" | "Colorist" | "Other";
}

export interface BnfBookResult {
    title: string;
    isbn: string;
    price: number | null;
    coverUrl: string;
    seriesName: string | null;
    volume: number | null;
    editorName: string | null;
    collectionName: string | null;
    pageCount: number | null;
    releaseDate: string | null;
    description: string | null;
    docType: string | null;
    height: number | null;
    length: number | null;
    thickness: number | null;
    authors: BnfAuthor[];
}

export type CustomFetchFn = (url: string, options?: RequestInit) => Promise<Response>;

export async function searchBnf(customFetch: CustomFetchFn, rawQuery: string): Promise<BnfBookResult[]> {
    const trimmed = rawQuery.trim();
    if (!trimmed) {
        return [];
    }

    try {
        const res = await customFetch(`/books/bnf/search?query=${encodeURIComponent(trimmed)}`, {
            method: "GET"
        });
        if (!res.ok) {
            return [];
        }
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}
