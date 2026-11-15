package fr.openbook.api.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCache;
import org.springframework.cache.support.SimpleCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;
import java.util.List;

@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager(
            @Value("${bnf.cache.ttl:24h}") Duration bnfCacheTtl,
            @Value("${bnf.cache.max-size:10000}") long bnfCacheMaxSize,
            @Value("${statistics.cache.ttl:10m}") Duration statisticsCacheTtl,
            @Value("${statistics.cache.max-size:1000}") long statisticsCacheMaxSize
    ) {
        SimpleCacheManager cacheManager = new SimpleCacheManager();
        cacheManager.setCaches(List.of(
                new CaffeineCache("bnf-search", Caffeine.newBuilder()
                        .expireAfterWrite(bnfCacheTtl)
                        .maximumSize(bnfCacheMaxSize)
                        .recordStats()
                        .build()),
                new CaffeineCache("bnf-isbn", Caffeine.newBuilder()
                        .expireAfterWrite(bnfCacheTtl)
                        .maximumSize(bnfCacheMaxSize)
                        .recordStats()
                        .build()),
                new CaffeineCache("bnf-quick-search", Caffeine.newBuilder()
                        .expireAfterWrite(bnfCacheTtl)
                        .maximumSize(bnfCacheMaxSize)
                        .recordStats()
                        .build()),
                new CaffeineCache("user-statistics", Caffeine.newBuilder()
                        .expireAfterWrite(statisticsCacheTtl)
                        .maximumSize(statisticsCacheMaxSize)
                        .recordStats()
                        .build())
        ));
        cacheManager.initializeCaches();
        return cacheManager;
    }
}
