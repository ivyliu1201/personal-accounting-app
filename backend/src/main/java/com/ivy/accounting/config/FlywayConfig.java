package com.ivy.accounting.config;

import org.flywaydb.core.Flyway;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;

@Configuration
public class FlywayConfig {

    @Bean
    Flyway flyway(DataSource dataSource, @Value("${spring.flyway.baseline-on-migrate:false}") boolean baselineOnMigrate) {
        return Flyway.configure()
                .dataSource(dataSource)
                .locations("classpath:db/migration")
                .baselineOnMigrate(baselineOnMigrate)
                .baselineVersion("0")
                .load();
    }

    @Bean
    SmartInitializingSingleton flywayMigrationInitializer(Flyway flyway) {
        return flyway::migrate;
    }
}
