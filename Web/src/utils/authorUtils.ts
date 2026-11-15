export function isCollectifAuthor(
    author?: { firstname?: string | null; lastname?: string | null; name?: string | null } | null
): boolean {
    if (!author) return false;
    const fullName = (author.name
        ? author.name.trim()
        : `${author.firstname || ""} ${author.lastname || ""}`.trim()).toLowerCase();
    return /^collectif(\b|$)/i.test(fullName)
        || (author.firstname || "").trim().toLowerCase() === "collectif"
        || (author.lastname || "").trim().toLowerCase() === "collectif";
}
