package fr.openbook.media.service;

import fr.openbook.media.config.MediaProperties;
import fr.openbook.media.storage.LocalStorageProvider;

/**
 * Legacy service alias for {@link LocalStorageProvider}.
 *
 * @deprecated Inject {@link fr.openbook.media.storage.StorageProvider} instead.
 */
@Deprecated
public class MediaStorageService extends LocalStorageProvider {

    public MediaStorageService(MediaProperties properties) {
        super(properties);
    }
}
