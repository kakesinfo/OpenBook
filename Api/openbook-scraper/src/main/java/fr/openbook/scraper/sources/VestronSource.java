package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

@Component
public class VestronSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/vestron/?tri=nouveautes";

    public VestronSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "vestron";
    }

    @Override
    public String getName() {
        return "Vestron";
    }

    @Override
    public String getDescription() {
        return "Editions Vestron (via Leslibraires.fr)";
    }

    @Override
    public String getColor() {
        return "#2a9d8f";
    }

    @Override
    public String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "Vestron";
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
