package fr.openbook.media.storage;

import fr.openbook.media.config.MediaProperties;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import static org.assertj.core.api.Assertions.assertThat;

class StorageProviderConfigurationTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(MediaProperties.class, LocalStorageProvider.class, S3StorageProvider.class);

    @Test
    void whenDefault_thenLocalStorageProviderIsLoaded() {
        contextRunner.run(context -> {
            assertThat(context).hasSingleBean(StorageProvider.class);
            assertThat(context).hasSingleBean(LocalStorageProvider.class);
            assertThat(context).doesNotHaveBean(S3StorageProvider.class);
        });
    }

    @Test
    void whenStorageTypeLocal_thenLocalStorageProviderIsLoaded() {
        contextRunner
                .withPropertyValues("media.storage.type=local")
                .run(context -> {
                    assertThat(context).hasSingleBean(StorageProvider.class);
                    assertThat(context).hasSingleBean(LocalStorageProvider.class);
                    assertThat(context).doesNotHaveBean(S3StorageProvider.class);
                });
    }

    @Test
    void whenStorageTypeS3_thenS3StorageProviderIsLoaded() {
        contextRunner
                .withPropertyValues(
                        "media.storage.type=s3",
                        "media.s3.endpoint=http://localhost:9000",
                        "media.s3.bucket=test-bucket"
                )
                .run(context -> {
                    assertThat(context).hasSingleBean(StorageProvider.class);
                    assertThat(context).hasSingleBean(S3StorageProvider.class);
                    assertThat(context).doesNotHaveBean(LocalStorageProvider.class);
                });
    }
}
