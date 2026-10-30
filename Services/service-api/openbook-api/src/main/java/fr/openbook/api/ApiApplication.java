package fr.openbook.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.scheduling.annotation.EnableScheduling;

@EnableScheduling
@SpringBootApplication(scanBasePackages = {"fr.openbook"})
@EntityScan(basePackages = {"fr.openbook.api.entities", "fr.openbook.media.entity"})
@EnableJpaRepositories(basePackages = {"fr.openbook.api.repositories", "fr.openbook.media.repository"})
public class ApiApplication {

	public static void main(String[] args) {
		SpringApplication.run(ApiApplication.class, args);
	}

}
