package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

@Component
public class SolodoloSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/solodolo-/?tri=nouveautes";

    public SolodoloSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "solodolo";
    }

    @Override
    public String getName() {
        return "Solodolo";
    }

    @Override
    public String getDescription() {
        return "Editions Solodolo (via Leslibraires.fr)";
    }

    @Override
    public String getColor() {
        return "#e76f51";
    }

    @Override
    public String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "Solodolo";
    }

    @Override
    protected String getDefaultCategoryName() {
        return "Comics";
    }

    @Override
    protected boolean isForceDefaultCategory() {
        return true;
    }
}
