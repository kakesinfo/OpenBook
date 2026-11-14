package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

@Component
public class HuginnMuninnComicsSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/recherche/?q=Huginn+Muninn&f_dpt=25&f_dpt_25_cat=113885&tri=nouveautes";

    public HuginnMuninnComicsSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "huginn_muninn_comics";
    }

    @Override
    public String getName() {
        return "Huginn & Muninn Comics";
    }

    @Override
    public String getDescription() {
        return "Huginn & Muninn Comics (via Leslibraires.fr)";
    }

    @Override
    public String getColor() {
        return "#264653";
    }

    @Override
    public String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return null;
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
