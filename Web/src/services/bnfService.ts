/**
 * Service pour interroger le catalogue de la Bibliothèque Nationale de France (BnF) via SRU.
 * Permet de récupérer les métadonnées d'un livre (titre, prix, couverture) par son ISBN.
 */

export interface BnfBookResult {
    title: string;
    isbn: string;
    price: number | null;
    coverUrl: string;
}

const BNF_SRU_BASE_URL = "https://catalogue.bnf.fr/api/SRU";

export function cleanIsbn(raw: string): string {
    let cleaned = raw.trim().replace(/[^0-9Xx]/g, "");
    if (cleaned.length > 13 && (cleaned.startsWith("978") || cleaned.startsWith("979"))) {
        cleaned = cleaned.substring(0, 13);
    }
    return cleaned;
}

export function isIsbn(raw: string): boolean {
    const clean = cleanIsbn(raw);
    return /^[0-9Xx\-]+$/.test(raw.trim()) && (clean.length === 10 || clean.length === 13);
}

export function isbn10ToIsbn13(isbn10: string): string | null {
    const clean = isbn10.replace(/[^0-9Xx]/g, "");
    if (clean.length !== 10) return null;
    const base = `978${clean.substring(0, 9)}`;
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        const digit = parseInt(base[i], 10);
        if (isNaN(digit)) return null;
        sum += i % 2 === 0 ? digit : digit * 3;
    }
    const check = (10 - (sum % 10)) % 10;
    return `${base}${check}`;
}

export function isbn13ToIsbn10(isbn13: string): string | null {
    const clean = isbn13.replace(/[^0-9Xx]/g, "");
    if (clean.length !== 13 || !clean.startsWith("978")) return null;
    const base = clean.substring(3, 12);
    let sum = 0;
    for (let i = 0; i < 9; i++) {
        const digit = parseInt(base[i], 10);
        if (isNaN(digit)) return null;
        sum += digit * (10 - i);
    }
    const rem = (11 - (sum % 11)) % 11;
    const check = rem === 10 ? "X" : rem.toString();
    return `${base}${check}`;
}

function decodeXmlEntities(text: string): string {
    return text
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\s+/g, " ")
        .trim();
}

export function parseBnfXmlResponse(xmlBody: string, originalClean: string): BnfBookResult | null {
    const countMatch = xmlBody.match(/<(?:\w+:)?numberOfRecords>(\d+)<\/(?:\w+:)?numberOfRecords>/);
    if (!countMatch) return null;
    const count = parseInt(countMatch[1] || "0", 10);
    if (count <= 0) return null;

    // 1. Titre
    let title: string | null = null;
    const tag200Match = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="200"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
    if (tag200Match) {
        const fieldContent = tag200Match[1];
        const subAMatch = fieldContent.match(/<(?:\w+:)?subfield[^>]*code="a"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subAMatch) {
            let mainTitle = decodeXmlEntities(subAMatch[1]);
            const subEMatch = fieldContent.match(/<(?:\w+:)?subfield[^>]*code="e"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
            if (subEMatch) {
                const subtitle = decodeXmlEntities(subEMatch[1]);
                if (subtitle.length > 0) {
                    mainTitle = `${mainTitle} : ${subtitle}`;
                }
            }
            title = mainTitle;
        }
    }

    // Fallback Dublin Core titre
    if (!title || !title.trim()) {
        const dcTitleMatch = xmlBody.match(/<(?:\w+:)?title[^>]*>([^<]+)<\/(?:\w+:)?title>/);
        if (dcTitleMatch) {
            let rawDc = decodeXmlEntities(dcTitleMatch[1]);
            if (rawDc.includes(" / ")) {
                rawDc = rawDc.split(" / ")[0].trim();
            }
            title = rawDc;
        }
    }

    if (!title || !title.trim()) {
        return null;
    }

    // Nettoyage ponctuation résiduelle
    title = title.replace(/\s*[/:]\s*$/, "").trim();

    // 2. Prix
    let price: number | null = null;
    const tag010Match = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="010"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
    if (tag010Match) {
        const fieldContent = tag010Match[1];
        const subDMatch = fieldContent.match(/<(?:\w+:)?subfield[^>]*code="d"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subDMatch) {
            const rawPrice = decodeXmlEntities(subDMatch[1]);
            const priceMatch = rawPrice.match(/([0-9]+(?:[.,][0-9]{1,2})?)/);
            if (priceMatch) {
                const parsed = parseFloat(priceMatch[1].replace(",", "."));
                if (!isNaN(parsed) && parsed > 0) {
                    price = Math.round(parsed);
                }
            }
        }
    }

    // 3. ISBN & Couverture
    const isbn13 = originalClean.length === 13 ? originalClean : (isbn10ToIsbn13(originalClean) || originalClean);
    const coverUrl = `https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=${isbn13}&couverture=1&taille=originale`;

    return {
        title,
        isbn: isbn13,
        price,
        coverUrl
    };
}

export async function lookupBnfByIsbn(rawIsbn: string): Promise<BnfBookResult | null> {
    const clean = cleanIsbn(rawIsbn);
    if (clean.length !== 10 && clean.length !== 13) {
        return null;
    }

    const candidates: string[] = [clean];
    if (clean.length === 10) {
        const alt13 = isbn10ToIsbn13(clean);
        if (alt13 && !candidates.includes(alt13)) {
            candidates.push(alt13);
        }
    } else if (clean.length === 13 && clean.startsWith("978")) {
        const alt10 = isbn13ToIsbn10(clean);
        if (alt10 && !candidates.includes(alt10)) {
            candidates.push(alt10);
        }
    }

    for (const candidate of candidates) {
        try {
            const queryParam = encodeURIComponent(`bib.isbn all "${candidate}"`);
            const url = `${BNF_SRU_BASE_URL}?version=1.2&operation=searchRetrieve&recordSchema=unimarcxchange&maximumRecords=1&query=${queryParam}`;

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            const res = await fetch(url, {
                headers: {
                    Accept: "application/xml, text/xml"
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) continue;
            const text = await res.text();
            if (!text) continue;

            const parsed = parseBnfXmlResponse(text, clean);
            if (parsed) {
                return parsed;
            }
        } catch {
            // Passer au candidat suivant en cas de timeout ou erreur
        }
    }

    return null;
}
