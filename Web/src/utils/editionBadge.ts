export type EditionBadgeType = "collector" | "limited";

export interface EditionBadge {
    label: string;
    type: EditionBadgeType;
}

export function detectEditionBadge(book?: { title?: string | null; description?: string | null; collection?: { name?: string | null } | null } | null): EditionBadge | null {
    if (!book) return null;
    const title = book.title || "";
    const desc = book.description || "";
    const col = book.collection?.name || "";
    const text = `${title} ${desc} ${col}`;

    // Limited edition keywords
    if (/\b(tirage\s+(?:limit[eé]|de\s+t[eê]te|num[eé]rot[eé])|[eé]dition\s+limit[eé]e|[eé]dition\s+prestige|num[eé]rot[eé]|limited\s+edition)\b/i.test(text)) {
        return { label: "Limité", type: "limited" };
    }

    // Collector edition keywords (collector, spéciale, variante, etc.)
    if (/\b(collector|[eé]dition\s+collector|coffret\s+collector|[eé]dition\s+sp[eé]ciale|special\s+edition|hors[\s-]s[eé]rie|couverture\s+variante|variant(?:e)?)\b/i.test(text)) {
        return { label: "Collector", type: "collector" };
    }

    return null;
}
