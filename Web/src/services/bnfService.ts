/**
 * Service pour interroger le catalogue de la Bibliothèque Nationale de France (BnF) via SRU.
 * Permet d'extraire toutes les métadonnées riches disponibles (titre, sous-titre, auteurs avec rôles,
 * éditeur, collection, tome, pagination, date, dimensions, résumé, prix, type de doc, couverture).
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
    releaseDate: string | null; // format YYYY-MM-DD
    description: string | null;
    docType: string | null; // "Comics" | "Manga" | "Bande dessinée" | "Roman" | etc.
    height: number | null; // en mm ou cm
    length: number | null;
    thickness: number | null;
    authors: BnfAuthor[];
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

/**
 * Nettoie le nom de l'auteur extrait des notices d'autorité (ex: "1975-...." ou fonctions).
 */
function cleanAuthorPart(part: string): string {
    return part
        .replace(/\(\s*[\d.]*\s*-[^)]*\)/g, "") // retire les dates (1975-....)
        .replace(/\b\d{4}-\d{4}\b/g, "")
        .replace(/\b\d{4}-\.{2,4}\b/g, "")
        .replace(/^[.\s,;:-]+|[.\s,;:-]+$/g, "")
        .trim();
}

/**
 * Détermine le rôle de l'auteur d'après le code UNIMARC ($4) ou la mention dans la notice.
 * Codes UNIMARC standard :
 * - 070 : auteur / scénariste
 * - 440 : illustrateur / dessinateur
 * - 205 : coloriste
 * - 730 : traducteur
 */
function mapUnimarcRole(code: string | undefined): "Writer" | "Illustrator" | "Colorist" | "Other" {
    if (!code) return "Writer";
    const c = code.trim();
    if (c === "070" || c === "651") return "Writer";
    if (c === "440" || c === "753") return "Illustrator";
    if (c === "205") return "Colorist";
    return "Writer";
}

export function parseBnfXmlResponse(xmlBody: string, originalClean: string): BnfBookResult | null {
    const countMatch = xmlBody.match(/<(?:\w+:)?numberOfRecords>(\d+)<\/(?:\w+:)?numberOfRecords>/);
    if (!countMatch) return null;
    const count = parseInt(countMatch[1] || "0", 10);
    if (count <= 0) return null;

    // 1. Titre et sous-titres (tag 200)
    let title: string | null = null;
    let volumeFrom200: number | null = null;
    let volumeStrFrom200: string | null = null;
    let partTitleFrom200: string | null = null;

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

            // $h : numéro de tome / partie (ex: "Tome 6", "Volume 1", "6")
            const subHMatch = fieldContent.match(/<(?:\w+:)?subfield[^>]*code="h"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
            if (subHMatch) {
                volumeStrFrom200 = decodeXmlEntities(subHMatch[1]).trim();
                const numMatch = volumeStrFrom200.match(/\d+/);
                if (numMatch) {
                    volumeFrom200 = parseInt(numMatch[0], 10);
                }
            }

            // $i : titre de partie ou de tome (ex: "Les années 1938-1940")
            const subIMatch = fieldContent.match(/<(?:\w+:)?subfield[^>]*code="i"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
            if (subIMatch) {
                partTitleFrom200 = decodeXmlEntities(subIMatch[1]).trim();
            }

            // Construction d'un titre complet et distinct pour chaque tome
            if (volumeStrFrom200 && partTitleFrom200) {
                mainTitle = `${mainTitle} - ${volumeStrFrom200} : ${partTitleFrom200}`;
            } else if (volumeStrFrom200) {
                mainTitle = `${mainTitle} - ${volumeStrFrom200}`;
            } else if (partTitleFrom200) {
                mainTitle = `${mainTitle} : ${partTitleFrom200}`;
            }

            title = mainTitle;
        }
    }

    // Fallback Dublin Core titre si le tag 200 est absent
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
    title = title.replace(/\s*[/:]\s*$/, "").trim();

    // 2. Prix (tag 010 $d)
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

    // 3. Éditeur (tag 214 $c ou tag 210 $c)
    let editorName: string | null = null;
    const pubMatch = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="(?:214|210)"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
    if (pubMatch) {
        const subCMatch = pubMatch[1].match(/<(?:\w+:)?subfield[^>]*code="c"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subCMatch) {
            let ed = decodeXmlEntities(subCMatch[1]);
            ed = ed.replace(/^[.\s,;:-]+|[.\s,;:-]+$/g, "").trim();
            if (ed.length > 0) {
                editorName = ed;
            }
        }
    }

    // 4. Série & Tome (tag 225 $a, $v ou tag 461 $t, $v, ou extraction depuis 200)
    let seriesName: string | null = null;
    let volume: number | null = volumeFrom200;

    const tag225Match = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="225"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
    if (tag225Match) {
        const subA = tag225Match[1].match(/<(?:\w+:)?subfield[^>]*code="a"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subA) {
            seriesName = decodeXmlEntities(subA[1]).replace(/^[.\s,;:-]+|[.\s,;:-]+$/g, "").trim();
        }
        const subV = tag225Match[1].match(/<(?:\w+:)?subfield[^>]*code="v"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subV) {
            const vMatch = subV[1].match(/\d+/);
            if (vMatch) {
                volume = parseInt(vMatch[0], 10);
            }
        }
    }

    if (!seriesName) {
        const tag461Match = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="461"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
        if (tag461Match) {
            const subT = tag461Match[1].match(/<(?:\w+:)?subfield[^>]*code="t"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
            if (subT) {
                let parsedSeries = decodeXmlEntities(subT[1]).replace(/^[.\s,;:-]+|[.\s,;:-]+$/g, "").trim();
                // Si la série 461 est juste l'auteur ou le titre générique avec sous-titre dans le 200, l'enrichir
                if (tag200Match) {
                    const subE = tag200Match[1].match(/<(?:\w+:)?subfield[^>]*code="e"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
                    if (subE) {
                        const subETxt = decodeXmlEntities(subE[1]).trim();
                        if (subETxt.toLowerCase().includes("intégrale") && !parsedSeries.toLowerCase().includes("intégrale")) {
                            parsedSeries = `${parsedSeries} : ${subETxt}`;
                        }
                    }
                }
                seriesName = parsedSeries;
            }
            if (volume === null) {
                const subV = tag461Match[1].match(/<(?:\w+:)?subfield[^>]*code="v"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
                if (subV) {
                    const vMatch = subV[1].match(/\d+/);
                    if (vMatch) {
                        volume = parseInt(vMatch[0], 10);
                    }
                }
            }
        }
    }

    // 5. Collection (tag 225 ou mention collection)
    let collectionName: string | null = null;
    if (seriesName && tag225Match) {
        const subI = tag225Match[1].match(/<(?:\w+:)?subfield[^>]*code="i"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subI) {
            collectionName = decodeXmlEntities(subI[1]).trim();
        }
    }

    // 6. Nombre de pages et dimensions (tag 215)
    let pageCount: number | null = null;
    let height: number | null = null;
    let length: number | null = null;
    let thickness: number | null = null;

    const tag215Match = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="215"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
    if (tag215Match) {
        const subA = tag215Match[1].match(/<(?:\w+:)?subfield[^>]*code="a"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subA) {
            const pMatch = subA[1].match(/(?:ca\s*)?(\d{2,4})\s*p(?:ages?)?\.?/i);
            if (pMatch) {
                pageCount = parseInt(pMatch[1], 10);
            }
        }
        const subD = tag215Match[1].match(/<(?:\w+:)?subfield[^>]*code="d"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subD) {
            // Ex: "27 cm", "15 x 30 cm", "280 x 200 mm"
            const dimText = subD[1].toLowerCase();
            const cmMatches = dimText.match(/(\d+(?:[.,]\d+)?)\s*(?:x\s*(\d+(?:[.,]\d+)?))?\s*cm/);
            if (cmMatches) {
                const val1 = parseFloat(cmMatches[1].replace(",", "."));
                const val2 = cmMatches[2] ? parseFloat(cmMatches[2].replace(",", ".")) : null;
                if (val2 != null) {
                    length = Math.round(val1 * 10);
                    height = Math.round(val2 * 10);
                } else {
                    height = Math.round(val1 * 10);
                }
            }
        }
    }

    // 7. Date de parution (tag 214 $d ou tag 100)
    let releaseDate: string | null = null;
    if (pubMatch) {
        const subD = pubMatch[1].match(/<(?:\w+:)?subfield[^>]*code="d"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subD) {
            const fullDateMatch = subD[1].match(/(\d{4})-(\d{2})-(\d{2})/);
            if (fullDateMatch) {
                releaseDate = fullDateMatch[0];
            } else {
                const yearMatch = subD[1].match(/\b(19\d{2}|20\d{2})\b/);
                if (yearMatch) {
                    releaseDate = `${yearMatch[1]}-01-01`;
                }
            }
        }
    }
    if (!releaseDate) {
        const tag100Match = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="100"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
        if (tag100Match) {
            const subA = tag100Match[1].match(/<(?:\w+:)?subfield[^>]*code="a"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
            if (subA && subA[1].length >= 13) {
                const yearPart = subA[1].substring(9, 13);
                if (/^(?:19|20)\d{2}$/.test(yearPart)) {
                    releaseDate = `${yearPart}-01-01`;
                }
            }
        }
    }

    // 8. Résumé (tag 330 $a)
    let description: string | null = null;
    const tag330Match = xmlBody.match(/<(?:\w+:)?datafield[^>]*tag="330"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/);
    if (tag330Match) {
        const subA = tag330Match[1].match(/<(?:\w+:)?subfield[^>]*code="a"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subA) {
            description = decodeXmlEntities(subA[1]).trim();
        }
    }

    // 9. Type de document / Format
    let docType: string | null = null;
    const fullTextLower = xmlBody.toLowerCase();
    if (fullTextLower.includes("manga")) {
        docType = "Manga";
    } else if (fullTextLower.includes("comic") || fullTextLower.includes("comics")) {
        docType = "Comics";
    } else if (fullTextLower.includes("bande dessinée") || fullTextLower.includes("bandes dessinées") || fullTextLower.includes("bd")) {
        docType = "Bande dessinée";
    } else if (fullTextLower.includes("roman") || fullTextLower.includes("fiction")) {
        docType = "Roman";
    }

    // 10. Auteurs (tags 700, 701, 702)
    const authors: BnfAuthor[] = [];
    const authorRegex = /<(?:\w+:)?datafield[^>]*tag="(700|701|702)"[^>]*>([\s\S]*?)<\/(?:\w+:)?datafield>/g;
    let aMatch: RegExpExecArray | null;

    while ((aMatch = authorRegex.exec(xmlBody)) !== null) {
        const content = aMatch[2];
        const subAMatch = content.match(/<(?:\w+:)?subfield[^>]*code="a"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (!subAMatch) continue;

        const lastname = cleanAuthorPart(decodeXmlEntities(subAMatch[1]));
        if (!lastname) continue;

        let firstname = "";
        const subBMatch = content.match(/<(?:\w+:)?subfield[^>]*code="b"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subBMatch) {
            firstname = cleanAuthorPart(decodeXmlEntities(subBMatch[1]));
        }

        const sub4Match = content.match(/<(?:\w+:)?subfield[^>]*code="4"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        const role = mapUnimarcRole(sub4Match ? sub4Match[1] : undefined);

        // Éviter les doublons exacts
        const exists = authors.some(
            (a) => a.lastname.toLowerCase() === lastname.toLowerCase() && a.firstname.toLowerCase() === firstname.toLowerCase()
        );
        if (!exists) {
            authors.push({ firstname, lastname, type: role });
        }
    }

    // Fallback auteurs depuis tag 200 $f / $g si aucun auteur dans les tags 700/701/702
    if (authors.length === 0 && tag200Match) {
        const subF = tag200Match[1].match(/<(?:\w+:)?subfield[^>]*code="f"[^>]*>([^<]+)<\/(?:\w+:)?subfield>/);
        if (subF) {
            const raw = decodeXmlEntities(subF[1]).replace(/^\[|\]$/g, "");
            const parts = raw.split(/[,;&]/);
            for (const p of parts) {
                const cleaned = p.replace(/\b(?:scénario|texte|par|auteur)\b/gi, "").trim();
                if (cleaned) {
                    const space = cleaned.lastIndexOf(" ");
                    if (space > 0) {
                        authors.push({
                            firstname: cleaned.substring(0, space).trim(),
                            lastname: cleaned.substring(space + 1).trim(),
                            type: "Writer"
                        });
                    } else {
                        authors.push({ firstname: "", lastname: cleaned, type: "Writer" });
                    }
                }
            }
        }
    }

    // 11. ISBN 13 & Couverture
    const isbn13 = originalClean.length === 13 ? originalClean : (isbn10ToIsbn13(originalClean) || originalClean);
    const coverUrl = `https://openapi.bnf.fr/couverture/image/image/recupererImage?ISBN=${isbn13}&couverture=1&taille=originale`;

    return {
        title,
        isbn: isbn13,
        price,
        coverUrl,
        seriesName,
        volume,
        editorName,
        collectionName,
        pageCount,
        releaseDate,
        description,
        docType,
        height,
        length,
        thickness,
        authors
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
